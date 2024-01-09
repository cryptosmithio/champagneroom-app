import { error, fail } from '@sveltejs/kit';
import type { AxiosResponse } from 'axios';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import type { SuperValidated } from 'sveltekit-superforms';
import { message, setError, superValidate } from 'sveltekit-superforms/server';
import { z } from 'zod';

import {
  BITCART_API_URL,
  BITCART_EMAIL,
  BITCART_PASSWORD,
  JITSI_APP_ID,
  JITSI_JWT_SECRET,
  JWT_EXPIRY,
  WEB3STORAGE_KEY,
  WEB3STORAGE_PROOF
} from '$env/static/private';
import { PUBLIC_JITSI_DOMAIN } from '$env/static/public';

import type { CancelType } from '$lib/models/common';
import { Creator, type CreatorDocument } from '$lib/models/creator';
import type { ShowDocument } from '$lib/models/show';
import { Show } from '$lib/models/show';
import type { ShowEventDocument } from '$lib/models/showEvent';
import { ShowEvent } from '$lib/models/showEvent';
import type { UserDocument } from '$lib/models/user';
import type { WalletDocument } from '$lib/models/wallet';
import { Wallet, WalletStatus } from '$lib/models/wallet';

import type { ShowMachineEventType } from '$lib/machines/showMachine';

import type { PayoutQueueType } from '$lib/workers/payoutWorker';
import type { ShowQueueType } from '$lib/workers/showWorker';

import {
  ActorType,
  CancelReason,
  CurrencyType,
  EntityType,
  ShowMachineEventString,
  ShowStatus
} from '$lib/constants';
import { rateCryptosRateGet } from '$lib/ext/bitcart';
import { createBitcartToken, PayoutJobType, PayoutReason } from '$lib/payment';
import { getShowMachineService } from '$lib/server/machinesUtil';
import {
  Room,
  type RoomDocument,
  roomZodSchema
} from '$lib/server/models/room';
import { web3Upload } from '$lib/server/upload';

import type { Actions, PageServerLoad, RequestEvent } from './$types';

const createShowSchema = z.object({
  price: z.number().min(1).max(10_000),
  name: z.string().min(3).max(50),
  duration: z.number().min(15).max(120).default(60),
  capacity: z.number(),
  coverImageUrl: z.string(),
  walletId: z.string().min(16).max(64)
});

const requestPayoutSchema = z.object({
  amount: z.number().min(0.0001),
  destination: z.string().min(3),
  walletId: z.string().min(16).max(64)
});

export const actions: Actions = {
  update_profile_image: async ({ locals, request }: RequestEvent) => {
    const data = await request.formData();
    const url = data.get('url') as string;
    if (!url) {
      return fail(400, { url, missingUrl: true });
    }
    const user = locals.user as UserDocument;
    const creator = locals.creator as CreatorDocument;
    user.profileImageUrl = url;
    await user.save();
    creator.user.profileImageUrl = url;

    return {
      success: true,
      creator: creator?.toJSON({ flattenMaps: true, flattenObjectIds: true })
    };
  },
  create_show: async ({ locals, request }) => {
    const form = await superValidate(request, createShowSchema);
    console.log('POST', form);

    if (!form.valid) {
      return fail(400, { form });
    }

    const price = form.data.price;
    const name = form.data.name;
    const duration = form.data.duration;
    const capacity = form.data.capacity;
    const coverImageUrl = form.data.coverImageUrl;

    const creator = locals.creator as CreatorDocument;

    const show = new Show({
      price: {
        amount: +price,
        currency: CurrencyType.USD
      },
      name,
      duration: +duration,
      capacity: +capacity,
      creator: creator._id,
      agent: creator.agent,
      coverImageUrl,
      showState: {
        status: ShowStatus.BOX_OFFICE_OPEN,
        salesStats: {
          ticketsAvailable: +capacity
        }
      },
      creatorInfo: {
        name: creator.user.name,
        profileImageUrl: creator.user.profileImageUrl,
        averageRating: creator.feedbackStats.averageRating,
        numberOfReviews: creator.feedbackStats.numberOfReviews
      }
    });

    show.save();

    return {
      createShowForm: form,
      success: true,
      showCreated: true,
      show: show.toJSON({ flattenMaps: true, flattenObjectIds: true })
    };
  },
  cancel_show: async ({ locals }) => {
    const redisConnection = locals.redisConnection as IORedis;
    const show = locals.show as ShowDocument;
    if (!show) {
      throw error(404, 'Show not found');
    }
    const showQueue = new Queue(EntityType.SHOW, {
      connection: redisConnection
    }) as ShowQueueType;

    const showService = getShowMachineService(show);
    const showMachineState = showService.getSnapshot();

    const cancel = {
      cancelledInState: JSON.stringify(showMachineState.value),
      reason: CancelReason.CREATOR_CANCELLED,
      cancelledBy: ActorType.CREATOR
    } as CancelType;

    const cancelEvent = {
      type: 'CANCELLATION INITIATED',
      cancel
    } as ShowMachineEventType;

    if (showMachineState.can(cancelEvent)) {
      showQueue.add(ShowMachineEventString.CANCELLATION_INITIATED, {
        showId: show._id.toString(),
        cancel
      });
    }

    showQueue.close();
    showService.stop();

    return {
      success: true,
      showCancelled: true
    };
  },
  end_show: async ({ locals }) => {
    const show = locals.show as ShowDocument;

    if (show === null) {
      throw error(404, 'Show ID not found');
    }

    let isInEscrow = false;

    const redisConnection = locals.redisConnection as IORedis;
    const showQueue = new Queue(EntityType.SHOW, {
      connection: redisConnection
    }) as ShowQueueType;

    const showService = getShowMachineService(show);
    const showState = showService.getSnapshot();

    if (showState.can({ type: ShowMachineEventString.SHOW_ENDED })) {
      showQueue.add(ShowMachineEventString.SHOW_ENDED, {
        showId: show._id.toString()
      });
      isInEscrow = true;
    }

    showQueue.close();
    showService.stop();

    return {
      success: true,
      inEscrow: isInEscrow
    };
  },
  request_payout: async ({ request, locals }) => {
    const data = await request.formData();
    const amount = data.get('amount') as string;
    const destination = data.get('destination') as string;
    const walletId = data.get('walletId') as string;

    const form = await superValidate(request, requestPayoutSchema);

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      const wallet = await Wallet.findOne({ _id: walletId }).orFail();

      if (!wallet) {
        setError(form, 'walletId', 'Wallet not found');
      }

      if (wallet.availableBalance < +amount) {
        setError(form, 'amount', 'Insufficient funds');
      }

      if (wallet.status === WalletStatus.PAYOUT_IN_PROGRESS) {
        setError(form, 'destination', 'Payout in progress');
      }

      const redisConnection = locals.redisConnection as IORedis;
      const payoutQueue = new Queue(EntityType.PAYOUT, {
        connection: redisConnection
      }) as PayoutQueueType;

      payoutQueue.add(PayoutJobType.CREATE_PAYOUT, {
        walletId,
        amount: +amount,
        destination,
        payoutReason: PayoutReason.CREATOR_PAYOUT
      });

      payoutQueue.close();
    } catch {
      return message(form, 'Error requesting payout');
    }

    return message(form, 'Payout requested successfully');
  },
  leave_show: async ({ locals }) => {
    const redisConnection = locals.redisConnection as IORedis;
    const show = locals.show;
    if (!show) {
      throw error(404, 'Show not found');
    }

    const showQueue = new Queue(EntityType.SHOW, {
      connection: redisConnection
    }) as ShowQueueType;

    const showService = getShowMachineService(show);

    const showState = showService.getSnapshot();

    if (showState.can({ type: ShowMachineEventString.SHOW_STOPPED })) {
      showQueue.add(ShowMachineEventString.SHOW_STOPPED, {
        showId: show._id.toString()
      });
    }
    showQueue.close();
    showService.stop();
    console.log('Creator left show');
    return { success: true };
  },
  start_show: async ({ locals }) => {
    const show = locals.show as ShowDocument;
    if (!show) {
      throw error(404, 'Show not found');
    }
    const redisConnection = locals.redisConnection as IORedis;
    const showQueue = new Queue(EntityType.SHOW, {
      connection: redisConnection
    }) as ShowQueueType;

    const showService = getShowMachineService(show);
    const showState = showService.getSnapshot();

    if (!showState.matches('started'))
      showQueue.add(ShowMachineEventString.SHOW_STARTED, {
        showId: show._id.toString()
      });

    showQueue.close();
    showService.stop();
  },
  upsert_room: async ({ request, locals }) => {
    const creator = locals.creator as CreatorDocument;
    const formData = await request.formData();

    const form = await superValidate(formData, roomZodSchema);

    const isUpdate = !!form.data._id;
    // Convenient validation check:
    if (!form.valid) {
      // Again, return { form } and things will just work.
      return fail(400, { form });
    }
    const image =
      formData.get('images') && (formData.get('images') as unknown as [File]);

    if (image instanceof File && image.size > 0) {
      // upload image to web3
      const url = await web3Upload(WEB3STORAGE_KEY, WEB3STORAGE_PROOF, image);
      form.data.coverImageUrl = url;
    }

    Room.init();

    try {
      if (isUpdate) {
        Room.updateOne(
          { _id: new ObjectId(form.data._id as string) },
          form.data
        ).exec();
      } else {
        const room = (await Room.create({
          ...form.data,
          _id: new ObjectId()
        })) as RoomDocument;
        Creator.updateOne(
          { _id: creator._id },
          {
            $set: {
              room: room._id
            }
          }
        ).exec();
        return {
          form
        };
      }
    } catch (error_) {
      console.error(error_);
      throw error(500, 'Error upserting room');
    }
  }
};
export const load: PageServerLoad = async ({ locals }) => {
  const creator = locals.creator as CreatorDocument;
  const user = locals.user;
  if (!creator) {
    throw error(404, 'Creator not found');
  }

  const show = locals.show as ShowDocument;
  const room = locals.room as RoomDocument;
  let showEvent: ShowEventDocument | undefined;

  if (show) {
    const se = await ShowEvent.find(
      { show: show._id },
      {},
      { sort: { createdAt: -1 } }
    ).limit(1);
    if (se && se[0]) showEvent = se[0];
  }

  const completedShows = (await Show.find({
    creator: creator._id,
    'showState.status': ShowStatus.FINALIZED
  })
    .sort({ 'showState.finalize.finalizedAt': -1 })
    .limit(10)
    .exec()) as ShowDocument[];

  const wallet = locals.wallet as WalletDocument;

  // return the rate of exchange for UI from bitcart
  const token = await createBitcartToken(
    BITCART_EMAIL,
    BITCART_PASSWORD,
    BITCART_API_URL
  );

  let jitsiToken: string | undefined;

  if (show) {
    jitsiToken = jwt.sign(
      {
        aud: 'jitsi',
        iss: JITSI_APP_ID,
        exp: Math.floor(Date.now() / 1000) + +JWT_EXPIRY,
        sub: PUBLIC_JITSI_DOMAIN,
        room: show.conferenceKey,
        moderator: true,
        context: {
          user: {
            name: creator.user.name,
            affiliation: 'owner',
            lobby_bypass: true
          }
        }
      },
      JITSI_JWT_SECRET
    );
  }

  const exchangeRate =
    ((await rateCryptosRateGet(
      {
        currency: wallet.currency,
        fiat_currency: CurrencyType.USD
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )) as AxiosResponse<string>) || undefined;

  const roomForm = room
    ? await superValidate(room, roomZodSchema)
    : ((await superValidate(roomZodSchema)) as SuperValidated<
        typeof roomZodSchema
      >);

  const createShowForm = await superValidate(createShowSchema);
  const requestPayoutForm = await superValidate(
    {
      amount: 0,
      destination:
        user?.toJSON({ flattenMaps: true, flattenObjectIds: true }).address ||
        '',
      walletId: wallet._id.toString()
    },
    requestPayoutSchema,
    { errors: false }
  );

  return {
    requestPayoutForm,
    createShowForm,
    roomForm,
    creator: creator.toJSON({ flattenMaps: true, flattenObjectIds: true }),
    user: user?.toJSON({ flattenMaps: true, flattenObjectIds: true }),
    show: show
      ? show.toJSON({ flattenMaps: true, flattenObjectIds: true })
      : undefined,
    showEvent: showEvent
      ? showEvent.toJSON({
          flattenMaps: true,
          flattenObjectIds: true
        })
      : undefined,
    completedShows: completedShows.map((show) =>
      show.toJSON({ flattenMaps: true, flattenObjectIds: true })
    ),
    wallet: wallet.toJSON({ flattenMaps: true, flattenObjectIds: true }),
    exchangeRate: exchangeRate?.data,
    jitsiToken
  };
};

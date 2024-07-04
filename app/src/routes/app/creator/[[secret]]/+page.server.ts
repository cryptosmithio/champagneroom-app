import { error, fail } from '@sveltejs/kit';
import { Queue } from 'bullmq';
import { possessive } from 'i18n-possessive';
import type IORedis from 'ioredis';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { nanoid } from 'nanoid';
import type { SuperValidated } from 'sveltekit-superforms';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';

import { env } from '$env/dynamic/private';
import { env as pubEnvironment } from '$env/dynamic/public';

import type { CancelType } from '$lib/models/common';
import { Creator, type CreatorDocument } from '$lib/models/creator';
import { Room, roomCRUDSchema, type RoomDocument } from '$lib/models/room';
import { Show, showCRUDSchema, type ShowDocument } from '$lib/models/show';
import { ShowEvent, type ShowEventDocument } from '$lib/models/showEvent';
import { User, type UserDocument } from '$lib/models/user';
import type { WalletDocument } from '$lib/models/wallet';

import {
  createShowActor,
  type ShowMachineEventType
} from '$lib/machines/showMachine';

import type { PayoutQueueType } from '$lib/workers/payoutWorker';

import {
  ActorType,
  CancelReason,
  CurrencyType,
  EntityType,
  ShowStatus
} from '$lib/constants';
import { rateCryptosRateGet } from '$lib/ext/bitcart';
import {
  createBitcartToken,
  PayoutJobType,
  PayoutReason,
  requestPayoutSchema
} from '$lib/payments';
import {
  getShowPermissions,
  getShowPermissionsFromShow,
  type ShowPermissionsType
} from '$lib/server/machinesUtil';
import { ipfsUpload } from '$lib/server/upload';

import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const actions: Actions = {
  /**
   * Updates the profile image for the user.
   *
   * @param {RequestEvent} params - The request event object containing the locals and request data.
   * @return {Promise<{ success: boolean, imageUrl: string }>} A promise that resolves to an object with the success status and the URL of the updated profile image.
   * @throws {Error} If the user is not found.
   */
  update_profile_image: async ({ locals, request }: RequestEvent) => {
    const data = await request.formData();
    const image =
      data.get('images') && (data.get('images') as unknown as [File]);
    const user = locals.user as UserDocument;
    if (!user) {
      throw error(404, 'User not found');
    }
    if (image instanceof File && image.size > 0) {
      // upload image to web3
      const url = await ipfsUpload(image);
      User.updateOne(
        { _id: user._id },
        {
          $set: {
            profileImageUrl: url
          }
        }
      ).exec();

      return {
        success: true,
        imageUrl: url
      };
    }
  },

  /**
   * Creates a new show with the provided form data.
   *
   * @param {RequestEvent} event - The request event containing the locals and request data.
   * @return {Promise<{
   *   success: boolean,
   *   show: ShowDocument,
   *   form: SuperValidated<z.infer<typeof showCRUDSchema>>,
   *   showPermissions: ShowPermissionsType
   * }>} - A promise that resolves to an object containing the success status, the created show, the form data, and the show permissions.
   */
  create_show: async ({ locals, request }: RequestEvent) => {
    const form = (await superValidate(
      request,
      zod(showCRUDSchema)
    )) as SuperValidated<z.infer<typeof showCRUDSchema>>;

    if (!form.valid) {
      return fail(400, { form });
    }
    const creator = locals.creator as CreatorDocument;

    const show = (await Show.create({
      ...form.data,
      creator: creator._id,
      _id: new ObjectId(),
      agent: creator.agent,
      conferenceKey: nanoid(12),
      coverImageUrl: creator.user.profileImageUrl,
      showState: {
        status: ShowStatus.BOX_OFFICE_OPEN,
        salesStats: {
          ticketsAvailable: form.data.capacity
        }
      },
      creatorInfo: {
        name: creator.user.name,
        profileImageUrl: creator.user.profileImageUrl,
        averageRating: creator.feedbackStats.averageRating,
        numberOfReviews: creator.feedbackStats.numberOfReviews
      }
    })) as ShowDocument;
    // return new permissions also

    const showPermissions = getShowPermissionsFromShow({
      show,
      redisConnection: locals.redisConnection as IORedis
    });

    return {
      success: true,
      show: show.toJSON({ flattenMaps: true, flattenObjectIds: true }),
      form,
      showPermissions
    };
  },

  /**
   * Cancels a show.
   *
   * @param {RequestEvent} locals - The request event object containing the necessary local variables.
   * @throws {Error} Throws an error with a status code of 404 and a message of 'Show not found' if the show is not found.
   * @return {Promise<{ success: boolean, show: object, showPermissions: object }>} Returns a promise that resolves to an object with the following properties:
   *   - success: A boolean indicating the success of the cancellation.
   *   - show: The cancelled show as a JSON object.
   *   - showPermissions: The permissions for the cancelled show.
   */
  cancel_show: async ({ locals }: RequestEvent) => {
    const redisConnection = locals.redisConnection as IORedis;
    const show = locals.show as ShowDocument;
    if (!show) {
      throw error(404, 'Show not found');
    }
    const showService = createShowActor({
      show,
      redisConnection
    });
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

    showService.send(cancelEvent);
    const ss = showService.getSnapshot();
    showService.stop();
    const showPermissions = getShowPermissions(ss);

    return {
      success: true,
      show: show.toJSON({ flattenMaps: true, flattenObjectIds: true }),
      showPermissions
    };
  },

  /**
   * Ends a show.
   *
   * @param {object} locals - The local variables object.
   * @param {ShowDocument} locals.show - The show document.
   * @param {IORedis} locals.redisConnection - The Redis connection.
   * @throws {Error} Throws an error with a status code of 404 and a message of 'Show ID not found' if the show is not found.
   * @return {Promise<{ success: boolean, showPermissions: object }>} Returns a promise that resolves to an object with the following properties:
   *   - success: A boolean indicating the success of the operation.
   *   - showPermissions: The permissions for the ended show.
   */
  end_show: async ({ locals }) => {
    const show = locals.show as ShowDocument;
    if (show === null) {
      throw error(404, 'Show ID not found');
    }
    const redisConnection = locals.redisConnection as IORedis;
    const showService = createShowActor({
      show,
      redisConnection
    });
    showService.send({
      type: 'SHOW ENDED'
    });
    const showState = showService.getSnapshot();
    const showPermissions = getShowPermissions(showState);
    showService.stop();

    return {
      success: true,
      showPermissions
    };
  },

  /**
   * Handles the request for a payout. Validates the request form data using the `requestPayoutSchema` schema.
   * If the form is valid, creates a new payout job and adds it to the payout queue.
   *
   * @param {RequestEvent} locals - The request event containing the locals and request data.
   * @return {Promise<{ success: boolean, form: object } | { success: boolean, message: string }>} - A promise that resolves to an object with the following properties:
   *   - success: A boolean indicating the success of the operation.
   *   - form: The form data if the operation fails.
   *   - message: A message indicating the success or failure of the operation.
   */
  request_payout: async ({ locals, request }: RequestEvent) => {
    const form = await superValidate(request, zod(requestPayoutSchema));
    const { walletId, amount, destination, payoutReason, jobType } = form.data;

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      const connection = locals.redisConnection as IORedis;
      const payoutQueue = new Queue(EntityType.PAYOUT, {
        connection
      }) as PayoutQueueType;

      payoutQueue.add(jobType, {
        walletId,
        amount,
        destination,
        payoutReason
      });

      payoutQueue.close();
    } catch {
      return message(form, 'Error requesting payout');
    }
    return message(form, 'Payout requested successfully');
  },

  /**
   * Ends a show and returns the permissions for the creator.
   *
   * @param {RequestEvent} locals - The locals object containing the request event.
   * @return {Promise<{ success: boolean, showPermissions: object }>} - A promise that resolves to an object with the following properties:
   *   - success: A boolean indicating the success of the operation.
   *   - showPermissions: The permissions for the creator.
   * @throws {Error} Throws an error with a status code of 404 and a message of 'Show not found' if the show is not found.
   */
  leave_show: async ({ locals }: RequestEvent) => {
    const redisConnection = locals.redisConnection as IORedis;
    const show = locals.show;
    if (!show) {
      throw error(404, 'Show not found');
    }

    const showService = createShowActor({
      show,
      redisConnection
    });

    showService.send({ type: 'SHOW STOPPED' });
    const showState = showService.getSnapshot();
    const showPermissions = getShowPermissions(showState);

    showService.stop();
    console.log('Creator left show');
    return { success: true, showPermissions };
  },

  /**
   * Starts a show and returns the permissions for the creator.
   *
   * @param {RequestEvent} locals - The locals object containing the request event.
   * @return {Promise<{ success: boolean, showPermissions: object }>} - A promise that resolves to an object with the following properties:
   *   - success: A boolean indicating the success of the operation.
   *   - showPermissions: The permissions for the creator.
   * @throws {Error} Throws an error with a status code of 404 and a message of 'Show not found' if the show is not found.
   */
  start_show: async ({ locals }: RequestEvent) => {
    const show = locals.show as ShowDocument;
    const redisConnection = locals.redisConnection as IORedis;
    if (!show) {
      throw error(404, 'Show not found');
    }
    const showService = createShowActor({
      show,
      redisConnection
    });
    showService.send({
      type: 'SHOW STARTED'
    });
    const showState = showService.getSnapshot();
    const showPermissions = getShowPermissions(showState);
    showService.stop();
    return {
      success: true,
      showPermissions
    };
  },

  /**
   * Upserts a room based on the provided form data.
   *
   * @param {RequestEvent} params - The request event containing the locals and request data.
   * @return {Promise<{ form: SuperValidated<z.infer<typeof roomCRUDSchema>> }>} - A promise that resolves to an object containing the form data.
   * @throws {Error} Throws an error with a status code of 404 and a message of 'Room not found' if the room is not found.
   * @throws {Error} Throws an error with a status code of 500 and a message of 'Error upserting room' if there is an error upserting the room.
   */
  upsert_room: async ({ locals, request }: RequestEvent) => {
    const creator = locals.creator as CreatorDocument;
    const data = await request.formData();

    const form = (await superValidate(
      data,
      zod(roomCRUDSchema)
    )) as SuperValidated<z.infer<typeof roomCRUDSchema>>;

    const isUpdate = form.data.id ? true : false;
    const image = data.get('image') && (data.get('image') as unknown as [File]);

    if (!form.valid) {
      return fail(400, { form });
    }

    if (image instanceof File && image.size > 0) {
      // upload image to web3
      const url = await ipfsUpload(image);
      form.data.bannerImageUrl = url;
    }

    delete form.data.image; // remove image from form
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const _id = form.data.id ? new ObjectId(form.data.id) : new ObjectId();
    delete form.data.id;
    Room.init();

    // check if unique url exists
    const existingRoom = await Room.findOne({ uniqueUrl: form.data.uniqueUrl });
    if (existingRoom && !isUpdate)
      // @ts-ignore
      return setError(form, 'uniqueUrl', 'Room URL already exists');
    if (!existingRoom && isUpdate) {
      const room = (await Room.findOneAndUpdate(
        { _id },
        {
          uniqueUrl: form.data.uniqueUrl
        },
        { new: true }
      )) as RoomDocument;
      if (!room) {
        return message(form, 'Room not found', { status: 404 });
      }
    }

    try {
      if (isUpdate) {
        // update room
        const room = (await Room.findOneAndUpdate(
          { _id },
          {
            name: form.data.name,
            bannerImageUrl: form.data.bannerImageUrl,
            tagLine: form.data.tagLine,
            announcement: form.data.announcement
          },
          { new: true }
        )) as RoomDocument;
        if (!room) {
          return message(form, 'Room not found', { status: 404 });
        }
        return { form };
      } else {
        // insert new room
        const room = (await Room.create({
          ...form.data,
          _id
        })) as RoomDocument;
        Creator.updateOne(
          { _id: creator._id },
          {
            $set: {
              room: room._id
            }
          }
        ).exec();
        return { form };
      }
    } catch (error_) {
      console.error(error_);
      throw error(500, 'Error upserting room');
    }
  }
};

/**
 * Load function for the creator page.
 * @param {RequestEvent} event - The request event.
 * @returns {Promise<{
 *   payoutForm: SuperValidated<z.infer<typeof requestPayoutSchema>>,
 *   createShowForm: SuperValidated<z.infer<typeof showCRUDSchema>>,
 *   roomForm: SuperValidated<z.infer<typeof roomCRUDSchema>>,
 *   creator: CreatorDocument,
 *   user: UserDocument | undefined,
 *   show: ShowDocument | undefined,
 *   showEvent: ShowEventDocument | undefined,
 *   completedShows: ShowDocument[],
 *   showPermissions: ShowPermissionsType,
 *   wallet: WalletDocument,
 *   exchangeRate: string | undefined,
 *   jitsiToken: string | undefined,
 *   room: RoomDocument | undefined
 * }>}
 */
export const load: PageServerLoad = async ({
  locals
}: RequestEvent): Promise<{
  payoutForm: SuperValidated<z.infer<typeof requestPayoutSchema>>;
  createShowForm: SuperValidated<z.infer<typeof showCRUDSchema>>;
  roomForm: SuperValidated<z.infer<typeof roomCRUDSchema>>;
  creator: CreatorDocument;
  user: UserDocument | undefined;
  show: ShowDocument | undefined;
  showEvent: ShowEventDocument | undefined;
  completedShows: ShowDocument[];
  showPermissions: ShowPermissionsType;
  wallet: WalletDocument;
  exchangeRate: string | undefined;
  jitsiToken: string | undefined;
  room: RoomDocument | undefined;
}> => {
  const creator: CreatorDocument = locals.creator!;
  const user: UserDocument | undefined = locals.user;
  if (!creator) {
    throw error(404, 'Creator not found');
  }

  const [show, room, showEvent, completedShows, wallet] = await Promise.all([
    Show.findOne({
      creator: creator._id,
      'showState.current': true
    }).exec() as Promise<ShowDocument | undefined>,
    Room.findById(creator.room).exec() as Promise<RoomDocument | undefined>,
    ShowEvent.findOne({
      show: creator._id
    })
      .sort({ createdAt: -1 })
      .limit(1)
      .exec() as Promise<ShowEventDocument | undefined>,
    Show.find({
      creator: creator._id,
      'showState.status': ShowStatus.FINALIZED
    })
      .sort({ 'showState.finalize.finalizedAt': -1 })
      .limit(10)
      .exec() as Promise<ShowDocument[]>,
    locals.wallet as WalletDocument
  ]);

  const token: string = await createBitcartToken(
    env.BITCART_EMAIL || '',
    env.BITCART_PASSWORD || '',
    env.BITCART_API_URL || ''
  );

  let jitsiToken: string | undefined;
  if (show) {
    jitsiToken = jwt.sign(
      {
        aud: 'jitsi',
        iss: env.JITSI_APP_ID,
        exp: Math.floor(Date.now() / 1000) + +(env.JWT_EXPIRY || 3600),
        sub: pubEnvironment.PUBLIC_JITSI_DOMAIN,
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
      env.JITSI_JWT_SECRET || ''
    );
  }
  const showPermissions: ShowPermissionsType = getShowPermissionsFromShow({
    show,
    redisConnection: locals.redisConnection as IORedis
  });

  const response = await rateCryptosRateGet(
    {
      currency: wallet!.currency as CurrencyType,
      fiat_currency: CurrencyType.USD
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  const exchangeRate: string | undefined = response?.data as string | undefined;

  const roomForm: SuperValidated<z.infer<typeof roomCRUDSchema>> = room
    ? await superValidate(
        room.toJSON({
          flattenMaps: true,
          flattenObjectIds: true
        }),
        zod(roomCRUDSchema)
      )
    : ((await superValidate(
        {
          uniqueUrl: nanoid(12),
          name: possessive(creator.user.name, 'en') + ' Room'
        },
        zod(roomCRUDSchema)
      )) as SuperValidated<z.infer<typeof roomCRUDSchema>>);

  const showName: string = creator.user.name + ' Show';

  const createShowForm: SuperValidated<z.infer<typeof showCRUDSchema>> =
    await superValidate(
      {
        name: showName
      },
      zod(showCRUDSchema),
      {
        errors: false
      }
    );

  const payoutForm: SuperValidated<z.infer<typeof requestPayoutSchema>> =
    await superValidate(
      {
        amount: 0,
        destination: user?.address,
        walletId: wallet!._id.toString(),
        payoutReason: PayoutReason.CREATOR_PAYOUT,
        jobType: PayoutJobType.CREATE_PAYOUT
      },
      zod(requestPayoutSchema),
      { errors: false }
    );

  return {
    payoutForm,
    createShowForm,
    roomForm,
    creator: creator.toJSON({
      flattenMaps: true,
      flattenObjectIds: true
    }),
    user: user?.toJSON({ flattenMaps: true, flattenObjectIds: true }),
    show: show?.toJSON({ flattenMaps: true, flattenObjectIds: true }),
    showEvent: showEvent?.toJSON({ flattenMaps: true, flattenObjectIds: true }),
    completedShows: completedShows.map((show) =>
      show.toJSON({ flattenMaps: true, flattenObjectIds: true })
    ),
    showPermissions,
    wallet: wallet?.toJSON({ flattenMaps: true, flattenObjectIds: true }),
    exchangeRate,
    jitsiToken,
    room: room?.toJSON({ flattenMaps: true, flattenObjectIds: true })
  };
};

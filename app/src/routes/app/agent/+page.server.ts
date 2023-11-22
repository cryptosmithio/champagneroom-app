import console from 'node:console';

import { error, fail } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { nanoid } from 'nanoid';
import { generateSillyPassword } from 'silly-password-generator';
import spacetime from 'spacetime';
import { uniqueNamesGenerator } from 'unique-names-generator';

import { PASSWORD_SALT } from '$env/static/private';

import { Creator } from '$lib/models/creator';
import { Show } from '$lib/models/show';
import { User } from '$lib/models/user';
import { Wallet } from '$lib/models/wallet';

import Config from '$lib/config';
import { AuthType, EntityType } from '$lib/constants';
import { womensNames } from '$lib/womensNames';

import type { Actions, PageServerLoad } from './$types';

export const actions: Actions = {
  create_creator: async ({ request }) => {
    const data = await request.formData();
    const agentId = data.get('agentId') as string;
    let name = data.get('name') as string;
    const commission = data.get('commission') as string;

    // Validation
    if (!name || name.length < 3 || name.length > 50) {
      name = uniqueNamesGenerator({
        dictionaries: [womensNames]
      });
    }
    if (Number.isNaN(+commission) || +commission < 0 || +commission > 100) {
      return fail(400, { commission, badCommission: true });
    }

    try {
      const password = generateSillyPassword({
        wordCount: 2
      });
      const secret = nanoid();

      const wallet = new Wallet();
      await wallet.save();

      const user = await User.create({
        name,
        authType: AuthType.PATH_PASSWORD,
        secret,
        wallet: wallet._id,
        roles: [EntityType.CREATOR],
        password: `${password}${PASSWORD_SALT}`
      });
      const creator = await Creator.create({
        user: user._id,
        agentCommission: +commission,
        agent: agentId,
        profileImageUrl: Config.UI.defaultProfileImage
      });
      return {
        success: true,
        creator: creator?.toObject({
          flattenObjectIds: true,
          flattenMaps: true
        }),
        password
      };
    } catch (error: unknown) {
      console.error('err', error);
      if (error instanceof Error) {
        return fail(400, { err: error.toString() });
      }
      return fail(400, { err: error });
    }
  },
  update_creator: async ({ request }) => {
    const data = await request.formData();
    const creatorId = data.get('creatorId') as string;
    const name = data.get('name') as string;
    const commission = data.get('commission') as string;
    const active = data.get('active') as string;

    // Validation
    if (creatorId === null) {
      return fail(400, { creatorId, missingCreatorId: true });
    }
    if (Number.isNaN(+commission) || +commission < 0 || +commission > 100) {
      return fail(400, { commission, badCommission: true });
    }

    if (active !== 'true' && active !== 'false') {
      return fail(400, { active, badActive: true });
    }

    try {
      const creator = await Creator.findOneAndUpdate(
        {
          _id: new ObjectId(creatorId)
        },
        {
          agentCommission: +commission
        },
        {
          new: true
        }
      );
      if (!creator) {
        return fail(400, { creatorId, missingCreatorId: true });
      }

      await User.findOneAndUpdate(
        {
          _id: creator.user._id
        },
        {
          name,
          active: active === 'true'
        }
      );
    } catch (error) {
      console.error('err', error);
      return fail(400, { err: error });
    }

    return {
      success: true
    };
  },
  change_user_secret: async ({ request }) => {
    const data = await request.formData();
    const userId = data.get('userId') as string;

    const password = generateSillyPassword({
      wordCount: 2
    });

    // Validation
    if (userId === null) {
      return fail(400, { userId, missingUserId: true });
    }

    const secret = nanoid();
    const user = await User.findById(userId);
    if (!user) {
      return fail(400, { userId, missingUserId: true });
    }
    user.secret = secret;
    user.password = `${password}${PASSWORD_SALT}`;
    user.save();

    return { success: true, secret, password };
  }
};

export const load: PageServerLoad = async ({ locals }) => {
  const agent = locals.agent;
  const user = locals.user;
  const wallet = locals.wallet;
  if (!agent) {
    throw error(404, 'Agent not found');
  }

  let creators = await Creator.find({ agent: agent._id });
  creators = creators.sort((a, b) => {
    if (a.user.name < b.user.name) {
      return -1;
    }
    if (a.user.name > b.user.name) {
      return 1;
    }
    return 0;
  });
  const now = spacetime.now();
  const range = {
    start: now.startOf('month').epoch,
    end: now.endOf('month').epoch
  };

  const showData = await Show.aggregate([
    {
      $match: {
        'showState.finalize.finalizedAt': {
          $gte: range.start,
          $lte: range.end
        },
        agent: agent._id
      }
    },
    {
      $project: {
        'showState.salesStats.ticketSalesAmount': 1,
        creator: 1
      }
    },
    {
      $group: {
        _id: '$creator',
        amount: {
          $sum: '$showState.salesStats.ticketSalesAmount.amount'
        }
      }
    }
  ]);

  return {
    agent: agent.toObject({ flattenObjectIds: true, flattenMaps: true }),
    user: user
      ? user.toObject({ flattenObjectIds: true, flattenMaps: true })
      : undefined,
    creators: creators.map((creator) =>
      creator.toObject({ flattenObjectIds: true, flattenMaps: true })
    ),
    wallet: wallet
      ? wallet.toObject({ flattenObjectIds: true, flattenMaps: true })
      : undefined,
    showData: showData.map((show) => ({
      creator: show._id[0],
      currency: show._id[1],
      amount: show.amount
    }))
  };
};

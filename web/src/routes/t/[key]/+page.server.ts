import {
  JWT_EXPIRY,
  JWT_TALENT_DB_SECRET,
  JWT_TALENT_DB_USER,
} from '$env/static/private';
import { masterDB } from '$lib/ORM/dbs/masterDB';
import type { ShowDocument } from '$lib/ORM/models/show';
import { createShowMachineService } from '$lib/machines/showMachine';
import { error, fail } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const key = params.key;

  if (key === null) {
    throw error(404, 'Key not found');
  }

  const token = jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + +JWT_EXPIRY,
      sub: JWT_TALENT_DB_USER,
    },
    JWT_TALENT_DB_SECRET,
    { keyid: JWT_TALENT_DB_USER }
  );

  const db = await masterDB();
  const _talent = await db.talents.findOne().where('key').eq(key).exec();
  if (!_talent) {
    throw error(404, 'Talent not found');
  }

  await _talent.updateStats();
  const _currentShow = (await _talent.populate('currentShow')) as ShowDocument;
  const _completedShows = (await _talent.populate(
    'stats.completedShows'
  )) as ShowDocument[];
  const talent = _talent.toJSON();
  const currentShow = _currentShow ? _currentShow.toJSON() : undefined;
  const completedShows = _completedShows.map(link => link.toJSON());

  return {
    token,
    talent,
    currentShow,
    completedShows,
  };
};

export const actions: Actions = {
  update_profile_image: async ({
    params,
    request,
  }: import('./$types').RequestEvent) => {
    const key = params.key;
    if (key === null) {
      throw error(404, 'Key not found');
    }
    const data = await request.formData();
    const url = data.get('url') as string;
    if (!url) {
      return fail(400, { url, missingUrl: true });
    }
    const db = await masterDB();
    const talent = await db.talents.findOne().where('key').eq(key).exec();
    if (!talent) {
      throw error(404, 'Talent not found');
    }
    talent.update({
      $set: {
        profileImageUrl: url,
        updatedAt: new Date().getTime(),
      },
    });
    if (talent.currentShow) {
      const currentShow = await talent.populate('currentShow');
      currentShow.update({
        $set: {
          talentInfo: {
            ...currentShow.talentInfo,
            profileImageUrl: url,
          },
          updatedAt: new Date().getTime(),
        },
      });
    }
    return { success: true };
  },
  create_show: async ({ params, request }) => {
    const key = params.key;
    if (key === null) {
      throw error(404, 'Key not found');
    }
    const data = await request.formData();
    const price = data.get('price') as string;
    const name = data.get('name') as string;
    const duration = data.get('duration') as string;
    const maxNumTickets = data.get('maxNumTickets') as string;

    if (!name || name.length < 3 || name.length > 50) {
      return fail(400, { name, badName: true });
    }

    if (!price) {
      return fail(400, { price, missingPrice: true });
    }
    if (isNaN(+price) || +price < 1 || +price > 10000) {
      return fail(400, { price, invalidPrice: true });
    }

    const db = await masterDB();
    const talent = await db.talents.findOne().where('key').eq(key).exec();
    if (!talent) {
      throw error(404, 'Talent not found');
    }
    const show = await talent.createShow({
      price: +price,
      name,
      duration: +duration,
      maxNumTickets: +maxNumTickets,
    });

    return {
      show: show.toJSON(),
      success: true,
    };
  },
  cancel_show: async ({ params }) => {
    const key = params.key;
    if (key === null) {
      throw error(404, 'Key not found');
    }

    const db = await masterDB();
    const talent = await db.talents.findOne().where('key').eq(key).exec();
    if (!talent) {
      throw error(404, 'Talent not found');
    }
    const cancelShow = (await talent.populate('currentShow')) as ShowDocument;
    if (!cancelShow) {
      throw error(404, 'Show not found');
    }

    const showService = createShowMachineService(
      cancelShow.showState,
      cancelShow.saveShowStateCallBack
    );
    showService.send({
      type: 'REQUEST CANCELLATION',
    });
    return { success: true };
  },
  send_refunds: async ({ params }) => {
    const key = params.key;
    if (key === null) {
      throw error(404, 'Key not found');
    }

    const db = await masterDB();
    const talent = await db.talents.findOne().where('key').eq(key).exec();
    if (!talent) {
      throw error(404, 'Talent not found');
    }
    const refundShow = (await talent.populate('currentShow')) as ShowDocument;
    if (!refundShow) {
      throw error(404, 'Show not found');
    }

    const showService = createShowMachineService(
      refundShow.showState,
      refundShow.saveShowStateCallBack
    );
    const state = showService.getSnapshot();

    if (!state.matches('requestedCancellation.waiting4Refund')) {
      return error(400, 'Show cannot be refunded');
    }

    return { success: true };
  },
};

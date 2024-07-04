import { error } from '@sveltejs/kit';

import { Creator } from '$lib/models/creator';
import { Room } from '$lib/models/room';

import type { PageServerLoad } from './$types';

/**
 * Loads the data required for the room page.
 *
 * @param params - The parameters passed to the route.
 * @param locals - The local variables available in the route.
 * @returns An object containing the user, room, and creator data.
 * @throws {Error} If the room or creator is not found.
 */
export const load: PageServerLoad = (async ({ params, locals }) => {
  const uniqueUrl = encodeURIComponent(params.uniqueUrl);
  const user = locals.user;

  const room = await Room.findOne({
    uniqueUrl: uniqueUrl
  })
    .orFail(() => {
      throw error(404, 'Room not found');
    })
    .exec();

  const creator = await Creator.findOne({
    room: room._id
  })
    .orFail(() => {
      throw error(404, 'Creator not found');
    })
    .exec();

  return {
    user: user
      ? user.toJSON({ flattenMaps: true, flattenObjectIds: true })
      : undefined,
    room: room
      ? room.toJSON({ flattenMaps: true, flattenObjectIds: true })
      : undefined,
    creator: creator
      ? creator.toJSON({ flattenMaps: true, flattenObjectIds: true })
      : undefined
  };
}) satisfies PageServerLoad;

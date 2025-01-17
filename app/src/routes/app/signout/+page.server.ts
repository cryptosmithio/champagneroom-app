import { error } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

import type { PageServerLoad } from './$types';

const tokenName = env.AUTH_TOKEN_NAME || 'token';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
  const returnPath = url.searchParams.get('returnPath');
  locals.user = undefined;
  if (!returnPath) {
    throw error(400, 'Missing Return Path');
  }

  cookies.delete(tokenName, { path: '/' });
  return {
    returnPath,
    isAuthenticated: false
  };
};

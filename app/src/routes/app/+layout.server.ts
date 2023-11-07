import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user;
  const isAuthenticated = user === undefined ? false : true;
  const authType = user?.authType;
  return {
    isAuthenticated,
    authType
  };
};

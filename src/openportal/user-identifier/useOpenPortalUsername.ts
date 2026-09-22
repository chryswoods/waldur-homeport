import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  openportalUserinfoMeRetrieve,
  openportalUserinfoRetrieve,
  openportalUserinfoSetShortnameUpdate,
  User,
} from 'waldur-js-client';

import { translate } from '@/i18n';
import { useNotify } from '@/store/notify';
import { useUser } from '@/workspace/hooks';

export const OPENPORTAL_USERNAME_QUERY_KEY = 'openportal-user-shortname';

/**
 * The OpenPortal username for a user, and the one-shot call that sets it.
 *
 * Reading uses `openportal-userinfo`, not `user.slug`: mastermind mirrors the
 * shortname onto the slug, but Waldur also auto-populates slugs, so an empty
 * slug does not prove the user has never chosen a username. Only `shortname`
 * distinguishes "not yet set" from "set", and that distinction is what decides
 * whether the field is editable.
 *
 * (For merely *displaying* another user's OpenPortal username in a list, the
 * mirrored `user_slug` already carried on those serializers is the right
 * source — no per-row request needed. This hook is for the profile, where the
 * set-once state matters.)
 */
export const useOpenPortalUsername = (user: User) => {
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const { showErrorResponse, showSuccess } = useNotify();

  const isSelf = currentUser?.uuid === user.uuid;

  const { data, isLoading, error } = useQuery({
    queryKey: [OPENPORTAL_USERNAME_QUERY_KEY, user.uuid],
    queryFn: async () => {
      // `me/` needs no identifier and is the only route guaranteed reachable
      // for one's own record; the detail route is used when staff view someone
      // else. Both auto-create the row, so neither 404s for a valid user.
      const { data } = isSelf
        ? await openportalUserinfoMeRetrieve()
        : await openportalUserinfoRetrieve({
            path: { user: user.uuid },
          });
      return data;
    },
  });

  const setShortname = async (shortname: string) => {
    try {
      await openportalUserinfoSetShortnameUpdate({
        path: { user: user.uuid },
        body: { shortname },
      });
      await queryClient.invalidateQueries({
        queryKey: [OPENPORTAL_USERNAME_QUERY_KEY, user.uuid],
      });
      showSuccess(translate('Username has been set.'));
    } catch (e) {
      // The endpoint now answers a rejection with `{"shortname": [...]}`
      // naming the rule that failed — the character rules, the length bounds,
      // the reserved words, uniqueness, or an attempt to change one already
      // set. `showErrorResponse` appends that to the message below, so this
      // only has to say what failed, not guess why.
      showErrorResponse(e, translate('Username could not be set.'));
      throw e;
    }
  };

  return {
    shortname: data?.shortname ?? null,
    isLoading,
    error,
    setShortname,
  };
};

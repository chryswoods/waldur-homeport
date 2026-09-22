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
 * The one place that works around the `{user}` path parameter's wrong type.
 *
 * The generated client declares `path: { user: number }`, but
 * `UserInfoViewSet` sets `lookup_field = "user"` and resolves it with
 * `User.objects.get(uuid=user)` — the segment is a UUID string. HomePort has
 * no numeric user id at all, so an integer here could never be produced. This
 * is a drf-spectacular misinference rather than a real API contract.
 *
 * Kept as one named, greppable helper rather than casts at the call sites, so
 * that it is obvious what is being worked around and easy to delete. Remove it
 * once the mastermind action annotates its path parameter as a UUID and the
 * SDK is regenerated: the calls below should then typecheck unchanged.
 */
const userPathParam = (uuid: string) => uuid as unknown as number;

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
            path: { user: userPathParam(user.uuid) },
          });
      return data;
    },
  });

  const setShortname = async (shortname: string) => {
    try {
      await openportalUserinfoSetShortnameUpdate({
        path: { user: userPathParam(user.uuid) },
        // `user` is required by the generated type only because the request
        // body was inferred from the model serializer. Mastermind now declares
        // `SetUserShortnameSerializer`, whose only field is `shortname`, so
        // this property should be dropped when the SDK is next regenerated —
        // at which point it becomes a type error and says so.
        body: { shortname, user: user.url },
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

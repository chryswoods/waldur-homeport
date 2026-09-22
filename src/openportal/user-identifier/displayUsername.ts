import { isFeatureVisible } from '@/features/connect';
import { UserFeatures } from '@/FeaturesEnums';

/**
 * Whether this deployment identifies users by their OpenPortal username.
 *
 * Where it does, `user.username` is not the name anyone recognises — a
 * deployment may set it to the email address, or take it from whatever the
 * identity provider supplies — while `user.slug` carries the OpenPortal
 * username, mirrored there from the `shortname` on `openportal-userinfo` and
 * fixed once set.
 */
export const usesOpenPortalUsername = (): boolean =>
  isFeatureVisible(UserFeatures.show_openportal_identifier);

interface UsernameSource {
  username?: string | null;
  slug?: string | null;
}

/**
 * The username to show for a user in a list.
 *
 * Returns `undefined` when there is nothing to show, which callers render as a
 * dash. An absent slug means the user has not chosen an OpenPortal username
 * yet, and showing `user.username` in its place would put an email — or an
 * identity-provider identifier — under a "Username" heading, which is the
 * confusion this replaces. Say nothing rather than say the wrong thing.
 *
 * Empty counts as absent, not only null: `User.slug` is a non-null
 * `SlugField`, so a slug that mastermind has cleared — because the user never
 * chose a shortname — arrives as `''` rather than `null`.
 */
export const getDisplayUsername = ({
  username,
  slug,
}: UsernameSource): string | undefined =>
  usesOpenPortalUsername() ? slug || undefined : username || undefined;

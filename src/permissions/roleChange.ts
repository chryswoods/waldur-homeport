/**
 * The expiry part of a role change: left out when the form kept the old
 * role's expiry, so the backend carries it over; else the new date, or null
 * for a role that never expires.
 */
export const changedExpiry = (
  expirationTime: string | null | undefined,
  previous: string | null | undefined,
): { expiration_time?: string | null } =>
  (expirationTime || null) === (previous || null)
    ? {}
    : { expiration_time: expirationTime || null };

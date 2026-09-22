/**
 * Policy helpers for OpenPortal award details.
 *
 * These mirror business logic that is authoritative in the OpenPortal service
 * (written in Rust) so that React components do not re-implement policy
 * decisions. The types they operate on are the generated ones from
 * waldur-js-client; only the logic lives here.
 *
 * This replaces the fork's hand-written src/openportal/bindings/ directory.
 * Every type in it — AwardDetails, MembershipControl, Link, Note and the rest
 * — is now generated, and MembershipControlEnum is character-for-character the
 * union the hand-written MembershipControl declared. The helpers below are the
 * only part of bindings/ that had no generated equivalent.
 */

import type { AwardDetails, MembershipControlEnum } from 'waldur-js-client';

/**
 * True if the receiving portal may add or remove members.
 *
 * Mirrors `MembershipControl::can_change_membership`: true for `open` and
 * `members_only`, false for `roles_only` and `locked`. An absent control is
 * treated as `open`, matching the service's default when the field is unset.
 */
export function canChangeMembership(
  control: MembershipControlEnum | null | undefined,
): boolean {
  return control == null || control === 'open' || control === 'members_only';
}

/**
 * True if the receiving portal may change the role of an existing member.
 *
 * Mirrors `MembershipControl::can_change_roles`: true for `open` and
 * `roles_only`, false for `members_only` and `locked`. An absent control is
 * treated as `open`.
 */
export function canChangeRoles(
  control: MembershipControlEnum | null | undefined,
): boolean {
  return control == null || control === 'open' || control === 'roles_only';
}

/**
 * Tests a bare domain against one entry of an `allowed_domains` list.
 * Mirrors `DomainPattern::matches`; email-pattern entries are ignored.
 *
 *   - `*.example.com` matches any subdomain at any depth.
 *   - `example.com` matches exactly, case-insensitively.
 */
function matchesDomainPattern(pattern: string, domain: string): boolean {
  if (pattern.startsWith('*.')) {
    return domain.toLowerCase().endsWith(pattern.slice(1).toLowerCase());
  }
  return domain.toLowerCase() === pattern.toLowerCase();
}

/**
 * True if `email` is permitted by an award's `allowed_domains`.
 *
 * Mirrors `AwardDetails::is_email_allowed`: a null list permits everything, an
 * empty list permits nothing, and otherwise at least one entry must match —
 * an entry containing `@` against the whole address, any other entry against
 * the domain part.
 */
export function isEmailAllowed(
  allowedDomains: AwardDetails['allowed_domains'],
  email: string,
): boolean {
  if (allowedDomains === null || allowedDomains === undefined) return true;
  if (allowedDomains.length === 0) return false;

  const atIdx = email.indexOf('@');
  const domain = atIdx >= 0 ? email.slice(atIdx + 1) : '';

  for (const pattern of allowedDomains) {
    if (pattern.includes('@')) {
      if (pattern.toLowerCase() === email.toLowerCase()) return true;
    } else if (domain && matchesDomainPattern(pattern, domain)) {
      return true;
    }
  }

  return false;
}

/**
 * True if the bare `domain` (no `@`) is permitted by `allowed_domains`.
 * Email-pattern entries are ignored. Mirrors `AwardDetails::is_domain_allowed`.
 */
export function isDomainAllowed(
  allowedDomains: AwardDetails['allowed_domains'],
  domain: string,
): boolean {
  if (allowedDomains === null || allowedDomains === undefined) return true;
  if (allowedDomains.length === 0) return false;

  for (const pattern of allowedDomains) {
    if (!pattern.includes('@') && matchesDomainPattern(pattern, domain)) {
      return true;
    }
  }

  return false;
}

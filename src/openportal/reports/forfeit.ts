import { translate } from '@/i18n';

/**
 * A spend profile's forfeit, as usage reports carry it: ordinary usage by
 * the local user `forfeit` (user identifier `forfeit.<project>.<portal>`),
 * under the component `forfeit`, on the last day of the period it was
 * charged for. It counts in the totals, but it is not a person and not a
 * job. No person can have the name: Waldur refuses the shortname `forfeit`.
 */
export const FORFEIT = 'forfeit';

/** A neutral grey, apart from the people's palette. */
export const FORFEIT_COLOUR = '#7a7f87';

/** Whether a local username or user identifier is the forfeit. */
export const isForfeitUser = (id?: string | null): boolean =>
  Boolean(id) && (id === FORFEIT || id.startsWith(`${FORFEIT}.`));

/** Whether a usage component is the forfeit. */
export const isForfeitComponent = (name?: string | null): boolean =>
  name === FORFEIT;

/** How the forfeit is named wherever people are listed. */
export const forfeitUserLabel = (): string =>
  translate('Forfeit (spend profile)');

/** A component's name for display: the forfeit's, or the name capitalised. */
export const componentLabel = (name: string): string =>
  isForfeitComponent(name)
    ? translate('Forfeit')
    : name.charAt(0).toUpperCase() + name.slice(1);

/** The items with the forfeit's moved to the end, the rest in order. */
export const forfeitLast = <T>(items: T[], idOf: (item: T) => string): T[] => [
  ...items.filter((item) => !isForfeitUser(idOf(item))),
  ...items.filter((item) => isForfeitUser(idOf(item))),
];

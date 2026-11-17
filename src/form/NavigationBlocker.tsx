import { useRouter } from '@uirouter/react';
import { useEffect } from 'react';
import { useFormState } from 'react-final-form';

import { translate } from '@/i18n';
import { useModal } from '@/modal/actions';

interface NavigationBlockerProps {
  /** The route state whose exit is guarded. */
  exiting: string;
  /**
   * Which dirty fields count as unsaved work. Fields a page fills on its own,
   * rather than the user typing them, can be left out. All by default.
   */
  isTracked?: (field: string) => boolean;
  /**
   * Also ask before a refresh or closing the tab. That prompt is the
   * browser's own: its wording and buttons cannot be changed.
   */
  warnOnUnload?: boolean;
}

/** How long a page waits before taking a navigation it asked for as cancelled. */
export const STILL_HERE_MS = 1500;

let leavingDeliberately = false;

/**
 * Leaves for another site in this tab without the unsaved-changes prompt,
 * for a page that has just saved its work (the form only stops counting as
 * changed once it re-renders, which can be after the navigation starts).
 * Calls `onStayed` when the page is still here a moment later: a navigation
 * the browser cancelled or never made leaves no other trace.
 */
export const leavePage = (url: string, onStayed?: () => void) => {
  leavingDeliberately = true;
  window.location.assign(url);
  setTimeout(() => {
    leavingDeliberately = false;
    onStayed?.();
  }, STILL_HERE_MS);
};

/** Whether any tracked field differs from the form's starting values. */
export const hasUnsavedChanges = (
  dirtyFields: Record<string, boolean>,
  isTracked?: (field: string) => boolean,
) =>
  Object.keys(dirtyFields).some(
    (field) => dirtyFields[field] && (!isTracked || isTracked(field)),
  );

/** Asks before leaving a form with unsaved changes. Render inside the form. */
export const NavigationBlocker = ({
  exiting,
  isTracked,
  warnOnUnload,
}: NavigationBlockerProps) => {
  const router = useRouter();
  const { confirm } = useModal();
  const { dirtyFields, submitting, submitSucceeded } = useFormState({
    subscription: {
      dirtyFields: true,
      submitting: true,
      submitSucceeded: true,
    },
  });

  const blocking =
    hasUnsavedChanges(dirtyFields, isTracked) &&
    !submitting &&
    !submitSucceeded;

  useEffect(() => {
    if (!blocking) return;

    const deregister = router.transitionService.onBefore(
      { exiting },
      async () => {
        try {
          await confirm(
            translate('Unsaved changes'),
            translate(
              'You have unsaved changes. If you leave this page, your changes will be lost.',
            ),
            {
              size: 'sm',
              positiveButtonVariant: 'warning',
              positiveButton: translate('Leave page'),
              negativeButton: translate('Stay'),
            },
          );
          return true;
        } catch {
          return false;
        }
      },
    );

    return () => {
      deregister();
    };
  }, [blocking, exiting, router, confirm]);

  useEffect(() => {
    if (!blocking || !warnOnUnload) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingDeliberately) return;
      event.preventDefault();
      // Older browsers only prompt when returnValue is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [blocking, warnOnUnload]);

  return null;
};

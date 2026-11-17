import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CircleIcon,
} from '@phosphor-icons/react';
import { FC, ReactNode, useEffect, useState } from 'react';
import { ProposalFormStepStatus } from 'waldur-js-client';

import { BaseButton, Menu } from 'waldur-ui';

import { formatDateTime } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { leavePage } from '@/form/NavigationBlocker';
import { translate } from '@/i18n';
import { useNotify } from '@/store/notify';
import { ActionsMenu } from '@/table/ActionsDropdown';

/** What a set of Formbricks forms reports, for a proposal or a project. */
export interface FormsState {
  can_fill_in: boolean;
  steps: ProposalFormStepStatus[];
}

interface FormsCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  form: FormsState;
  /** Shown above the list, e.g. that the forms cannot be opened now. */
  notice?: ReactNode;
  /** A fresh single-use link to the step's form. */
  openLink(step: string): Promise<string>;
  /** Brings the answers in from Formbricks; resolves to how many. */
  fetchResponses(): Promise<number>;
  /**
   * Runs before a form opens, e.g. to save the page's own changes, which
   * leaving for the form would lose. Resolving false keeps the form shut;
   * it reports its own errors.
   */
  beforeOpen?(): Promise<boolean>;
  /** What the button says while beforeOpen runs. */
  beforeOpenLabel?: string;
}

/**
 * A list of Formbricks forms with their state, and a button each to fill
 * in, continue or edit one.
 *
 * Each button asks the backend for a single-use link and leaves for it in
 * this tab; the survey ends back on the page it was opened from. A link is
 * never kept: the backend reuses an open one, so a half-done form resumes,
 * and for an answered one gives a new link prefilled with the answers.
 */
export const FormsCard: FC<FormsCardProps> = ({
  title,
  subtitle,
  form,
  notice,
  openLink,
  fetchResponses,
  beforeOpen,
  beforeOpenLabel,
}) => {
  const { showSuccess, showErrorResponse } = useNotify();
  const [openingStep, setOpeningStep] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Back from Formbricks, a browser may restore this page as it was left,
  // with the button still opening.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setOpeningStep(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const openForm = async (step: string) => {
    setOpeningStep(step);
    if (beforeOpen) {
      setPreparing(true);
      const ready = await beforeOpen().catch(() => false);
      setPreparing(false);
      if (!ready) {
        setOpeningStep(null);
        return;
      }
    }
    try {
      // Should the browser not leave after all, the buttons work again.
      leavePage(await openLink(step), () => setOpeningStep(null));
    } catch (error) {
      showErrorResponse(error, translate('Unable to open the form.'));
      setOpeningStep(null);
    }
  };

  const fetchAnswers = async () => {
    setFetching(true);
    try {
      const fetched = await fetchResponses();
      showSuccess(
        fetched
          ? translate('Fetched {count} answers from Formbricks.', {
              count: fetched,
            })
          : translate('Your answers are up to date.'),
      );
    } catch (error) {
      showErrorResponse(error, translate('Unable to fetch your form answers.'));
    } finally {
      setFetching(false);
    }
  };

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      cardBordered
      className="mb-7"
      actions={
        form.can_fill_in ? (
          <ActionsMenu side="bottom" align="end">
            <Menu.Item
              icon={<ArrowsClockwiseIcon weight="bold" />}
              disabled={fetching}
              onSelect={fetchAnswers}
            >
              {translate('Fetch responses')}
            </Menu.Item>
          </ActionsMenu>
        ) : null
      }
    >
      {notice}
      <ul className="list-unstyled mb-0" aria-label={translate('Forms')}>
        {form.steps.map((step) => (
          <li
            key={step.key}
            className="d-flex justify-content-between align-items-center gap-3 py-3 border-bottom"
          >
            <div className="d-flex align-items-start gap-2">
              {step.completed ? (
                <CheckCircleIcon
                  size={20}
                  weight="fill"
                  className="text-success flex-shrink-0"
                  aria-label={translate('Answered')}
                />
              ) : (
                <CircleIcon
                  size={20}
                  weight="bold"
                  className="text-muted flex-shrink-0"
                  aria-label={translate('Not answered yet')}
                />
              )}
              <div>
                <div className="fw-bold">{step.label}</div>
                {step.completed && step.submitted_at ? (
                  <div className="text-muted fs-7">
                    {translate('Answered {date}', {
                      date: formatDateTime(step.submitted_at),
                    })}
                  </div>
                ) : step.in_progress ? (
                  <div className="text-muted fs-7">
                    {translate('Started, not finished yet')}
                  </div>
                ) : null}
              </div>
            </div>
            {form.can_fill_in && (
              <BaseButton
                variant={step.completed ? 'tertiary' : 'primary'}
                size="sm"
                pending={openingStep === step.key}
                disabled={Boolean(openingStep) && openingStep !== step.key}
                disabledReason={
                  openingStep && openingStep !== step.key
                    ? translate('Opening another form…')
                    : undefined
                }
                onClick={() => openForm(step.key)}
                label={
                  preparing && openingStep === step.key && beforeOpenLabel
                    ? beforeOpenLabel
                    : step.completed
                      ? translate('Edit')
                      : step.in_progress
                        ? translate('Continue')
                        : translate('Fill in')
                }
                aria-label={
                  step.completed
                    ? translate('Edit {form}', { form: step.label })
                    : step.in_progress
                      ? translate('Continue {form}', { form: step.label })
                      : translate('Fill in {form}', { form: step.label })
                }
              />
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
};

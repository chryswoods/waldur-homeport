import { FC, useMemo } from 'react';
import { Form } from 'react-final-form';
import { proposalProposalsReturnToApplicant } from 'waldur-js-client';

import { AlertItem } from 'waldur-ui';

import { SubmitButton, TextGroup } from '@/form';
import { translate } from '@/i18n';
import { CloseDialogButton } from '@/modal/CloseDialogButton';
import { ModalDialog } from '@/modal/ModalDialog';
import { useManagedMutation } from '@/modal/useManagedMutation';

import { PROPOSAL_RETURNS_QUERY_KEY } from './permissions';
import { defaultResubmitBy, ResubmitByGroup } from './ResubmitByGroup';

interface ReturnFormValues {
  reason?: string;
  resubmit_by?: string | null;
}

interface ReturnToApplicantDialogProps {
  resolve: {
    proposal: {
      uuid: string;
      name?: string;
      /** Its round, for the cut-off the deadline starts at. */
      round?: { cutoff_time?: string | null } | null;
    };
    refetch?(): void;
  };
}

// The backend trims the reason, so spaces alone would arrive empty.
export const validateReason = (value?: string) =>
  value?.trim() ? undefined : translate('This field is required.');

/**
 * Hands a submitted proposal back to its applicant to fix: a decision beside
 * accepting and rejecting. The applicant is sent the reason and may resubmit
 * until the deadline, even after the round's cut-off.
 */
export const ReturnToApplicantDialog: FC<ReturnToApplicantDialogProps> = ({
  resolve: { proposal, refetch },
}) => {
  const openedAt = useMemo(() => new Date(), []);
  const roundCutoff = proposal.round?.cutoff_time;
  const initialValues = useMemo<ReturnFormValues>(
    () => ({ resubmit_by: defaultResubmitBy(roundCutoff) }),
    [roundCutoff],
  );
  const returnProposal = useManagedMutation<any, any, ReturnFormValues>({
    mutationFn: (values) =>
      proposalProposalsReturnToApplicant({
        path: { uuid: proposal.uuid },
        body: {
          reason: values.reason.trim(),
          // As the form holds it: an ISO timestamp with the offset it
          // was set in.
          resubmit_by: values.resubmit_by,
        },
      }),
    successMessage: translate(
      'The proposal has been returned to its applicant.',
    ),
    errorMessage: translate('Unable to return the proposal.'),
    refetch,
    invalidateQueries: [
      { queryKey: [PROPOSAL_RETURNS_QUERY_KEY, proposal.uuid] },
    ],
  });

  return (
    <Form<ReturnFormValues>
      onSubmit={(values) => returnProposal.mutateAsync(values)}
      initialValues={initialValues}
      render={({ handleSubmit, submitting, invalid }) => (
        <form onSubmit={handleSubmit}>
          <ModalDialog
            title={translate('Return to applicant')}
            subtitle={proposal.name}
            footer={
              <>
                <CloseDialogButton variant="tertiary" />
                <SubmitButton
                  submitting={submitting}
                  disabled={invalid}
                  label={translate('Return to applicant')}
                />
              </>
            }
          >
            <AlertItem
              variant="warning"
              className="mb-5"
              title={translate('The proposal becomes a draft again')}
              body={translate(
                'Its open reviews are cancelled, and its workflow starts again when the applicant resubmits. The applicant may change anything, forms included, and resubmit until the deadline, even after the round has closed.',
              )}
            />
            <TextGroup
              name="reason"
              label={translate('Reason')}
              description={translate(
                'Sent to the applicant: say what to change.',
              )}
              required
              validate={validateReason}
              rows={5}
            />
            <ResubmitByGroup
              minDate={openedAt}
              roundCutoff={roundCutoff}
              description={translate(
                'Nothing happens on its own when it passes: the applicant can no longer submit, and you decide whether to extend it.',
              )}
            />
          </ModalDialog>
        </form>
      )}
    />
  );
};

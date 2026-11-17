import { useQueryClient } from '@tanstack/react-query';
import { FC } from 'react';
import { ProposalForm, proposalFormsLink } from 'waldur-js-client';

import { AlertItem } from 'waldur-ui';

import { translate } from '@/i18n';

import { FormsCard } from './FormsCard';
import { fetchProposalForm } from './proposalForms';

interface ProposalFormsCardProps {
  proposalUuid: string;
  form: ProposalForm;
  /** Saves the proposal's own unsaved changes; false if it could not. */
  beforeOpen?(): Promise<boolean>;
}

/**
 * The extra forms a call's form flow asks for, beside Waldur's own proposal
 * form: compliance, team details and the like, each a Formbricks survey.
 * The surveys end back on the proposal page.
 */
export const ProposalFormsCard: FC<ProposalFormsCardProps> = ({
  proposalUuid,
  form,
  beforeOpen,
}) => {
  const queryClient = useQueryClient();
  return (
    <FormsCard
      title={translate('Forms')}
      subtitle={translate(
        'This call asks for these forms as well. Submitting is possible once every one is answered.',
      )}
      form={form}
      notice={
        !form.available && (
          <AlertItem
            variant="warning"
            className="mb-5"
            title={translate('The forms cannot be opened just now')}
            body={
              form.missing.length
                ? translate(
                    'Your answers so far are kept. Submitting waits until the remaining forms are answered: please try again later, or contact the call managers if it keeps happening.',
                  )
                : translate(
                    'Your answers are kept, and every form is answered, so you can still submit.',
                  )
            }
          />
        )
      }
      openLink={(step) =>
        proposalFormsLink({
          path: { uuid: proposalUuid },
          body: { step },
        }).then(({ data }) => data.survey_url)
      }
      fetchResponses={() => fetchProposalForm(queryClient, proposalUuid)}
      beforeOpen={beforeOpen}
      beforeOpenLabel={translate('Saving your changes…')}
    />
  );
};

import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { projectFormsLink } from 'waldur-js-client';

import { AlertItem } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { translate } from '@/i18n';
import { PermissionEnum } from '@/permissions/enums';
import { hasPermission } from '@/permissions/hasPermission';
import { FormResponsesSection } from '@/proposals/forms/FormResponsesSection';
import { FormsCard } from '@/proposals/forms/FormsCard';
import {
  fetchProjectForm,
  useProjectForm,
} from '@/proposals/forms/projectForms';
import { useFetchOnFormReturn } from '@/proposals/forms/proposalForms';
import { useUser } from '@/workspace/hooks';

/** How long before the forms open the PI is told they are coming. */
export const NOTICE_DAYS = 28;

/** Whether the heads-up is due: within NOTICE_DAYS of the forms opening. */
export const isNoticeDue = (
  opensOn: string | null | undefined,
  today: DateTime = DateTime.now(),
): boolean => {
  if (!opensOn) return false;
  const opens = DateTime.fromISO(opensOn).startOf('day');
  if (!opens.isValid) return false;
  return today.startOf('day') >= opens.minus({ days: NOTICE_DAYS });
};

interface ProjectFeedbackCardProps {
  project: { uuid: string; customer_uuid?: string };
}

/**
 * The project's end-of-project forms, for its PI and the owners of its
 * organisation: from its call's closing flow, or the site's for projects
 * without one. Four weeks before they open, a one-line heads-up; once open,
 * the forms, kept after they are answered so the answers can be read and
 * edited until the project closes. The call's managers read them on the
 * proposal.
 */
export const ProjectFeedbackCard: FC<ProjectFeedbackCardProps> = ({
  project,
}) => {
  const queryClient = useQueryClient();
  const user = useUser();
  const { data: form } = useProjectForm(project.uuid);
  // Back from a survey: bring its answer in.
  useFetchOnFormReturn(project.uuid, fetchProjectForm);

  if (!form) {
    return null;
  }

  // Those the backend lets fill in: the project's PI and the owners of its
  // organisation.
  const mayFillIn =
    user?.is_staff ||
    hasPermission(user, {
      permission: PermissionEnum.CREATE_PROJECT_PERMISSION,
      projectId: project.uuid,
    }) ||
    hasPermission(user, {
      permission: PermissionEnum.CREATE_PROJECT_PERMISSION,
      customerId: project.customer_uuid,
    });

  if (!mayFillIn) {
    return null;
  }

  // In the weeks before the forms open, a one-line heads-up, so the PI
  // knows the questions are coming.
  if (!form.is_open) {
    return isNoticeDue(form.opens_on) ? (
      <AlertItem
        variant="info"
        className="mb-6"
        data-testid="project-feedback-notice"
        title={translate(
          "On {date} we'll ask you a few short questions about how the project went. Your answers help us run future calls.",
          { date: formatDate(form.opens_on) },
        )}
      />
    ) : null;
  }

  // Once open, the forms themselves. The card stays after every form is
  // answered, so the answers can be read and changed until the project is
  // removed at the end of its grace period, when its team loses access.
  const allAnswered = form.missing.length === 0;

  return (
    <>
      <FormsCard
        title={translate('Project feedback')}
        subtitle={
          allAnswered
            ? translate(
                'Thank you for your feedback. You can review or change your answers until the project closes.',
              )
            : translate(
                'Please tell us how the project went. Your answers help us run future calls.',
              )
        }
        form={form}
        notice={
          !form.available && (
            <AlertItem
              variant="warning"
              className="mb-5"
              title={translate('The forms cannot be opened just now')}
              body={translate(
                'Your answers so far are kept. Please try again later.',
              )}
            />
          )
        }
        openLink={(step) =>
          projectFormsLink({
            path: { uuid: project.uuid },
            body: { step },
          }).then(({ data }) => data.survey_url)
        }
        fetchResponses={() => fetchProjectForm(queryClient, project.uuid)}
      />
      <FormResponsesSection responses={form.responses} />
    </>
  );
};

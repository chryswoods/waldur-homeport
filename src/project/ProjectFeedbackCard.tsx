import { useQueryClient } from '@tanstack/react-query';
import { FC } from 'react';
import { projectFormsLink } from 'waldur-js-client';

import { AlertItem } from 'waldur-ui';

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

interface ProjectFeedbackCardProps {
  project: { uuid: string; customer_uuid?: string };
}

/**
 * The project's end-of-project forms, for its PI and the owners of its
 * organisation: from its call's closing flow, or the site's for projects
 * without one. Shown once they open, near or after the project's end date,
 * and kept after they are answered so the answers can be read and edited
 * until the project closes. The call's managers read them on the proposal.
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

  // Only once the forms are open: not before. It stays after every form is
  // answered, so the answers can be read and changed until the project is
  // removed at the end of its grace period, when its team loses access.
  if (!mayFillIn || !form.is_open) {
    return null;
  }
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

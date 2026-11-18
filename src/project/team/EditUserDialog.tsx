import { FC, useMemo } from 'react';
import { Form } from 'react-final-form';
import {
  Project,
  projectsChangeUserRole,
  projectsUpdateUser,
} from 'waldur-js-client';

import { SubmitButton } from '@/form';
import { translate } from '@/i18n';
import { CloseDialogButton } from '@/modal/CloseDialogButton';
import { ModalDialog } from '@/modal/ModalDialog';
import { ScopeSubtitle } from '@/modal/ScopeSubtitle';
import { useManagedMutation } from '@/modal/useManagedMutation';
import { changedExpiry } from '@/permissions/roleChange';
import { GenericPermission, Role } from '@/permissions/types';
import { getHeldRole } from '@/permissions/utils';
import { useProject } from '@/workspace/hooks';

import { ExpirationTimeGroup } from './ExpirationTimeGroup';
import {
  getOnlyOneProjectManagerTooltip,
  isProjectManagerSelectionBlocked,
} from './onlyOneProjectManager';
import { RoleGroup } from './RoleGroup';
import { useProjectHasActiveManager } from './useProjectHasActiveManager';
import { UserGroup } from './UserGroup';

interface EditUserDialogFormData {
  role: Role;
  expiration_time: string;
}

interface EditUserDialogResolve {
  permission: GenericPermission;
  refetch();
  projectUuid?;
  customerUuid?;
  project?: Project;
}

interface EditUserDialogProps {
  resolve: EditUserDialogResolve;
}

const savePermissions = async (
  project: Project,
  formData: EditUserDialogFormData,
  resolve: EditUserDialogResolve,
) => {
  if (resolve.permission) {
    if (resolve.permission.role_name === formData.role.name) {
      await projectsUpdateUser({
        path: { uuid: project.uuid },
        body: {
          user: resolve.permission.user_uuid,
          role: formData.role.name,
          expiration_time: formData.expiration_time,
        },
      });
    } else {
      // One step: the member keeps their old role should the new one be
      // refused, and nothing that follows a member leaving runs.
      await projectsChangeUserRole({
        path: { uuid: project.uuid },
        body: {
          user: resolve.permission.user_uuid,
          previous_role: resolve.permission.role_name,
          role: formData.role.name,
          ...changedExpiry(
            formData.expiration_time,
            resolve.permission.expiration_time,
          ),
        },
      });
    }
  }
  await resolve.refetch();
};

const EditUserDialogFormBody: FC<{
  handleSubmit: () => void;
  invalid: boolean;
  submitting: boolean;
  values: EditUserDialogFormData;
  project: Project;
  permission: GenericPermission;
  customerId?: string;
}> = ({
  handleSubmit,
  invalid,
  submitting,
  values,
  project,
  permission,
  customerId,
}) => {
  const permissionRoleName = permission.role_name;
  const { data: hasActiveManager } = useProjectHasActiveManager(project?.uuid);
  const isProjectManagerBlocked = isProjectManagerSelectionBlocked(
    hasActiveManager,
    values.role,
    permissionRoleName,
  );

  return (
    <form onSubmit={handleSubmit}>
      <ModalDialog
        title={translate('Edit project member')}
        subtitle={
          <ScopeSubtitle
            label={translate('Member')}
            name={permission.user_full_name || permission.user_username}
          />
        }
        footer={
          <>
            <CloseDialogButton />
            <SubmitButton
              disabled={invalid || isProjectManagerBlocked}
              disabledReason={
                isProjectManagerBlocked
                  ? getOnlyOneProjectManagerTooltip()
                  : undefined
              }
              submitting={submitting}
            >
              {translate('Save')}
            </SubmitButton>
          </>
        }
      >
        <UserGroup permission={permission} />
        <RoleGroup types={['project']} scope={{ customerId }} />
        <ExpirationTimeGroup disabled={submitting} />
      </ModalDialog>
    </form>
  );
};

export const EditUserDialog: FC<EditUserDialogProps> = ({ resolve }) => {
  const currentProject = useProject();

  const project = resolve.project || currentProject;

  const initialValues = useMemo(
    () => ({
      role: getHeldRole(
        resolve.permission.role_name,
        'project',
        resolve.permission.role_description,
      ),
      expiration_time: resolve.permission.expiration_time,
    }),
    [resolve.permission],
  );

  const saveUserMutation = useManagedMutation<any, any, EditUserDialogFormData>(
    {
      mutationFn: (formData) => savePermissions(project, formData, resolve),
      successMessage: translate('Permission has been updated.'),
      errorMessage: translate('Unable to update permission.'),
    },
  );

  return (
    <Form<EditUserDialogFormData>
      onSubmit={(values) =>
        // A refusal is shown by the mutation, and the dialog stays open.
        saveUserMutation.mutateAsync(values).catch(() => undefined)
      }
      initialValues={initialValues}
    >
      {({ handleSubmit, submitting, invalid, values }) => (
        <EditUserDialogFormBody
          handleSubmit={handleSubmit}
          invalid={invalid}
          submitting={submitting}
          values={values}
          project={project}
          permission={resolve.permission}
          customerId={resolve.customerUuid}
        />
      )}
    </Form>
  );
};

import { PlusIcon, UserPlusIcon } from '@phosphor-icons/react';
import { FC, useCallback } from 'react';
import { Form } from 'react-final-form';
import { components } from 'react-select';
import {
  callManagingOrganisationsAddUser,
  customersAddUser,
  customersUsersList,
  marketplaceServiceProvidersAddUser,
  projectsAddUser,
  projectsOtherUsersList,
  type ProjectEmailPolicyResponse,
} from 'waldur-js-client';

import { required } from '@/core/validators';
import { OrganizationProjectSelectField } from '@/customer/team/OrganizationProjectSelectField';
import { usersAutocomplete } from '@/customer/team/utils';
import { isFeatureVisible } from '@/features/connect';
import { UserFeatures } from '@/FeaturesEnums';
import { AsyncSelectGroup, BooleanGroup, SubmitButton } from '@/form';
import { createLoadOptions } from '@/form/select';
import { translate } from '@/i18n';
import { RestrictionsInfoCard } from '@/invitations/actions/RestrictionsInfoCard';
import { useModal } from '@/modal/actions';
import { CloseDialogButton } from '@/modal/CloseDialogButton';
import { ModalDialog } from '@/modal/ModalDialog';
import { isEmailAllowed } from '@/openportal/awardPolicy';
import { PermissionEnum } from '@/permissions/enums';
import { hasPermission } from '@/permissions/hasPermission';
import { Role, RoleType } from '@/permissions/types';
import { useNotify } from '@/store/notify';
import { UserFormDialog } from '@/user/support/UserFormDialog';
import { getCurrentUser } from '@/user/UsersService';
import {
  useCustomer,
  useProject,
  useSetUser,
  useUser,
} from '@/workspace/hooks';
import { Project, User } from '@/workspace/types';

import { useProjectEmailPolicy } from '../useProjectEmailPolicy';

import { DomainRestrictionNotice } from './DomainRestrictionNotice';
import { ExpirationTimeGroup } from './ExpirationTimeGroup';
import {
  getOnlyOneProjectManagerTooltip,
  isOnlyOneProjectManagerEnabled,
  isProjectManagerRole,
  isProjectManagerSelectionBlocked,
} from './onlyOneProjectManager';
import { RoleGroup } from './RoleGroup';
import { useProjectHasActiveManager } from './useProjectHasActiveManager';
import { UserListOptionInline } from './UserListOptionInline';
import { hasCurrentCustomerPermission } from './utils';

interface AddUserDialogFormData {
  role: Role;
  expiration_time: string;
  user: any;
  project?: Project;
  showAllUsers?: boolean;
}

interface AddUserDialogProps {
  refetch;
  level?: RoleType;
  title?: string;
  project?: Project;
  customerUuid?: string;
  customer?;
}

const customerUsersAutocomplete = (customerUuid: string) =>
  createLoadOptions(
    customersUsersList,
    'user_keyword',
    { o: 'concatenated_name' },
    { customer_uuid: customerUuid },
  );

const projectUsersAutocomplete = (projectUuid: string) =>
  createLoadOptions(
    projectsOtherUsersList,
    'user_keyword',
    {},
    { project_uuid: projectUuid },
  );

/** react-select menu with a "Create user" action appended below the options. */
const MenuWithCreateButton = ({ openCreateDialog, ...props }: any) => (
  <components.Menu {...props}>
    <div>
      {props.children}
      <div
        role="button"
        tabIndex={0}
        className="border-top d-flex align-items-center gap-2 px-3 py-2 text-primary fw-semibold cursor-pointer"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openCreateDialog();
        }}
      >
        <PlusIcon size={16} weight="bold" />
        <span>{translate('Create user')}</span>
      </div>
    </div>
  </components.Menu>
);

export const AddUserDialog: FC<AddUserDialogProps> = ({
  refetch,
  level,
  title,
  project,
  customerUuid,
  customer,
}) => {
  const setCurrentUser = useSetUser();
  const { closeDialog, openDialog } = useModal();
  const { showSuccess, showErrorResponse } = useNotify();

  const currentUser = useUser() as User;
  const currentProject = useProject();
  const currentCustomer = useCustomer();
  const hasCustomerPermission = hasCurrentCustomerPermission(
    currentUser,
    currentCustomer,
  );

  const resolvedProject = project || currentProject;
  const resolvedCustomer = customer || currentCustomer;
  const resolvedCustomerUuid = customerUuid || resolvedCustomer?.uuid;

  // Deployments that enforce allowed domains restrict which addresses may be
  // added to a project. The policy is advisory here — waldur_openportal
  // enforces it server-side on the role grant — but showing it up front is a
  // great deal friendlier than a rejected submit.
  const { data: emailPolicy } = useProjectEmailPolicy(
    level === 'project' ? resolvedProject?.uuid : undefined,
  );

  const validateUser = useCallback(
    (user: any) => {
      const missing = required(user);
      if (missing) return missing;
      if (!emailPolicy || !user?.email) return undefined;
      return isEmailAllowed(emailPolicy.allowed_domains, user.email)
        ? undefined
        : translate(
            "This user's email address is not permitted for this project.",
          );
    },
    [emailPolicy],
  );

  // Upstream's modal service holds one application dialog at a time, so the
  // fork's dialog-on-top-of-dialog is not available. Creating a user instead
  // replaces this dialog and reopens it afterwards, leaving the operator back
  // where they were with the new user available to pick.
  const openCreateUserDialog = () =>
    openDialog(UserFormDialog, {
      resolve: {
        refetch: () =>
          openDialog(AddUserDialog, {
            refetch,
            level,
            title,
            project,
            customerUuid,
            customer,
          }),
      },
    });

  const loadUsers = useCallback(
    async (query, prevOptions, page, showAllUsers: boolean) => {
      try {
        if (showAllUsers) {
          return await usersAutocomplete(query, prevOptions, page);
        }

        if (hasCustomerPermission || !resolvedProject) {
          return await customerUsersAutocomplete(resolvedCustomerUuid)(
            query,
            prevOptions,
            page,
          );
        }

        return await projectUsersAutocomplete(resolvedProject.uuid)(
          query,
          prevOptions,
          page,
        );
      } catch (error) {
        showErrorResponse(error, translate('Unable to load users.'));
        return {
          options: [],
          hasMore: false,
          additional: { page: 1 },
        };
      }
    },
    [hasCustomerPermission, resolvedProject, resolvedCustomerUuid],
  );

  const getOptionLabel = (option) =>
    option.email
      ? (option.full_name || option.username) + ` (${option.email})`
      : option.full_name || option.username;

  const saveUser = useCallback(
    async (formData: AddUserDialogFormData) => {
      if (formData.role.content_type === 'project') {
        try {
          const targetProjectUuid =
            formData.project?.uuid || resolvedProject?.uuid;
          await projectsAddUser({
            path: {
              uuid: targetProjectUuid,
            },
            body: {
              user: formData.user.uuid,
              expiration_time: formData.expiration_time,
              role: formData.role.name,
            },
          });
          await refetch();
          showSuccess(translate('User has been added to project.'));
          closeDialog();
        } catch (error) {
          showErrorResponse(error, translate('Unable to add user.'));
        }
      } else if (formData.role.content_type === 'customer') {
        try {
          await customersAddUser({
            path: { uuid: resolvedCustomerUuid },
            body: {
              user: formData.user.uuid,
              role: formData.role.name,
              expiration_time: formData.expiration_time,
            },
          });
          if (currentUser.uuid === formData.user.uuid) {
            const newUser = await getCurrentUser();
            setCurrentUser(newUser);
          }
          await refetch();
          showSuccess(translate('User has been added to organization.'));
          closeDialog();
        } catch (error) {
          showErrorResponse(error, translate('Unable to add user.'));
        }
      } else if (formData.role.content_type === 'call_organizer') {
        try {
          await callManagingOrganisationsAddUser({
            path: { uuid: resolvedCustomer.call_managing_organization_uuid },
            body: {
              user: formData.user.uuid,
              role: formData.role.name,
              expiration_time: formData.expiration_time,
            },
          });
          if (currentUser.uuid === formData.user.uuid) {
            const newUser = await getCurrentUser();
            setCurrentUser(newUser);
          }
          await refetch();
          showSuccess(translate('User has been added to organization.'));
          closeDialog();
        } catch (error) {
          showErrorResponse(error, translate('Unable to add user.'));
        }
      } else if (formData.role.content_type === 'service_provider') {
        try {
          await marketplaceServiceProvidersAddUser({
            path: { uuid: resolvedCustomer.service_provider_uuid },
            body: {
              user: formData.user.uuid,
              role: formData.role.name,
              expiration_time: formData.expiration_time,
            },
          });
          if (currentUser.uuid === formData.user.uuid) {
            const newUser = await getCurrentUser();
            setCurrentUser(newUser);
          }
          await refetch();
          showSuccess(translate('User has been added to organization.'));
          closeDialog();
        } catch (error) {
          showErrorResponse(error, translate('Unable to add user.'));
        }
      }
    },
    [
      refetch,
      showSuccess,
      closeDialog,
      showErrorResponse,
      resolvedProject,
      resolvedCustomer,
      currentUser,
    ],
  );

  return (
    <Form onSubmit={saveUser}>
      {({ handleSubmit, submitting, invalid, values }) => (
        <AddUserDialogForm
          handleSubmit={handleSubmit}
          submitting={submitting}
          invalid={invalid}
          values={values}
          level={level}
          title={title}
          resolvedProject={resolvedProject}
          resolvedCustomer={resolvedCustomer}
          resolvedCustomerUuid={resolvedCustomerUuid}
          currentUser={currentUser}
          loadUsers={loadUsers}
          getOptionLabel={getOptionLabel}
          emailPolicy={emailPolicy}
          validateUser={validateUser}
          openCreateUserDialog={openCreateUserDialog}
        />
      )}
    </Form>
  );
};

interface AddUserDialogFormProps {
  handleSubmit: () => void;
  submitting: boolean;
  invalid: boolean;
  values: AddUserDialogFormData;
  level?: RoleType;
  title?: string;
  resolvedProject?: Project;
  resolvedCustomer;
  resolvedCustomerUuid: string;
  currentUser: User;
  loadUsers: (
    query: string,
    prevOptions: unknown,
    page: number,
    showAllUsers: boolean,
  ) => Promise<any>;
  getOptionLabel: (option: any) => string;
  emailPolicy?: ProjectEmailPolicyResponse;
  validateUser: (user: any) => string | undefined;
  openCreateUserDialog: () => void;
}

const AddUserDialogForm: FC<AddUserDialogFormProps> = ({
  handleSubmit,
  submitting,
  invalid,
  values,
  level,
  title,
  resolvedProject,
  resolvedCustomer,
  resolvedCustomerUuid,
  currentUser,
  loadUsers,
  getOptionLabel,
  emailPolicy,
  validateUser,
  openCreateUserDialog,
}) => {
  const targetProjectUuid = values.project?.uuid || resolvedProject?.uuid;
  const { data: targetProjectHasManager, isPending: isCheckingManager } =
    useProjectHasActiveManager(targetProjectUuid);

  const needsManagerCheck =
    isOnlyOneProjectManagerEnabled() &&
    isProjectManagerRole(values.role) &&
    Boolean(targetProjectUuid);

  const isProjectManagerBlocked =
    isProjectManagerSelectionBlocked(targetProjectHasManager, values.role) ||
    (needsManagerCheck && isCheckingManager);

  return (
    <form onSubmit={handleSubmit}>
      <ModalDialog
        title={title || translate('Add user')}
        footer={
          <>
            <CloseDialogButton />
            <SubmitButton
              submitting={submitting}
              disabled={invalid || isProjectManagerBlocked}
              disabledReason={
                isProjectManagerBlocked
                  ? getOnlyOneProjectManagerTooltip()
                  : undefined
              }
            >
              {translate('Add role')}
            </SubmitButton>
          </>
        }
        iconNode={<UserPlusIcon weight="bold" />}
        iconColor="success"
      >
        <RestrictionsInfoCard
          customer={resolvedCustomer}
          project={
            level === 'project' ? resolvedProject : values.project || null
          }
        />
        <DomainRestrictionNotice
          allowedDomains={emailPolicy?.allowed_domains}
          contactEmail={resolvedCustomer?.email}
          projectName={resolvedProject?.name}
        />
        <AsyncSelectGroup
          name="user"
          required
          label={translate('User')}
          key={values.showAllUsers ? 'showAllUsers' : 'notShowAllUsers'}
          placeholder={translate('Select user...')}
          loadOptions={(query, prevOptions, page) =>
            loadUsers(query, prevOptions, page, values.showAllUsers || false)
          }
          getOptionValue={(option) => option.uuid}
          getOptionLabel={getOptionLabel}
          components={{
            Option: UserListOptionInline,
            ...(isFeatureVisible(UserFeatures.allow_user_creation) && {
              Menu: (menuProps) => (
                <MenuWithCreateButton
                  {...menuProps}
                  openCreateDialog={openCreateUserDialog}
                />
              ),
            }),
          }}
          noOptionsMessage={() =>
            translate(
              'No users found. You can only see users from projects you belong to. Use "Invite by mail" to add new users.',
            )
          }
          validate={validateUser}
        />

        {currentUser.is_staff && (
          <BooleanGroup
            name="showAllUsers"
            label={translate('Show users outside organization')}
          />
        )}
        <RoleGroup
          types={
            level === 'customer' &&
            hasPermission(currentUser, {
              permission: PermissionEnum.CREATE_CUSTOMER_PERMISSION,
              customerId: resolvedCustomerUuid,
            })
              ? ['customer', 'project']
              : [level]
          }
          user={currentUser}
          scope={{
            customerId: resolvedCustomerUuid,
            projectId: resolvedProject?.uuid,
            callOrganizerId: resolvedCustomer?.call_managing_organization_uuid,
          }}
        />

        {level === 'customer' && values.role?.content_type === 'project' && (
          <OrganizationProjectSelectField />
        )}
        <ExpirationTimeGroup />
      </ModalDialog>
    </form>
  );
};

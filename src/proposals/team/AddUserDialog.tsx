import { UserCirclePlusIcon } from '@phosphor-icons/react';
import { FC, useState } from 'react';
import { Form } from 'react-final-form';
import { proposalProposalsAddUserByEmail, RoleDetails } from 'waldur-js-client';

import { AlertItem, SegmentedControl } from 'waldur-ui';

import { ENV } from '@/core/config';
import {
  composeValidators,
  email as validEmail,
  required,
} from '@/core/validators';
import { usersAutocomplete } from '@/customer/team/utils';
import { isFeatureVisible } from '@/features/connect';
import { UserFeatures } from '@/FeaturesEnums';
import {
  AsyncSelectGroup,
  EmailGroup,
  StringGroup,
  SubmitButton,
} from '@/form';
import { translate } from '@/i18n';
import { CloseDialogButton } from '@/modal/CloseDialogButton';
import { ModalDialog } from '@/modal/ModalDialog';
import { useManagedMutation } from '@/modal/useManagedMutation';
import { ExpirationTimeGroup } from '@/project/team/ExpirationTimeGroup';
import { RoleGroup } from '@/project/team/RoleGroup';
import { UserListOptionInline } from '@/project/team/UserListOptionInline';

import { addTeamUser, getTeamScopeType } from './teamApi';
import { AddUserDialogProps } from './types';

interface AddUserDialogFormData {
  role: RoleDetails;
  expiration_time: string;
  user?: any;
  email?: string;
  first_name?: string;
  last_name?: string;
}

type AddMode = 'search' | 'email';

const getOptionLabel = (option) =>
  option.email
    ? (option.full_name || option.username) + ` (${option.email})`
    : option.full_name || option.username;

export const AddUserDialog: FC<AddUserDialogProps> = ({
  refetch,
  scope,
  roleTypes,
  roles,
  roleNotice,
}) => {
  const isProposalTeam = getTeamScopeType(roleTypes) === 'proposal';
  // A proposal's team can take someone by email, creating their account
  // when there is none, where the site lets accounts be created.
  const canAddByEmail =
    isProposalTeam && isFeatureVisible(UserFeatures.allow_user_creation);
  // No expiry on a proposal team: an applicant cannot know how long a
  // proposal that may never be awarded needs someone, and a date guessed
  // here would silently remove them later. A call team keeps it.
  const asksForExpiry = !isProposalTeam;
  const [mode, setMode] = useState<AddMode>('search');
  const byEmail = canAddByEmail && mode === 'email';

  // The role the member will get: the one offered, or the one picked.
  const chosenRole = (formData: Partial<AddUserDialogFormData>) =>
    roles && roles.length === 1 ? roles[0] : formData.role?.name;

  const saveUserMutation = useManagedMutation<any, any, AddUserDialogFormData>({
    mutationFn: (formData) => {
      const role = chosenRole(formData);
      if (byEmail) {
        return proposalProposalsAddUserByEmail({
          path: { uuid: scope.uuid },
          body: {
            email: formData.email.trim(),
            first_name: formData.first_name?.trim() || undefined,
            last_name: formData.last_name?.trim() || undefined,
            role,
            expiration_time: asksForExpiry
              ? formData.expiration_time || null
              : null,
          },
        });
      }
      return addTeamUser(getTeamScopeType(roleTypes), scope.uuid, {
        user: formData.user.uuid,
        expiration_time: asksForExpiry
          ? formData.expiration_time || null
          : null,
        role,
      });
    },
    successMessage: translate('User has been added.'),
    errorMessage: translate('Unable to add user.'),
    refetch,
  });

  const initialValues =
    roles && roles.length === 1
      ? { role: ENV.roles.find((role) => role.name === roles[0]) }
      : {};

  return (
    <Form<AddUserDialogFormData>
      onSubmit={(values) => saveUserMutation.mutateAsync(values)}
      initialValues={initialValues}
    >
      {({ handleSubmit, submitting, invalid, values }) => (
        <form onSubmit={handleSubmit}>
          <ModalDialog
            title={translate('Add member')}
            subtitle={translate('Select a user and assign a role.')}
            iconNode={<UserCirclePlusIcon weight="bold" />}
            iconColor="success"
            footer={
              <>
                <CloseDialogButton className="min-w-125px" />
                <SubmitButton
                  label={translate('Add role')}
                  submitting={submitting}
                  disabled={invalid}
                  variant="primary"
                  className="min-w-125px"
                />
              </>
            }
          >
            {canAddByEmail && (
              <SegmentedControl<AddMode>
                className="mb-5"
                aria-label={translate('How to find the member')}
                options={[
                  { value: 'search', label: translate('Search users') },
                  { value: 'email', label: translate('Add by email') },
                ]}
                value={mode}
                onValueChange={setMode}
              />
            )}
            {byEmail ? (
              <>
                <EmailGroup
                  label={translate('Email')}
                  name="email"
                  required
                  validate={composeValidators(required, validEmail)}
                  description={translate(
                    'Their account is found by this email, or created with it if they have none.',
                  )}
                />
                <div className="row">
                  <div className="col-sm-6">
                    <StringGroup
                      label={translate('First name')}
                      name="first_name"
                    />
                  </div>
                  <div className="col-sm-6">
                    <StringGroup
                      label={translate('Last name')}
                      name="last_name"
                    />
                  </div>
                </div>
                <p className="text-muted fs-7 mt-n3">
                  {translate(
                    'Names are used only if a new account is created.',
                  )}
                </p>
              </>
            ) : (
              <AsyncSelectGroup
                label={translate('User')}
                required
                name="user"
                placeholder={translate('Search and select user...')}
                loadOptions={usersAutocomplete}
                getOptionValue={(option) => option.uuid}
                getOptionLabel={getOptionLabel}
                components={{ Option: UserListOptionInline }}
                validate={required}
              />
            )}

            {roles && roles.length === 1 ? null : (
              <RoleGroup types={roleTypes} roleNames={roles} />
            )}
            {roleNotice && chosenRole(values) === roleNotice.roleName ? (
              <AlertItem
                variant="warning"
                className="mb-5"
                title={roleNotice.message}
                data-testid="role-notice"
              />
            ) : null}
            {asksForExpiry ? <ExpirationTimeGroup /> : null}
          </ModalDialog>
        </form>
      )}
    </Form>
  );
};

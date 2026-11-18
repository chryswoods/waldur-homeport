import { FC, useMemo } from 'react';
import { Form } from 'react-final-form';
import {
  customersAddUser,
  customersChangeUserRole,
  customersUpdateUser,
  CustomerUser,
} from 'waldur-js-client';

import { SubmitButton } from '@/form';
import { translate } from '@/i18n';
import { CloseDialogButton } from '@/modal/CloseDialogButton';
import { ModalDialog } from '@/modal/ModalDialog';
import { ScopeSubtitle } from '@/modal/ScopeSubtitle';
import { useManagedMutation } from '@/modal/useManagedMutation';
import { changedExpiry } from '@/permissions/roleChange';
import { Role } from '@/permissions/types';
import { getHeldRole } from '@/permissions/utils';
import { ExpirationTimeGroup } from '@/project/team/ExpirationTimeGroup';
import { RoleGroup } from '@/project/team/RoleGroup';
import { useCustomer } from '@/workspace/hooks';
import { Customer } from '@/workspace/types';

import { UserGroup } from './UserGroup';

interface EditUserDialogFormData {
  role: Role;
  expiration_time: string;
}

interface EditUserDialogResolve {
  customer: CustomerUser;
  refetch();
}

interface EditUserDialogProps {
  resolve: EditUserDialogResolve;
}

const savePermissions = async (
  customer: Customer,
  formData: EditUserDialogFormData,
  resolve: EditUserDialogResolve,
) => {
  if (resolve.customer) {
    if (resolve.customer.role_name === formData.role.name) {
      await customersUpdateUser({
        path: { uuid: customer.uuid },
        body: {
          user: resolve.customer.uuid,
          role: formData.role.name,
          expiration_time: formData.expiration_time,
        },
      });
    } else if (resolve.customer.role_name) {
      // One step: the member keeps their old role should the new one be
      // refused, and nothing that follows a member leaving runs.
      await customersChangeUserRole({
        path: { uuid: customer.uuid },
        body: {
          user: resolve.customer.uuid,
          previous_role: resolve.customer.role_name,
          role: formData.role.name,
          ...changedExpiry(
            formData.expiration_time,
            resolve.customer.expiration_time,
          ),
        },
      });
    } else {
      // No role here yet: a grant, not a change.
      await customersAddUser({
        path: { uuid: customer.uuid },
        body: {
          user: resolve.customer.uuid,
          role: formData.role.name,
          expiration_time: formData.expiration_time,
        },
      });
    }
  }
  await resolve.refetch();
};

export const EditUserDialog: FC<EditUserDialogProps> = ({ resolve }) => {
  const currentCustomer = useCustomer();

  const initialValues = useMemo(
    () => ({
      role: getHeldRole(resolve.customer.role_name, 'customer'),
      expiration_time: resolve.customer.expiration_time,
    }),
    [resolve.customer],
  );

  const updateMutation = useManagedMutation<any, any, EditUserDialogFormData>({
    mutationFn: (formData) =>
      savePermissions(currentCustomer, formData, resolve),
    successMessage: translate('Permission has been updated.'),
    errorMessage: translate('Unable to update permission.'),
  });

  return (
    <Form<EditUserDialogFormData>
      onSubmit={(values) =>
        // A refusal is shown by the mutation, and the dialog stays open.
        updateMutation.mutateAsync(values).catch(() => undefined)
      }
      initialValues={initialValues}
    >
      {({ handleSubmit, submitting, invalid }) => (
        <form onSubmit={handleSubmit}>
          <ModalDialog
            title={translate('Edit organization member')}
            subtitle={
              <ScopeSubtitle
                label={translate('Member')}
                name={resolve.customer.full_name || resolve.customer.username}
              />
            }
            footer={
              <>
                <CloseDialogButton />
                <SubmitButton disabled={invalid} submitting={submitting}>
                  {translate('Save')}
                </SubmitButton>
              </>
            }
          >
            <UserGroup permission={resolve.customer} />
            <RoleGroup
              types={['customer']}
              scope={{ customerId: currentCustomer?.uuid }}
            />
            <ExpirationTimeGroup disabled={submitting} />
          </ModalDialog>
        </form>
      )}
    </Form>
  );
};

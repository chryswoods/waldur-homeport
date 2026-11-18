import { Form } from 'react-final-form';
import {
  RemoteProject,
  openportalRemoteProjectsSetAllowedDomains,
} from 'waldur-js-client';

import { BooleanGroup, CommaSeparatedListGroup, SubmitButton } from '@/form';
import { translate } from '@/i18n';
import { ModalDialog } from '@/modal/ModalDialog';
import { useManagedMutation } from '@/modal/useManagedMutation';

interface FormValues {
  allow_all: boolean;
  allowed_domains: string[];
}

interface SetAllowedDomainsDialogProps {
  row: RemoteProject;
  resolve: {
    refetch: () => Promise<void> | void;
  };
}

/**
 * Who may join, by email: anyone (no list, sent as null), or only addresses
 * matching the list. An empty list lets nobody join.
 */
export const SetAllowedDomainsDialog: React.FC<
  SetAllowedDomainsDialogProps
> = ({ row, resolve }) => {
  const mutation = useManagedMutation<any, any, FormValues>({
    mutationFn: (values) =>
      openportalRemoteProjectsSetAllowedDomains({
        path: { uuid: row.uuid },
        body: {
          allowed_domains: values.allow_all
            ? null
            : (values.allowed_domains ?? []),
        },
      }),
    successMessage: translate('Allowed domains have been updated.'),
    errorMessage: translate('Unable to update allowed domains.'),
    refetch: resolve.refetch,
  });

  return (
    <Form<FormValues>
      onSubmit={(values) =>
        // A refusal is shown by the mutation, and the dialog stays open.
        mutation.mutateAsync(values).catch(() => undefined)
      }
      initialValues={{
        allow_all: row.allowed_domains == null,
        allowed_domains: row.allowed_domains ?? [],
      }}
      subscription={{ submitting: true, invalid: true, values: true }}
      render={({ handleSubmit, submitting, invalid, values }) => (
        <form onSubmit={handleSubmit} noValidate>
          <ModalDialog
            title={translate('Set allowed domains')}
            footer={
              <SubmitButton
                submitting={submitting}
                invalid={invalid}
                label={translate('Save')}
              />
            }
          >
            <BooleanGroup
              name="allow_all"
              label={translate('Allow all domains')}
              description={translate(
                'Anyone may join, whatever their email address.',
              )}
            />
            {values.allow_all ? null : (
              <CommaSeparatedListGroup
                name="allowed_domains"
                label={translate('Allowed email domain patterns')}
                description={translate(
                  'e.g. *.ac.uk for any subdomain of ac.uk, example.org for that domain only, or user@example.org for one address. An empty list means nobody may join.',
                )}
                placeholder={translate('*.example.com, user@example.org')}
              />
            )}
          </ModalDialog>
        </form>
      )}
    />
  );
};

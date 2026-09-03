import { useMemo } from 'react';
import { FieldArray } from 'react-final-form-arrays';

import { translate } from '@/i18n';
import { isEmailAllowed } from '@/openportal/awardPolicy';
import { DomainRestrictionNotice } from '@/project/team/DomainRestrictionNotice';
import { useProjectEmailPolicy } from '@/project/useProjectEmailPolicy';

import { EmailsListGroup } from './EmailsListGroup';

const validateRows = (value) => {
  if (!value || value.length === 0) {
    return translate('At least one user is required');
  }

  const validRows = value.filter(
    (row) => row && row.email && row.role_project && row.role_project.role,
  );

  if (validRows.length === 0) {
    return translate('At least one complete user invitation is required');
  }

  return undefined;
};

interface EmailsListGroupWrapperProps {
  roles;
  customer;
  project;
  disabled;
}

export const EmailsListGroupWrapper = ({
  roles,
  customer,
  project,
  disabled,
}: EmailsListGroupWrapperProps) => {
  // Deployments that enforce allowed domains restrict which addresses may be
  // invited to a project. waldur_openportal enforces this server-side on the
  // invitation; validating here just fails the row rather than the request.
  const { data: emailPolicy } = useProjectEmailPolicy(project?.uuid);

  const emailDomainValidator = useMemo(() => {
    const domains = emailPolicy?.allowed_domains;
    if (domains === undefined) return undefined;
    return (value: string) =>
      isEmailAllowed(domains, value)
        ? undefined
        : translate('This email address is not permitted for this project.');
  }, [emailPolicy]);

  return (
    <>
      <DomainRestrictionNotice
        allowedDomains={emailPolicy?.allowed_domains}
        contactEmail={customer?.email}
        projectName={project?.name}
      />
      <FieldArray
        name="rows"
        validate={validateRows}
        render={(arrayProps) => (
          <EmailsListGroup
            {...arrayProps}
            roles={roles}
            customer={customer}
            project={project}
            disabled={disabled}
            emailDomainValidator={emailDomainValidator}
          />
        )}
      />
    </>
  );
};

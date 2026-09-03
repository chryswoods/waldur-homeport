import { CaretDownIcon, PlusCircleIcon } from '@phosphor-icons/react';
import { Dropdown } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { Project } from 'waldur-js-client';

import { BaseButton } from '@/core/buttons/BaseButton';
import { ServiceAccountCreateButton } from '@/customer/service-accounts/ServiceAccountCreateAction';
import { translate } from '@/i18n';
import { InvitationCreateButton } from '@/invitations/actions/create/InvitationCreateButton';
import { useModal } from '@/modal/actions';
import { canChangeMembership } from '@/openportal/awardPolicy';
import { getTableState } from '@/table/selectors';

import { AwardLockedDialog } from '../AwardLockedDialog';
import { CourseAccountCreateButton } from '../course-accounts/CourseAccountCreateAction';
import { membershipLockedDialogProps } from '../MembershipLockedDialog';
import { useProjectAwardDetails } from '../useProjectAwardDetails';

import { AddUserButton } from './AddUserButton';

interface TeamDropdownActionsProps {
  project: Project;
  refetch?(): void;
}

export const TeamDropdownActions = ({
  project,
  refetch,
}: TeamDropdownActionsProps) => {
  const tableState = useSelector(
    getTableState('marketplace-project-service-accounts'),
  );
  const isServiceAccountLimitReached =
    project.max_service_accounts > 0 &&
    tableState?.pagination?.resultCount >= project.max_service_accounts;

  const isCourseProject = project.kind === 'course';

  // An externally managed project may declare that its membership is the
  // award's to set. The Add dropdown is then replaced by a single button that
  // explains where to go instead — see src/openportal/awardPolicy.ts.
  const { openDialog } = useModal();
  const { data: awardDetails } = useProjectAwardDetails(project?.uuid);
  const membershipLocked = !canChangeMembership(
    awardDetails?.membership_control,
  );

  // Don't render Add dropdown for removed projects
  if (project.is_removed) {
    return null;
  }

  if (membershipLocked && awardDetails) {
    return (
      <BaseButton
        variant="primary"
        size="lg"
        className="btn-icon-right"
        iconNode={<PlusCircleIcon weight="bold" />}
        label={translate('Add')}
        onClick={() =>
          openDialog(
            AwardLockedDialog,
            membershipLockedDialogProps(awardDetails),
          )
        }
      />
    );
  }

  return (
    <Dropdown placement="bottom-end">
      <Dropdown.Toggle
        variant="primary"
        size="lg"
        className="no-arrow btn-icon-right"
      >
        <span className="svg-icon svg-icon-2">
          <PlusCircleIcon weight="bold" />
        </span>
        {translate('Add')}
        <span className="svg-icon svg-icon-2 rotate-180">
          <CaretDownIcon weight="bold" />
        </span>
      </Dropdown.Toggle>
      <Dropdown.Menu flip>
        {!isCourseProject && (
          <InvitationCreateButton
            project={project}
            roleTypes={['project']}
            refetch={refetch}
            enableBulkUpload={true}
          />
        )}

        {!isCourseProject && (
          <AddUserButton project={project} refetch={refetch} />
        )}
        {project.max_service_accounts !== 0 && (
          <ServiceAccountCreateButton
            context="project"
            scope={project}
            refetch={refetch}
            disabled={isServiceAccountLimitReached}
            tooltip={
              isServiceAccountLimitReached
                ? translate(
                    'Maximum number of service accounts has been reached',
                  )
                : undefined
            }
          />
        )}
        <CourseAccountCreateButton project={project} refetch={refetch} />
      </Dropdown.Menu>
    </Dropdown>
  );
};

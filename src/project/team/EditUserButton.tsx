import React from 'react';

import { lazyComponent } from '@/core/lazyComponent';
import { EditAction } from '@/form/EditAction';
import { useModal } from '@/modal/actions';
import { canChangeRoles } from '@/openportal/awardPolicy';
import { GenericPermission } from '@/permissions/types';

import { AwardLockedDialog } from '../AwardLockedDialog';
import { rolesLockedDialogProps } from '../MembershipLockedDialog';
import { useProjectAwardDetails } from '../useProjectAwardDetails';

const EditUserDialog = lazyComponent(() =>
  import('./EditUserDialog').then((module) => ({
    default: module.EditUserDialog,
  })),
);

interface EditUserButtonProps {
  row: GenericPermission;
  refetch;
  projectUuid?;
  customerUuid?;
  project?;
}

export const EditUserButton: React.FC<EditUserButtonProps> = ({
  row: permission,
  refetch,
  projectUuid,
  customerUuid,
  project,
}) => {
  const { openDialog } = useModal();

  // An externally managed project may declare that roles are the award's to
  // set. In that case the edit action opens an explanation rather than the
  // editor — see src/openportal/awardPolicy.ts.
  const { data: awardDetails } = useProjectAwardDetails(projectUuid);
  const rolesLocked = !canChangeRoles(awardDetails?.membership_control);

  const callback =
    rolesLocked && awardDetails
      ? () =>
          openDialog(AwardLockedDialog, rolesLockedDialogProps(awardDetails))
      : () =>
          openDialog(EditUserDialog, {
            resolve: {
              permission,
              refetch,
              projectUuid,
              customerUuid,
              project,
            },
          });
  return <EditAction action={callback} size="sm" />;
};

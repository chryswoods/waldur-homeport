import { ProjectsExcelButton } from '@/openportal/export/ProjectsExcelButton';

import { ProjectCreateButton } from './create/ProjectCreateButton';
import { ProjectImportButton } from './import/ProjectImportButton';

export const ProjectsTableActions = ({
  customer,
  refetch = undefined,
  filter = undefined,
}) => (
  <>
    {filter && <ProjectsExcelButton filter={filter} />}
    <ProjectImportButton customer={customer} refetch={refetch} />
    <ProjectCreateButton customer={customer} refetch={refetch} />
  </>
);

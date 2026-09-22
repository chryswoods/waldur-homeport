import { ProjectsExcelButton } from '@/openportal/export/ProjectsExcelButton';

import { ProjectCreateButton } from './create/ProjectCreateButton';
import { ProjectImportButton } from './import/ProjectImportButton';

export const ProjectsTableActions = ({
  customer,
  refetch = undefined,
  filter = undefined,
  query = undefined,
}) => (
  <>
    {filter && <ProjectsExcelButton filter={filter} query={query} />}
    <ProjectImportButton customer={customer} refetch={refetch} />
    <ProjectCreateButton customer={customer} refetch={refetch} />
  </>
);

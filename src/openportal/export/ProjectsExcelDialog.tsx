import { useQuery } from '@tanstack/react-query';
import { FC, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { rolesList } from 'waldur-js-client';

import { SubmitButton } from '@/form';
import { translate } from '@/i18n';
import { CloseDialogButton } from '@/modal/CloseDialogButton';
import { ModalDialog } from '@/modal/ModalDialog';
import { useNotify } from '@/store/notify';

import { downloadMultiSheetExcel } from '../reports/reportExcel';
import { StageProgress } from '../reports/StageProgress';

import {
  fetchProjectExportRows,
  type FetchProgress,
} from './fetchProjectExportRows';
import {
  buildSheets,
  PROJECT_COLUMN_KEYS,
  PROJECT_COLUMNS,
  type ProjectColumnKey,
  type SheetKey,
} from './projectsWorkbook';

const STAGE_LABELS: Record<string, string> = {
  projects: translate('Projects'),
  awards: translate('Awards'),
  allocations: translate('Allocations'),
  people: translate('People'),
};

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];

interface Props {
  resolve: {
    /**
     * Fetches the projects to export — every page matching the table's current
     * filter. Called when the export starts rather than when the dialog opens,
     * so choosing sheets is instant and the wait happens under the progress bar.
     */
    fetchProjects: () => Promise<any[]>;
    /** How the caller describes that scope, e.g. "the current filter". */
    scopeLabel: string;
    filename: string;
  };
}

/**
 * Multi-sheet Excel export for a list of projects.
 *
 * Separate from the table's own Export because it answers questions a
 * project-per-row file cannot: "every project lead" needs one row per person
 * per project, which means a second sheet and a request per project.
 *
 * Scope is inherited from the table rather than repeated here — filter the
 * list, then export what it shows, the same contract the built-in Export has.
 * The one control that is not a duplicate is the role selection, because it
 * filters rows on a different sheet.
 */
export const ProjectsExcelDialog: FC<Props> = ({ resolve }) => {
  const { fetchProjects, scopeLabel, filename } = resolve;
  const { showErrorResponse, showSuccess } = useNotify();

  const [sheets, setSheets] = useState<SheetKey[]>(['projects', 'people']);
  const [columns, setColumns] = useState<ProjectColumnKey[]>([
    ...PROJECT_COLUMN_KEYS,
  ]);
  const [roles, setRoles] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [running, setRunning] = useState(false);

  // Roles come from the API rather than a hard-coded list, so a deployment that
  // renames or adds one gets it here without a code change.
  const { data: projectRoles } = useQuery({
    queryKey: ['project-roles-for-export'],
    queryFn: () =>
      rolesList({ query: { content_type: 'project', page_size: 100 } }).then(
        (response) => (response.data ?? []).map((role) => role.name),
      ),
  });

  // Everything selected until the person narrows it.
  const selectedRoles = roles ?? projectRoles ?? [];

  const needsAwards = useMemo(
    () =>
      sheets.includes('awards') ||
      (sheets.includes('projects') &&
        columns.some((key) =>
          ['allocation', 'used', 'remaining', 'award_identifier'].includes(key),
        )),
    [sheets, columns],
  );
  const needsMembers = useMemo(
    () =>
      sheets.includes('people') ||
      (sheets.includes('projects') && columns.includes('members_count')),
    [sheets, columns],
  );

  const run = async () => {
    setRunning(true);
    try {
      setProgress({
        stage: 1,
        stageCount: 1,
        label: 'projects',
        done: 0,
        max: 0,
      });
      const projects = await fetchProjects();
      const rows = await fetchProjectExportRows({
        projects,
        needsAwards,
        needsMembers,
        onProgress: setProgress,
      });
      const specs = buildSheets(
        rows,
        sheets,
        columns,
        // An explicit "all roles" selection and no selection mean the same
        // thing to the sheet builder, so pass nothing rather than the full list.
        projectRoles && selectedRoles.length === projectRoles.length
          ? []
          : selectedRoles,
      );
      await downloadMultiSheetExcel(filename, specs);
      showSuccess(translate('Export complete.'));
    } catch (error) {
      showErrorResponse(error, translate('Unable to build the export.'));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const nothingSelected = sheets.length === 0;

  return (
    <ModalDialog
      title={translate('Export projects to Excel')}
      footer={
        <>
          <CloseDialogButton disabled={running} />
          <SubmitButton
            onClick={run}
            submitting={running}
            disabled={nothingSelected}
            disabledReason={
              nothingSelected
                ? translate('Choose at least one sheet to export.')
                : undefined
            }
            label={translate('Export')}
          />
        </>
      }
    >
      <p className="text-muted">{scopeLabel}</p>

      <h6 className="fw-bold mt-4">{translate('Sheets')}</h6>
      {(
        [
          ['projects', translate('Projects — one row per project')],
          ['people', translate('People — one row per person per project')],
          ['awards', translate('Awards — one row per award')],
        ] as [SheetKey, string][]
      ).map(([key, label]) => (
        <Form.Check
          key={key}
          type="checkbox"
          id={`sheet-${key}`}
          label={label}
          checked={sheets.includes(key)}
          disabled={running}
          onChange={() => setSheets(toggle(sheets, key))}
        />
      ))}

      {sheets.includes('projects') && (
        <>
          <h6 className="fw-bold mt-4">{translate('Project columns')}</h6>
          <div className="d-flex flex-wrap gap-3">
            {PROJECT_COLUMN_KEYS.map((key) => (
              <Form.Check
                key={key}
                type="checkbox"
                id={`column-${key}`}
                label={PROJECT_COLUMNS[key].label()}
                checked={columns.includes(key)}
                disabled={running}
                onChange={() => setColumns(toggle(columns, key))}
              />
            ))}
          </div>
        </>
      )}

      {sheets.includes('people') && (
        <>
          <h6 className="fw-bold mt-4">{translate('Roles')}</h6>
          <div className="d-flex flex-wrap gap-3">
            {(projectRoles ?? []).map((role) => (
              <Form.Check
                key={role}
                type="checkbox"
                id={`role-${role}`}
                label={role}
                checked={selectedRoles.includes(role)}
                disabled={running}
                onChange={() => setRoles(toggle(selectedRoles, role))}
              />
            ))}
          </div>
        </>
      )}

      {progress && (
        <div className="mt-5">
          <StageProgress
            stage={progress.stage}
            total={progress.stageCount}
            label={STAGE_LABELS[progress.label] || progress.label}
            done={progress.done}
            max={progress.max}
          />
        </div>
      )}
    </ModalDialog>
  );
};

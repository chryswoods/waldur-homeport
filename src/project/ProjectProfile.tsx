import {
  CircleIcon,
  FactoryIcon,
  GlobeSimpleIcon,
  GraduationCapIcon,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Stack } from 'react-bootstrap';
import {
  type Proposal,
  type ProposalProposalsListData,
  Project,
  proposalProposalsList,
} from 'waldur-js-client';

import { Badge } from '@/core/Badge';
import { STALE_TIME } from '@/core/constants';
import { CopyToClipboardButton } from '@/core/CopyToClipboardButton';
import { formatDate } from '@/core/dateUtils';
import { Link } from '@/core/Link';
import { PublicDashboardHero } from '@/dashboard/hero/PublicDashboardHero';
import { isFeatureVisible } from '@/features/connect';
import { ProjectFeatures } from '@/FeaturesEnums';
import { translate } from '@/i18n';
import { getItemAbbreviation } from '@/navigation/workspace/context-selector/utils';
import { useUser, useCustomer } from '@/workspace/hooks';
import { checkIsOwnerOrStaff } from '@/workspace/selectors';

import { ProjectActions } from './dashboard/ProjectActions';
import { useProjectAwardDetails } from './useProjectAwardDetails';

/**
 * Whether a proposal really belongs to this project.
 *
 * Waldur hyperlinks relations, so `proposal.project` is a URL ending in the
 * project's uuid. Checked against the last path segment rather than with a
 * substring match, so one uuid cannot match another URL that merely contains
 * it.
 */
export const belongsToProject = (
  proposal: Proposal,
  projectUuid: string,
): boolean =>
  Boolean(proposal.project?.replace(/\/$/, '').endsWith(`/${projectUuid}`));

/** An award or call reference: a link when it carries a URL, plain text otherwise. */
const AwardReference = ({
  label,
  link,
}: {
  label: string;
  link: { id?: string | null; url?: string | null };
}) => (
  <>
    <span className="fw-semibold text-dark">{label}</span>
    {link.url ? (
      <a href={link.url} target="_blank" rel="noopener noreferrer">
        {link.id || link.url}
      </a>
    ) : (
      <span>{link.id}</span>
    )}
  </>
);

interface ProjectProfileProps {
  project: Project;
}

const HeroTitle = ({ project }: ProjectProfileProps) => {
  const user = useUser();
  const customer = useCustomer();
  const isOwnerOrStaff = checkIsOwnerOrStaff(customer, user);
  return (
    <div>
      <h3 className="mb-1 d-flex align-items-center flex-wrap">
        {isFeatureVisible(ProjectFeatures.show_industry_flag) &&
          project.is_industry && (
            <span className="svg-icon svg-icon-3 me-3">
              <FactoryIcon weight="bold" />
            </span>
          )}
        <span>{project.name}</span>
        {project.kind === 'course' ? (
          <Badge variant="pink" pill outline className="ms-2 text-nowrap">
            {translate('Course')}
          </Badge>
        ) : project.kind === 'public' ? (
          <Badge variant="blue" pill outline className="ms-2 text-nowrap">
            {translate('Public')}
          </Badge>
        ) : null}
      </h3>

      {isOwnerOrStaff ? (
        <Link
          state="organization.dashboard"
          params={{ uuid: project.customer_uuid }}
          label={project.customer_name}
        />
      ) : (
        <i>{project.customer_name}</i>
      )}
    </div>
  );
};

const ProjectKindCard = ({ project }: ProjectProfileProps) => {
  return (
    <div className="d-flex gap-7 ms-n2">
      <div className="border rounded w-40px h-40px d-flex flex-center flex-shrink-0">
        <span className="svg-icon svg-icon-2 svg-icon-gray-600">
          {project.kind === 'course' ? (
            <GraduationCapIcon weight="bold" />
          ) : project.kind === 'public' ? (
            <GlobeSimpleIcon weight="bold" />
          ) : (
            <CircleIcon weight="bold" />
          )}
        </span>
      </div>
      <div>
        <h6 className="fw-bold">
          {project.kind === 'course'
            ? translate('This is project course type')
            : project.kind === 'public'
              ? translate('This is project public type')
              : 'N/A'}
        </h6>
        <p className="fs-6 text-muted">
          {project.kind === 'course'
            ? translate(
                'This course project enables creation of short-lived course accounts.',
              )
            : project.kind === 'public'
              ? translate(
                  'Public projects are visible to anonymous users and allow membership applications.',
                )
              : 'N/A'}
        </p>
      </div>
    </div>
  );
};

const APPROACHING_DAYS = 30;

const ProjectEndDate = ({ project }: ProjectProfileProps) => {
  const today = new Date();
  const endDateObj = new Date(project.end_date);
  const effectiveEndDateObj = project.effective_end_date
    ? new Date(project.effective_end_date)
    : endDateObj;
  const daysToEnd = Math.ceil(
    (endDateObj.getTime() - today.getTime()) / 86400000,
  );
  const daysSinceEffectiveEnd = Math.floor(
    (today.getTime() - effectiveEndDateObj.getTime()) / 86400000,
  );

  let className = '';
  let suffix: string | null = null;
  if (project.is_in_grace_period) {
    className = 'text-warning fw-semibold';
    const daysLeft = Math.max(
      0,
      Math.ceil((effectiveEndDateObj.getTime() - today.getTime()) / 86400000),
    );
    suffix = translate('(in grace period, {n} days left)', {
      n: String(daysLeft),
    });
  } else if (daysSinceEffectiveEnd > 0) {
    className = 'text-danger fw-semibold';
    suffix = translate('(expired {n} days ago)', {
      n: String(daysSinceEffectiveEnd),
    });
  } else if (daysToEnd >= 0 && daysToEnd <= APPROACHING_DAYS) {
    className = 'text-warning fw-semibold';
    suffix =
      daysToEnd === 0
        ? translate('(today)')
        : translate('(in {n} days)', { n: String(daysToEnd) });
  }

  return (
    <span className={className || undefined}>
      {translate('End date:')} {formatDate(project.end_date)}
      {suffix && <span className="ms-1">{suffix}</span>}
    </span>
  );
};

export const ProjectProfile = ({ project }: ProjectProfileProps) => {
  const abbreviation = useMemo(() => getItemAbbreviation(project), [project]);

  // The proposals this project came from, and the OpenPortal award backing it.
  // Both give the user a way back to where the project was granted.
  const { data: proposals } = useQuery({
    queryKey: ['project-proposals', project.uuid],
    queryFn: () =>
      proposalProposalsList({
        // project_uuid is served by the resynced mastermind branch
        // (proposal/filters.py) but is not in the published
        // waldur-js-client's query type yet, so the query is cast. Same
        // situation as the accounting summary — see
        // docs/guides/resync-decisions.md section 3. Remove the cast once a
        // client generated from the resynced schema ships.
        query: {
          project_uuid: project.uuid,
          page_size: 100,
        } as NonNullable<ProposalProposalsListData['query']>,
      }).then((response) =>
        // Fail closed. The generated client drops an undefined query value
        // silently and the API ignores a filter it does not recognise, so a
        // project_uuid that fails to land turns this call into "list every
        // proposal the user may see" — which then renders as though all of
        // them belonged to this project. Re-checking each row against the
        // project makes the worst case an empty list rather than a wrong one.
        // A no-op whenever the server did apply the filter.
        (response.data ?? []).filter((proposal) =>
          belongsToProject(proposal, project.uuid),
        ),
      ),
    enabled: Boolean(project?.uuid),
    staleTime: STALE_TIME,
  });

  const { data: awardDetails } = useProjectAwardDetails(project.uuid);

  return (
    <PublicDashboardHero
      hideQuickSection={!['public', 'course'].includes(project.kind)}
      logo={project.image}
      logoAlt={abbreviation}
      logoCircle
      cardBordered
      title={<HeroTitle project={project} />}
      mobileBottomActions
      quickBody={
        ['public', 'course'].includes(project.kind) && (
          <ProjectKindCard project={project} />
        )
      }
      actions={<ProjectActions project={project} />}
    >
      <Stack direction="horizontal" className="gap-6 mb-1">
        <span className="fw-semibold text-dark">
          {translate('ID')}: {project.slug}
          <CopyToClipboardButton
            value={project.slug}
            onlyButton
            size={16}
            buttonClassName="ms-2"
          />
        </span>
        {project.oecd_fos_2007_code && (
          <span>{`${project.oecd_fos_2007_code}. ${project.oecd_fos_2007_label}`}</span>
        )}
        {project.type && <span>{project.type}</span>}
        {project.start_date && (
          <span>
            {translate('Start date:')} {formatDate(project.start_date)}
          </span>
        )}
        {project.end_date && <ProjectEndDate project={project} />}
      </Stack>
      {awardDetails && (awardDetails.award || awardDetails.call) && (
        <Stack direction="horizontal" className="gap-6 mt-2">
          {awardDetails.award && (
            <AwardReference
              label={translate('Award:')}
              link={awardDetails.award}
            />
          )}
          {awardDetails.call &&
            (awardDetails.call.id || awardDetails.call.url) && (
              <AwardReference
                label={translate('Call:')}
                link={awardDetails.call}
              />
            )}
        </Stack>
      )}
      {awardDetails?.renewal?.url && (
        <Stack direction="horizontal" className="gap-3 mt-1">
          <a
            href={awardDetails.renewal.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {translate('Apply for a renewal')} &rarr;
          </a>
        </Stack>
      )}
      {proposals && proposals.length > 0 && (
        <Stack direction="horizontal" className="gap-3 mt-2">
          <span className="fw-semibold text-dark">
            {proposals.length === 1
              ? translate('Proposal')
              : translate('Proposals')}
            :
          </span>
          {proposals.map((proposal, index) => (
            <span key={proposal.uuid}>
              <Link
                state="call-management.proposal-details"
                params={{
                  proposal_uuid: proposal.uuid,
                  uuid: project.customer_uuid,
                }}
                label={proposal.slug}
              />
              {index < proposals.length - 1 && ', '}
            </span>
          ))}
        </Stack>
      )}
    </PublicDashboardHero>
  );
};

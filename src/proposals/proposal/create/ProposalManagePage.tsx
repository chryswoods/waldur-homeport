import { useQuery } from '@tanstack/react-query';
import { useCurrentStateAndParams } from '@uirouter/react';
import { useMemo } from 'react';
import {
  proposalProposalsRetrieve,
  proposalPublicCallsRetrieve,
  proposalReviewsList,
} from 'waldur-js-client';

import { getAllPages, MAX_PAGE_SIZE } from '@/core/api';
import { getQueryParams } from '@/core/filters';
import { LoadingErred } from '@/core/LoadingErred';
import { LoadingSpinner } from '@/core/LoadingSpinner';
import { SidebarLayout } from '@/form/SidebarLayout';
import { translate } from '@/i18n';
import { useBreadcrumbs } from '@/navigation/context';
import { useTitle } from '@/navigation/title';
import { ArchivedProposalRedirect } from '@/proposals/archive/ArchivedProposalRedirect';
import { isNotFound } from '@/proposals/archive/resolveArchived';
import {
  useCallManagedProposalBreadcrumbItems,
  useProposalBreadcrumbItems,
} from '@/proposals/breadcrumbs';
import { usesCallVocabulary } from '@/proposals/presentation';
import { canEditProposal, canSubmitProposal } from '@/proposals/team/teamRules';
import { Proposal } from '@/proposals/types';
import { useUser } from '@/workspace/hooks';

import {
  useFetchOnFormReturn,
  useProposalForm,
} from '../../forms/proposalForms';
import { ReturnedBanner } from '../../returns/ReturnedBanner';
import { DownloadProposalPdfAction } from '../DownloadProposalPdfAction';
import { ProposalDetails } from '../ProposalDetails';
import { ProposalRoleBasedTabs } from '../ProposalRoleBasedTabs';
import { WorkflowTimeline } from '../WorkflowTimeline';

import { ProposalHeader } from './ProposalHeader';
import { ProposalSubmissionStep } from './ProposalSubmissionStep';

/**
 * Sets the applicant's breadcrumb chain.
 *
 * A component rather than a bare hook call in the page, so it can be left out
 * entirely for the call-manager view: that route hangs off `call-management`,
 * whose OrganizationUIView already publishes the organisation chain, and
 * setting an empty list from here would strip it.
 */
const ApplicantBreadcrumbs = ({ proposal }: { proposal: Proposal }) => {
  useBreadcrumbs(useProposalBreadcrumbItems(proposal));
  return null;
};

/**
 * The call team's chain, down the structure that owns the proposal rather than
 * through anyone's profile. Same component-not-hook reason as above: the two
 * are mutually exclusive, and a hook cannot be called conditionally.
 */
const CallManagerBreadcrumbs = ({
  call,
  proposal,
}: {
  call: any;
  proposal: Proposal;
}) => {
  useBreadcrumbs(useCallManagedProposalBreadcrumbItems(call, proposal));
  return null;
};

export const ProposalManagePage = () => {
  const {
    state,
    params: { proposal_uuid },
  } = useCurrentStateAndParams();

  const {
    data: proposal,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['Proposal', proposal_uuid],

    // A 404 is answered here rather than thrown: the global query error
    // handler would otherwise send the whole app to the Not Found page before
    // this page could look in the archive (see below). Anything else is still
    // thrown, so a 403 or a 500 reaches the global handler as before.
    queryFn: () =>
      proposalProposalsRetrieve({
        path: { uuid: proposal_uuid },
      })
        .then((response) => response.data)
        .catch((e) => {
          if (isNotFound(e)) return null;
          throw e;
        }),

    refetchOnWindowFocus: false,
  });

  const isDraft = proposal?.state === 'draft';
  const title = usesCallVocabulary()
    ? isDraft
      ? translate('Update proposal')
      : translate('View proposal')
    : isDraft
      ? translate('Update access request')
      : translate('View access request');
  useTitle(title);

  const user = useUser();

  const isEditPage = state.name === 'proposals.manage-proposal';
  const isCallManagerView = state.name?.startsWith('call-management');
  // Proposal administrators edit the draft as well; submitting stays with
  // its creator, its managers and staff.
  const hasPermissionToEdit = proposal && canEditProposal(user, proposal);
  const hasPermissionToSubmit = proposal && canSubmitProposal(user, proposal);

  const { data: call } = useQuery({
    queryKey: ['ProposalCall', proposal?.call_uuid],
    queryFn: () =>
      proposalPublicCallsRetrieve({
        path: { uuid: proposal.call_uuid },
        query: {
          field: [
            'uuid',
            'name',
            'customer_uuid',
            // Both name the call-manager breadcrumb chain.
            'customer_name',
            'manager_uuid',
            'compliance_checklist',
            'compliance_checklist_name',
            // Drives which Project details fields the form asks for.
            'proposal_field_config',
            // Tells the applicant when review of a submitted proposal starts.
            'evaluation_start',
            // One manager per proposal: management can be handed over.
            'single_proposal_manager',
            // Cast: compliance_checklist* are protected-call fields, so the
            // list is not assignable to keyof PublicCall.
          ] as any,
        },
      }).then((res) => res.data),
    enabled: !!proposal?.call_uuid,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Only a draft on the edit page needs it here, for its extra forms beside
  // the proposal form; ProposalDetails asks for the answers itself.
  const { data: proposalForm, isLoading: isLoadingForm } = useProposalForm(
    proposal_uuid,
    proposal?.state === 'draft' && isEditPage,
  );
  // Back from a Formbricks survey: bring its answer in.
  useFetchOnFormReturn(proposal_uuid);

  const { data: reviews, isLoading: isLoadingReviews } = useQuery({
    queryKey: ['ProposalReviews', proposal_uuid],

    queryFn: () =>
      getAllPages((page) =>
        proposalReviewsList({
          query: {
            page,
            page_size: MAX_PAGE_SIZE,
            proposal_uuid,
          },
        }),
      ),

    refetchOnWindowFocus: false,
  });

  // For the "Reviewer" tab navigation, prefer using non-rejected review,
  // if all is rejected, take the newer,
  // but if another review was selected, use it by reading from the url query `review_uuid`
  const userReview = useMemo(() => {
    if (!reviews?.length) return null;
    const params = getQueryParams();
    if (params['review_uuid']) {
      const review = reviews.find((rw) => rw.uuid === params['review_uuid']);
      if (review) return review;
    }
    const userReviews = reviews.filter(
      (review) => review.reviewer_uuid === user.uuid,
    );
    if (!userReviews?.length) return null;
    if (userReviews.length === 1) return userReviews[0];
    if (userReviews.every((rw) => rw.state === 'rejected')) {
      return userReviews.sort(
        (a, b) =>
          new Date(b.review_end_date).getTime() -
          new Date(a.review_end_date).getTime(),
      )[0];
    }
    // Sort by state, so that can take prefered review
    return userReviews.sort((a, b) => (a.state < b.state ? 1 : -1))[0];
  }, [reviews, user]);

  const submittedReviews = useMemo(
    () =>
      reviews
        ? reviews.filter((rw) => ['submitted', 'rejected'].includes(rw.state))
        : null,
    [reviews],
  );

  if (isLoading || isLoadingReviews || isLoadingForm) {
    return <LoadingSpinner />;
  } else if (error) {
    return <LoadingErred loadData={refetch} />;
  } else if (proposal === null) {
    // A proposal that is not here may still be in the archive: the upgrade
    // archived the old proposals rather than migrating them, keeping their
    // UUIDs, so an old link identifies a real record that is no longer live.
    // Only a 404 comes here -- a 403 or a 500 surfaces as itself.
    return <ArchivedProposalRedirect uuid={proposal_uuid} />;
  }

  const isEditableDraft = proposal.state === 'draft' && isEditPage;

  return (
    <>
      <SidebarLayout.Header className="pb-5">
        <div className="w-100">
          {isCallManagerView ? (
            <CallManagerBreadcrumbs call={call} proposal={proposal} />
          ) : (
            <ApplicantBreadcrumbs proposal={proposal} />
          )}
          <ProposalRoleBasedTabs
            review={userReview}
            proposal={proposal}
            call={call}
          />
          <ProposalHeader
            proposal={proposal}
            className="mb-7"
            // A utility, not a decision: beside the title, not in the sidebar.
            actions={
              isCallManagerView ? (
                <DownloadProposalPdfAction proposal={proposal} />
              ) : undefined
            }
          />
          {/* The applicant's notice that the call managers handed it back;
              the call team has its returns listed on the page instead. */}
          {!isCallManagerView && proposal.open_return && (
            <ReturnedBanner
              openReturn={proposal.open_return}
              className="mb-7"
            />
          )}
          {/* No stepper while the proposal is a draft: the applicant hasn't
              submitted yet, so no workflow has started — the page shows the
              editable submission form instead. The stepper only appears from
              the submitted state onwards. */}
          {proposal.state !== 'draft' && (
            <WorkflowTimeline
              proposal={proposal}
              showDetails={isCallManagerView}
              evaluationStart={call?.evaluation_start}
            />
          )}
        </div>
      </SidebarLayout.Header>
      {isEditableDraft && hasPermissionToEdit ? (
        <ProposalSubmissionStep
          proposal={proposal}
          call={call}
          refetch={refetch}
          reviews={submittedReviews}
          canSubmitProposal={hasPermissionToSubmit}
          proposalForm={proposalForm}
        />
      ) : (
        <ProposalDetails
          proposal={proposal}
          reviews={submittedReviews}
          review={userReview}
          refetch={refetch}
        />
      )}
    </>
  );
};

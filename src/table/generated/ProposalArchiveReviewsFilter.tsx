// This file is auto-generated. Do not edit manually.

import { FunctionComponent } from 'react';
import {
  ArchivedCall,
  ArchivedProposal,
  ProposalArchiveReviewsListData,
  ProposalReviewStateEnum,
  User,
  proposalArchiveCallsList,
  proposalArchiveProposalsList,
  usersList,
} from 'waldur-js-client';

import { createLoadOptions } from '@/form/select/createLoadOptions';
import { translate } from '@/i18n';
import { AsyncSelectFilter, SelectFilter } from '@/table';

export const ProposalReviewStateOptions: ProposalReviewStateOption[] = [
  {
    label: translate('In review'),
    value: 'in_review',
  },
  {
    label: translate('Rejected'),
    value: 'rejected',
  },
  {
    label: translate('Submitted'),
    value: 'submitted',
  },
];
export interface ProposalReviewStateOption {
  label: string;
  value: ProposalReviewStateEnum;
}

export const ProposalArchiveReviewsFilter: FunctionComponent<{}> = () => (
  <>
    <SelectFilter
      title={translate('State')}
      name="state"
      getValueLabel={(value: ProposalReviewStateOption) => value?.label}
      options={ProposalReviewStateOptions}
      getOptionValue={(option: ProposalReviewStateOption) =>
        String(option.value)
      }
      getOptionLabel={(option: ProposalReviewStateOption) => option.label}
      isClearable={true}
      placeholder={translate('State')}
    />
    <AsyncSelectFilter
      title={translate('Call')}
      name="call"
      getValueLabel={(value: ArchivedCall) => value?.name}
      loadOptions={createLoadOptions(proposalArchiveCallsList, 'name')}
      defaultOptions
      getOptionValue={(option: ArchivedCall) => String(option.uuid || '')}
      getOptionLabel={(option: ArchivedCall) => String(option.name || '')}
      isClearable={true}
      placeholder={translate('Call')}
    />
    <AsyncSelectFilter
      title={translate('Proposal')}
      name="proposal"
      getValueLabel={(value: ArchivedProposal) => value?.name}
      loadOptions={createLoadOptions(proposalArchiveProposalsList, 'name')}
      defaultOptions
      getOptionValue={(option: ArchivedProposal) => String(option.uuid || '')}
      getOptionLabel={(option: ArchivedProposal) => String(option.name || '')}
      isClearable={true}
      placeholder={translate('Proposal')}
    />
    <AsyncSelectFilter
      title={translate('Reviewer')}
      name="reviewer"
      getValueLabel={(value: User) =>
        value?.full_name || value?.username || value?.email
      }
      loadOptions={createLoadOptions(usersList, 'query')}
      defaultOptions
      getOptionValue={(option: User) => String(option.uuid || '')}
      getOptionLabel={(option: User) =>
        String(option.full_name || option.username || option.email || '')
      }
      isClearable={true}
      placeholder={translate('Reviewer')}
    />
  </>
);

export const ProposalArchiveReviewsFilterFormId =
  'ProposalArchiveReviewsFilter';

export interface ProposalArchiveReviewsFilterFormData {
  state: ProposalReviewStateOption;
  call: ArchivedCall;
  proposal: ArchivedProposal;
  reviewer: User;
}

type ProposalArchiveReviewsFilterQuery =
  ProposalArchiveReviewsListData['query'];

export const selectProposalArchiveReviewsFilter = (
  values?: Partial<ProposalArchiveReviewsFilterFormData>,
): ProposalArchiveReviewsFilterQuery => {
  const filter: ProposalArchiveReviewsFilterQuery = {} as any;
  if (values) {
    if (values.state) {
      filter.state = values.state.value;
    }
    if (values.call) {
      filter.call_uuid = values.call.uuid;
    }
    if (values.proposal) {
      filter.proposal_uuid = values.proposal.uuid;
    }
    if (values.reviewer) {
      filter.reviewer_uuid = values.reviewer.uuid;
    }
  }
  return filter;
};

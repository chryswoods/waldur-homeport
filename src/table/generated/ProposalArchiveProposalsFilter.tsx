// This file is auto-generated. Do not edit manually.

import { FunctionComponent } from 'react';
import {
  ArchivedCall,
  ProposalArchiveProposalsListData,
  ProposalStates,
  User,
  proposalArchiveCallsList,
  usersList,
} from 'waldur-js-client';

import { createLoadOptions } from '@/form/select/createLoadOptions';
import { translate } from '@/i18n';
import { AsyncSelectFilter, DateTimeFilter, SelectFilter } from '@/table';

export const ProposalStatesOptions: ProposalStatesOption[] = [
  {
    label: translate('Accepted'),
    value: 'accepted',
  },
  {
    label: translate('Canceled'),
    value: 'canceled',
  },
  {
    label: translate('Draft'),
    value: 'draft',
  },
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
export interface ProposalStatesOption {
  label: string;
  value: ProposalStates;
}

export const ProposalArchiveProposalsFilter: FunctionComponent<{}> = () => (
  <>
    <SelectFilter
      title={translate('State')}
      name="state"
      getValueLabel={(value: ProposalStatesOption) => value?.label}
      options={ProposalStatesOptions}
      getOptionValue={(option: ProposalStatesOption) => String(option.value)}
      getOptionLabel={(option: ProposalStatesOption) => option.label}
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
      title={translate('Author')}
      name="created_by"
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
      placeholder={translate('Author')}
    />
    <DateTimeFilter
      title={translate('Submitted after')}
      name="submitted_after"
      placeholder={translate('Submitted after')}
    />
    <DateTimeFilter
      title={translate('Submitted before')}
      name="submitted_before"
      placeholder={translate('Submitted before')}
    />
  </>
);

export const ProposalArchiveProposalsFilterFormId =
  'ProposalArchiveProposalsFilter';

export interface ProposalArchiveProposalsFilterFormData {
  state: ProposalStatesOption;
  call: ArchivedCall;
  created_by: User;
  submitted_after: any;
  submitted_before: any;
}

type ProposalArchiveProposalsFilterQuery =
  ProposalArchiveProposalsListData['query'];

export const selectProposalArchiveProposalsFilter = (
  values?: Partial<ProposalArchiveProposalsFilterFormData>,
): ProposalArchiveProposalsFilterQuery => {
  const filter: ProposalArchiveProposalsFilterQuery = {} as any;
  if (values) {
    if (values.state) {
      filter.state = values.state.value;
    }
    if (values.call) {
      filter.call_uuid = values.call.uuid;
    }
    if (values.created_by) {
      filter.created_by_uuid = values.created_by.uuid;
    }
    if (values.submitted_after) {
      filter.submitted_after = values.submitted_after;
    }
    if (values.submitted_before) {
      filter.submitted_before = values.submitted_before;
    }
  }
  return filter;
};

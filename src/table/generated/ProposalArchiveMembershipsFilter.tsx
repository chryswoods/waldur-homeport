// This file is auto-generated. Do not edit manually.

import { FunctionComponent } from 'react';
import {
  ArchivedCall,
  ArchivedProposal,
  ProposalArchiveMembershipsListData,
  User,
  proposalArchiveCallsList,
  proposalArchiveProposalsList,
  usersList,
} from 'waldur-js-client';

import { createLoadOptions } from '@/form/select/createLoadOptions';
import { translate } from '@/i18n';
import { AsyncSelectFilter, SelectFilter, StringFilter } from '@/table';

export const ProposalArchiveMembershipsIsActiveOptions: ProposalArchiveMembershipsIsActiveOption[] =
  [
    {
      label: translate('Revoked before archiving'),
      value: false,
    },
    {
      label: translate('Held at archive time'),
      value: true,
    },
  ];
export interface ProposalArchiveMembershipsIsActiveOption {
  label: string;
  value: boolean;
}

export const ScopeKindOptions: ScopeKindOption[] = [
  {
    label: translate('Call'),
    value: 'call',
  },
  {
    label: translate('Organisation'),
    value: 'organisation',
  },
  {
    label: translate('Proposal'),
    value: 'proposal',
  },
];
export interface ScopeKindOption {
  label: string;
  value: string;
}

export const ProposalArchiveMembershipsFilter: FunctionComponent<{}> = () => (
  <>
    <SelectFilter
      title={translate('Scope')}
      name="scope_kind"
      getValueLabel={(value: ScopeKindOption) => value?.label}
      options={ScopeKindOptions}
      getOptionValue={(option: ScopeKindOption) => String(option.value)}
      getOptionLabel={(option: ScopeKindOption) => option.label}
      isClearable={true}
      placeholder={translate('Scope')}
    />
    <StringFilter
      title={translate('Role')}
      name="role_name"
      placeholder={translate('Role')}
    />
    <SelectFilter
      title={translate('Status')}
      name="is_active"
      getValueLabel={(value: ProposalArchiveMembershipsIsActiveOption) =>
        value?.label
      }
      options={ProposalArchiveMembershipsIsActiveOptions}
      getOptionValue={(option: ProposalArchiveMembershipsIsActiveOption) =>
        String(option.value)
      }
      getOptionLabel={(option: ProposalArchiveMembershipsIsActiveOption) =>
        option.label
      }
      isClearable={true}
      placeholder={translate('Status')}
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
      title={translate('Person')}
      name="user"
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
      placeholder={translate('Person')}
    />
  </>
);

export const ProposalArchiveMembershipsFilterFormId =
  'ProposalArchiveMembershipsFilter';

export interface ProposalArchiveMembershipsFilterFormData {
  scope_kind: ScopeKindOption;
  role_name: string;
  is_active: ProposalArchiveMembershipsIsActiveOption;
  call: ArchivedCall;
  proposal: ArchivedProposal;
  user: User;
}

type ProposalArchiveMembershipsFilterQuery =
  ProposalArchiveMembershipsListData['query'];

export const selectProposalArchiveMembershipsFilter = (
  values?: Partial<ProposalArchiveMembershipsFilterFormData>,
): ProposalArchiveMembershipsFilterQuery => {
  const filter: ProposalArchiveMembershipsFilterQuery = {} as any;
  if (values) {
    if (values.scope_kind) {
      filter.scope_kind = values.scope_kind.value;
    }
    if (values.role_name) {
      filter.role_name = values.role_name;
    }
    if (values.is_active) {
      filter.is_active = values.is_active.value;
    }
    if (values.call) {
      filter.call_uuid = values.call.uuid;
    }
    if (values.proposal) {
      filter.proposal_uuid = values.proposal.uuid;
    }
    if (values.user) {
      filter.user_uuid = values.user.uuid;
    }
  }
  return filter;
};

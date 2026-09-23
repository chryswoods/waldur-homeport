// This file is auto-generated. Do not edit manually.

import { FunctionComponent } from 'react';
import {
  CallStates,
  Customer,
  ProposalArchiveCallsListData,
  customersList,
} from 'waldur-js-client';

import { createLoadOptions } from '@/form/select/createLoadOptions';
import { translate } from '@/i18n';
import { AsyncSelectFilter, SelectFilter } from '@/table';

export const CallStatesOptions: CallStatesOption[] = [
  {
    label: translate('Active'),
    value: 'active',
  },
  {
    label: translate('Archived'),
    value: 'archived',
  },
  {
    label: translate('Draft'),
    value: 'draft',
  },
];
export interface CallStatesOption {
  label: string;
  value: CallStates;
}

export const ProposalArchiveCallsFilter: FunctionComponent<{}> = () => (
  <>
    <SelectFilter
      title={translate('State')}
      name="state"
      getValueLabel={(value: CallStatesOption) => value?.label}
      options={CallStatesOptions}
      getOptionValue={(option: CallStatesOption) => String(option.value)}
      getOptionLabel={(option: CallStatesOption) => option.label}
      isClearable={true}
      placeholder={translate('State')}
    />
    <AsyncSelectFilter
      title={translate('Managing organisation')}
      name="customer"
      getValueLabel={(value: Customer) => value?.name}
      loadOptions={createLoadOptions(customersList, 'query')}
      defaultOptions
      getOptionValue={(option: Customer) => String(option.uuid || '')}
      getOptionLabel={(option: Customer) => String(option.name || '')}
      isClearable={true}
      placeholder={translate('Managing organisation')}
    />
  </>
);

export const ProposalArchiveCallsFilterFormId = 'ProposalArchiveCallsFilter';

export interface ProposalArchiveCallsFilterFormData {
  state: CallStatesOption;
  customer: Customer;
}

type ProposalArchiveCallsFilterQuery = ProposalArchiveCallsListData['query'];

export const selectProposalArchiveCallsFilter = (
  values?: Partial<ProposalArchiveCallsFilterFormData>,
): ProposalArchiveCallsFilterQuery => {
  const filter: ProposalArchiveCallsFilterQuery = {} as any;
  if (values) {
    if (values.state) {
      filter.state = values.state.value;
    }
    if (values.customer) {
      filter.customer_uuid = values.customer.uuid;
    }
  }
  return filter;
};

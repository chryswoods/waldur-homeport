import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  creditTransactionsList,
  customerCreditsList,
  invoiceItemsCostsList,
  marketplaceCustomerEstimatedCostPoliciesList,
  marketplaceProjectEstimatedCostPoliciesList,
  marketplaceResourcesList,
  marketplaceSlurmPeriodicUsagePoliciesList,
  openportalManagedProjectAccountingSummaryList,
  projectCreditsList,
} from 'waldur-js-client';

import { renderWithProviders } from '@/test/harness';

import { ProjectCreditHealthBlock } from './ProjectCreditHealthBlock';

const project: any = { uuid: 'p1', customer_uuid: 'c1' };

const empty = { data: [] };

describe('ProjectCreditHealthBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectCreditsList).mockResolvedValue({
      data: [{ uuid: 'cr1', value: '500', consumption_last_month: '30' }],
    } as any);
    vi.mocked(customerCreditsList).mockResolvedValue(empty as any);
    vi.mocked(creditTransactionsList).mockResolvedValue(empty as any);
    vi.mocked(invoiceItemsCostsList).mockResolvedValue(empty as any);
    vi.mocked(marketplaceProjectEstimatedCostPoliciesList).mockResolvedValue(
      empty as any,
    );
    vi.mocked(marketplaceCustomerEstimatedCostPoliciesList).mockResolvedValue(
      empty as any,
    );
    vi.mocked(marketplaceResourcesList).mockResolvedValue(empty as any);
    vi.mocked(marketplaceSlurmPeriodicUsagePoliciesList).mockResolvedValue(
      empty as any,
    );
    vi.mocked(openportalManagedProjectAccountingSummaryList).mockResolvedValue({
      data: [],
    } as any);
  });

  // The award accounting endpoint is fork-specific. A stock Waldur project has
  // no award, and the block must neither call it nor change behaviour because
  // of it — the whole feature has to be inert without one.
  it('does not reach for the award accounting without an award', async () => {
    renderWithProviders(<ProjectCreditHealthBlock project={project} />);

    await waitFor(() => expect(projectCreditsList).toHaveBeenCalled());
    await waitFor(() => expect(creditTransactionsList).toHaveBeenCalled());

    expect(
      openportalManagedProjectAccountingSummaryList,
    ).not.toHaveBeenCalled();
  });

  it('reads it once the dashboard reports an award', async () => {
    renderWithProviders(
      <ProjectCreditHealthBlock project={project} hasAward />,
    );

    await waitFor(() =>
      expect(
        openportalManagedProjectAccountingSummaryList,
      ).toHaveBeenCalledWith({ query: { project_uuid: 'p1' } }),
    );
  });
});

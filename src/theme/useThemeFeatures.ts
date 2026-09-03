import { ENV } from '@/core/config';

/**
 * Deployment-level presentation choices for this portal.
 *
 * These are not Waldur feature flags: they are decisions about how this
 * particular deployment presents itself, hardcoded here until there is a way
 * for the chosen theme to carry them. Waldur operators would set them at a
 * global level.
 */
export const useThemeFeatures = () => {
  // Whether the MarketplaceTrigger appears in the sidebar. Useful when Waldur
  // is used as a marketplace, but not when it is used to manage calls, or when
  // the marketplace is not accessible to users.
  const ShowMarketplaceTrigger = false;

  // Whether the AuthHeader appears in the login column. It is only useful when
  // several login methods are available, and otherwise confuses users because
  // it says "Your session has expired...".
  const ShowLoginAuthHeader = false;

  // Whether to offer the local login form. Only in development, where the API
  // is on localhost — never in production.
  const ShowLocalSigninForm = ENV.apiEndpoint.includes('localhost');

  // Whether the footer items appear in the login column. They link to the
  // marketplace, calls and so on, which should only be reachable after login.
  const ShowLoginFooter = false;

  // Whether the marketplace appears in the sidebar. Turned off when Waldur is
  // only used to manage calls, or when the marketplace is not accessible.
  const ShowSidebarMarketplace = false;

  // Whether to show anything to do with "limits" on the project and customer
  // dashboards. Limits currently confuse users because they are aggregated
  // across all resources: with the limit set to the remaining credits, a
  // project's budget appears to be N * remaining_credits for N resources.
  const ShowResourceLimits = false;

  return {
    ShowMarketplaceTrigger,
    ShowLoginAuthHeader,
    ShowLocalSigninForm,
    ShowLoginFooter,
    ShowSidebarMarketplace,
    ShowResourceLimits,
  };
};

export type ThemeFeatures = ReturnType<typeof useThemeFeatures>;

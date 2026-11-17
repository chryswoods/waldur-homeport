import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  BookOpenIcon,
  CopyIcon,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { FC, useCallback, useMemo } from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import {
  marketplaceResourcesOfferingRetrieve,
  Resource,
} from 'waldur-js-client';

import { BaseButton } from 'waldur-ui';

import { LONG_STALE_TIME } from '@/core/constants';
import { Link } from '@/core/Link';
import { LoadingSpinnerSimple } from '@/core/LoadingSpinner';
import { translate } from '@/i18n';
import {
  findResourcePlan,
  resolvePlanComponents,
} from '@/marketplace/details/plan/effectiveComponents';
import { getQuotaCellProps } from '@/marketplace/resources/details/ResourceComponentItem';
import { ResourceStateField } from '@/marketplace/resources/list/ResourceStateField';
import { getResourceAccessEndpoints, isSshFormat } from '@/resource/utils';
import { useNotify } from '@/store/notify';
import { useThemeFeatures } from '@/theme/useThemeFeatures';

interface ResourceQuickInfoProps {
  resource: Resource;
}

const MAX_COMPONENTS_DISPLAY = 4;

/**
 * The links the provider set on the offering (its "Links" settings), in
 * reading order. Its documentation comes first, as the place to start.
 */
export const getOfferingLinks = (
  offering:
    | {
        documentation_url?: string | null;
        access_url?: string | null;
        helpdesk_url?: string | null;
        privacy_policy_link?: string | null;
      }
    | undefined,
): { url: string; label: string }[] =>
  [
    {
      url: offering?.documentation_url,
      label: translate('How to get started'),
    },
    { url: offering?.access_url, label: translate('Open') },
    { url: offering?.helpdesk_url, label: translate('Get help') },
    { url: offering?.privacy_policy_link, label: translate('Privacy policy') },
  ].filter((link): link is { url: string; label: string } => Boolean(link.url));

const formatSshCommand = (url: string, username: string) => {
  const [hostname, port] = url.split('://')[1].split(':');
  return `ssh ${username}@${hostname}${port ? ` -p ${port}` : ''}`;
};

export const ResourceQuickInfo: FC<ResourceQuickInfoProps> = ({ resource }) => {
  const { showSuccess } = useNotify();

  // Fetch offering details for endpoints, components, getting_started, and description
  const { data: offering, isLoading: isLoadingOffering } = useQuery({
    queryKey: ['resource-offering-details', resource.uuid],
    queryFn: async () => {
      const response = await marketplaceResourcesOfferingRetrieve({
        path: { uuid: resource.uuid },
      });
      return response.data;
    },
    staleTime: LONG_STALE_TIME, // Cache for 10 minutes
  });

  const endpoints = useMemo(
    () => (offering ? getResourceAccessEndpoints(resource, offering) : []),
    [resource, offering],
  );

  const copyText = useCallback(
    (value: string) => {
      const valueToCopy =
        isSshFormat(value) && resource.username
          ? formatSshCommand(value, resource.username)
          : value;
      navigator.clipboard.writeText(valueToCopy).then(() => {
        showSuccess(translate('Text has been copied'));
      });
    },
    [resource.username],
  );

  // Get components with their values
  const components = useMemo(() => {
    if (!offering?.components) return [];
    return resolvePlanComponents(
      offering.components,
      findResourcePlan(offering.plans, resource.plan_uuid),
    )
      .map((component) => ({
        ...component,
        ...getQuotaCellProps(component, resource),
      }))
      .filter((c) => c.usage || c.limit); // Only show components with values
  }, [offering?.components, resource]);

  const { ShowResourceLimits } = useThemeFeatures();
  const links = getOfferingLinks(offering);
  const hasGettingStarted = offering?.getting_started || endpoints.length > 0;

  return (
    <Card className="card-bordered mb-3">
      <Card.Body className="py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="flex-grow-1">
            <h5 className="mb-1">{resource.name}</h5>
            <small className="text-muted">
              {resource.offering_name} ({resource.category_title})
            </small>
          </div>
          <ResourceStateField
            resource={resource}
            shape="pill"
            tone="outline"
            size="sm"
          />
        </div>

        {/* Offering description */}
        {offering?.description && (
          <p className="text-muted fs-7 mb-3">{offering.description}</p>
        )}

        {/* The provider's own links: how to get started, access, help. */}
        {links.length > 0 && (
          <div
            className="d-flex flex-wrap gap-4 mb-3"
            data-testid="offering-links"
          >
            {links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-decoration-none d-flex align-items-center fs-7 fw-semibold"
              >
                <ArrowSquareOutIcon size={14} weight="bold" className="me-1" />
                {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Components section */}
        {isLoadingOffering ? (
          <div className="d-flex align-items-center text-muted mb-3">
            {}
            <LoadingSpinnerSimple className="me-2" />
            <span className="fs-7">{translate('Loading details...')}</span>
          </div>
        ) : (
          // Hidden where the deployment hides resource limits: there a
          // usage over a limit (0/1000) means nothing to the reader.
          ShowResourceLimits &&
          components.length > 0 && (
            <div className="mb-3">
              <div className="text-muted fs-7 fw-bold mb-2">
                {translate('Components')}
              </div>
              <Row className="g-2">
                {components
                  .slice(0, MAX_COMPONENTS_DISPLAY)
                  .map((component) => (
                    <Col key={component.type} xs={6} md={3}>
                      <div className="border rounded p-2 text-center">
                        <div className="fw-bold">
                          {component.limit
                            ? `${component.usage}/${component.limit}`
                            : component.usage}
                        </div>
                        <div className="text-muted fs-8">{component.title}</div>
                      </div>
                    </Col>
                  ))}
              </Row>
              {components.length > MAX_COMPONENTS_DISPLAY && (
                <div className="text-muted fs-8 mt-1">
                  {translate('+{count} more', {
                    count: components.length - MAX_COMPONENTS_DISPLAY,
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* Access endpoints */}
        {endpoints.length > 0 && (
          <div className="mb-3">
            <div className="text-muted fs-7 fw-bold mb-2">
              {translate('Access resource')}
            </div>
            <div className="d-flex flex-wrap gap-2">
              {endpoints.map((endpoint, index) => (
                <div
                  key={index}
                  className="d-flex align-items-center border rounded px-2 py-1"
                >
                  <a
                    href={endpoint.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-decoration-none d-flex align-items-center me-2"
                  >
                    <ArrowSquareOutIcon
                      size={14}
                      weight="bold"
                      className="me-1"
                    />
                    <span className="fs-7">{endpoint.name}</span>
                  </a>
                  <BaseButton
                    variant="text-secondary"
                    onClick={() => copyText(endpoint.url)}
                    tooltip={
                      isSshFormat(endpoint.url) && resource.username
                        ? formatSshCommand(endpoint.url, resource.username)
                        : endpoint.url
                    }
                    iconNode={<CopyIcon size={14} weight="bold" />}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="d-flex justify-content-between align-items-center">
          <div>
            {hasGettingStarted && (
              <Link
                state="marketplace-resource-details"
                params={{
                  resource_uuid: resource.uuid,
                  tab: 'getting-started',
                }}
                buttonVariant="text-primary"
                buttonSize="sm"
                className="p-0 me-3"
              >
                <BookOpenIcon size={16} weight="bold" className="me-1" />
                {translate('Getting started')}
              </Link>
            )}
          </div>
          <Link
            state="marketplace-resource-details"
            params={{ resource_uuid: resource.uuid }}
            buttonVariant="text-primary"
            buttonSize="sm"
            className="p-0"
          >
            {translate('View details')}
            <ArrowRightIcon size={16} weight="bold" className="ms-1" />
          </Link>
        </div>
      </Card.Body>
    </Card>
  );
};

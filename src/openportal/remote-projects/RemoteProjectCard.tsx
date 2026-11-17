import { GearSixIcon } from '@phosphor-icons/react';
import { ComponentPropsWithoutRef, forwardRef, ReactNode } from 'react';
import { Card } from 'react-bootstrap';
import { RemoteProject } from 'waldur-js-client';

import { buttonVariants } from 'waldur-ui';

import { translate } from '@/i18n';
import { ActionsMenu } from '@/table/ActionsDropdown';
import { DropdownActionItemType } from '@/table/types';

/** The gear in a card's corner. forwardRef: the menu anchors against it. */
const GearToggle = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<'button'>
>((props, ref) => (
  <button
    ref={ref}
    type="button"
    className={buttonVariants({
      variant: 'text-secondary',
      size: 'sm',
      iconOnly: true,
    })}
    data-testid="card-settings"
    {...props}
  >
    <GearSixIcon size={18} weight="bold" />
  </button>
));
GearToggle.displayName = 'GearToggle';

interface RemoteProjectCardProps {
  title: string;
  row: RemoteProject;
  refetch: () => void;
  /** The edits offered from the gear; no gear when empty. */
  actions?: DropdownActionItemType<RemoteProject>[];
  children: ReactNode;
}

/**
 * A section of a remote project's page with its own edits behind a gear in
 * the corner, so each box can be changed where it is shown. The page's
 * actions menu still offers every edit.
 */
export const RemoteProjectCard = ({
  title,
  row,
  refetch,
  actions = [],
  children,
}: RemoteProjectCardProps) => (
  <Card className="h-100">
    <Card.Header className="d-flex justify-content-between align-items-center">
      <Card.Title className="mb-0">{title}</Card.Title>
      {actions.length > 0 && (
        <ActionsMenu
          toggle={
            <GearToggle
              aria-label={translate('Edit {section}', { section: title })}
            />
          }
          side="bottom"
          align="end"
        >
          {actions.map((Action, index) => (
            <Action key={index} row={row} refetch={refetch} />
          ))}
        </ActionsMenu>
      )}
    </Card.Header>
    <Card.Body>{children}</Card.Body>
  </Card>
);

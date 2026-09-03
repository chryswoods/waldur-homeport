import { FunctionComponent } from 'react';
import { Modal } from 'react-bootstrap';
import type { AwardDetails } from 'waldur-js-client';

import { BaseButton } from '@/core/buttons/BaseButton';
import { translate } from '@/i18n';
import { CloseDialogButton } from '@/modal/CloseDialogButton';

interface AwardLockedDialogProps {
  resolve: {
    awardDetails: AwardDetails;
    title: string;
    message: string;
  };
}

/**
 * Shown in place of a membership or role action that the funding award
 * controls, pointing the user at the award instead.
 */
export const AwardLockedDialog: FunctionComponent<AwardLockedDialogProps> = ({
  resolve: { awardDetails, title, message },
}) => {
  const awardUrl = awardDetails.award?.url;
  const awardLabel = awardDetails.award?.id || awardDetails.award?.url;

  return (
    <>
      <Modal.Header>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{message}</p>
        {awardUrl && (
          <a href={awardUrl} target="_blank" rel="noopener noreferrer">
            {awardLabel || awardUrl}
          </a>
        )}
      </Modal.Body>
      <Modal.Footer>
        {awardUrl && (
          <BaseButton
            variant="primary"
            label={translate('Go to award')}
            onClick={() =>
              window.open(awardUrl, '_blank', 'noopener,noreferrer')
            }
          />
        )}
        <CloseDialogButton label={translate('Close')} variant="secondary" />
      </Modal.Footer>
    </>
  );
};

import { FC } from 'react';
import type { AwardDetails } from 'waldur-js-client';

import { translate } from '@/i18n';

interface Props {
  allowedDomains: AwardDetails['allowed_domains'];
  contactEmail?: string;
  projectName?: string;
}

export const DomainRestrictionNotice: FC<Props> = ({
  allowedDomains,
  contactEmail,
  projectName,
}) => {
  if (allowedDomains === null || allowedDomains === undefined) return null;

  const mailtoHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(
        `Request to add email domains to project: ${projectName ?? ''}`,
      )}`
    : undefined;

  return (
    <div className="mb-4 text-muted fs-7">
      <p className="mb-2">
        {translate(
          'Only people whose emails match the below domains can be added to this award.',
        )}{' '}
        {mailtoHref ? (
          <>
            {translate('Please')}{' '}
            <a href={mailtoHref}>{translate('email your allocator')}</a>{' '}
            {translate(
              'to ask for additional domains to be approved. Please include your Award ID, Award Name and list of domains / emails that you wish to invite.',
            )}
          </>
        ) : (
          translate(
            'Please contact your allocator to ask for additional domains to be approved. Please include your Award ID, Award Name and list of domains / emails that you wish to invite.',
          )
        )}{' '}
        {translate(
          'Note, personal (non-work) email addresses are normally not allowed to be used.',
        )}
      </p>
      {allowedDomains.length > 0 ? (
        <ul className="mb-0">
          {allowedDomains.map((domain) => (
            <li key={domain}>
              <code>{domain}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-0">
          {translate(
            'No email domains are currently approved for this project.',
          )}
          {mailtoHref ? (
            <>
              {translate('Please')}{' '}
              <a href={mailtoHref}>{translate('email your allocator')}</a>{' '}
              {translate(
                'to ask for additional domains to be approved. Please include your Award ID, Award Name and list of domains / emails that you wish to invite.',
              )}
            </>
          ) : (
            translate(
              'Please contact your allocator to ask for additional domains to be approved. Please include your Award ID, Award Name and list of domains / emails that you wish to invite.',
            )
          )}{' '}
          {translate(
            'Note, personal (non-work) email addresses are normally not allowed to be used.',
          )}
        </p>
      )}
    </div>
  );
};

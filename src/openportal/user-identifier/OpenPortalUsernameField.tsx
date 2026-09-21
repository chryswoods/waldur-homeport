import { FC } from 'react';
import { User } from 'waldur-js-client';

import { EditFieldProvider } from '@/form/EditFieldContext';
import { StringEditField } from '@/form/editFields';
import FormTable from '@/form/FormTable';
import { translate } from '@/i18n';

import { shortnameDescription, validateShortname } from './shortname';
import { useOpenPortalUsername } from './useOpenPortalUsername';

interface OpenPortalUsernameFieldProps {
  user: User;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * The user's OpenPortal username, editable exactly once.
 *
 * The value lives on `openportal-userinfo`, not on the user record, so this
 * row carries its own `EditFieldProvider` with a callback that writes through
 * `set_shortname`. Nesting a provider overrides the enclosing one for this
 * subtree only, which keeps the row looking and behaving like every other
 * field in the panel while writing somewhere else entirely.
 *
 * Once `shortname` is set the backend refuses any change, so the row goes
 * read-only rather than offering an edit that can only fail.
 */
export const OpenPortalUsernameField: FC<OpenPortalUsernameFieldProps> = ({
  user,
  disabled,
  disabledReason,
}) => {
  const { shortname, isLoading, error, setShortname } =
    useOpenPortalUsername(user);

  const label = translate('Username');

  if (isLoading) {
    return <FormTable.Item label={label} value={translate('Loading...')} />;
  }

  // Without knowing whether a username exists we cannot tell an unset field
  // from a set one, and offering an edit on a guess risks a confusing failure
  // on a choice that cannot be undone. Show the row as unavailable instead.
  if (error) {
    return (
      <FormTable.Item
        label={label}
        value={translate('Could not be loaded')}
        description={translate(
          'The username service could not be reached. Reload the page to try again.',
        )}
      />
    );
  }

  if (shortname) {
    return (
      <FormTable.Item
        label={label}
        value={shortname}
        description={translate(
          'Your username on any systems. It was set once and cannot be changed.',
        )}
      />
    );
  }

  return (
    <EditFieldProvider
      scope={{ shortname: null }}
      callback={(formData) => setShortname(formData.shortname)}
    >
      <StringEditField
        name="shortname"
        label={label}
        required
        disabled={disabled}
        tooltip={disabledReason}
        validate={validateShortname}
        description={shortnameDescription()}
      />
    </EditFieldProvider>
  );
};

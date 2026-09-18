import { EyeIcon } from '@phosphor-icons/react';
import { FunctionComponent } from 'react';

import { translate } from '@/i18n';
import { ActionItem } from '@/resource/actions/ActionItem';
import { useUser } from '@/workspace/hooks';

import { useImpersonate } from './useImpersonate';

export const UserImpersonateButton: FunctionComponent<{ row }> = ({ row }) => {
  const user = useUser();
  const { impersonate, isPending } = useImpersonate(row.uuid);

  if (!(user?.uuid !== row.uuid && user?.is_staff)) {
    return null;
  }

  // Deliberately not gated on the target having a session of their own.
  // Impersonation sends X-IMPERSONATED-USER-UUID alongside the *caller's* token
  // and the backend swaps the identity on that request
  // (waldur_core/core/authentication.py, authenticate_credentials): it requires
  // the caller to be staff, a passkey-verified session where that is enforced,
  // and the target to exist. Whether the target has ever logged in does not
  // come into it -- and has_active_session only reports whether they hold an
  // auth token, so the button was refusing exactly the case staff most need,
  // checking a new account before handing it over.
  return (
    <ActionItem
      title={translate('Impersonate')}
      action={impersonate}
      iconNode={<EyeIcon weight="bold" />}
      disabled={isPending}
      size="sm"
    />
  );
};

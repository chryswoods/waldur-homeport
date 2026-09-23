import { FC } from 'react';

import { formatDateTime } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';

import { type ArchivedNote } from './useArchivedProposalNotes';

/**
 * Renders nothing at all when there are no notes to show.
 *
 * "No notes" and "you may not see the notes" are the same thing here — the
 * endpoint 404s rather than returning an empty list for an applicant — and an
 * empty panel saying so would advertise that something was written about them.
 */
export const ArchivedProposalNotes: FC<{ notes: ArchivedNote[] | null }> = ({
  notes,
}) => {
  if (!notes || notes.length === 0) {
    return null;
  }
  return (
    <Panel title={translate('Call manager notes')} cardBordered>
      <div className="d-flex flex-column gap-4">
        {notes.map((note, index) => (
          <div key={index}>
            <div className="fs-7 text-muted">
              {[note.author, note.timestamp && formatDateTime(note.timestamp)]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <div className="text-prewrap">{note.text}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
};

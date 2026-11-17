import { Fragment } from 'react';
import { FormStepResponse } from 'waldur-js-client';

import { formatDateTime } from '@/core/dateUtils';
import FormTable from '@/form/FormTable';
import { translate } from '@/i18n';
import { renderFieldOrDash } from '@/table/utils';

/**
 * An answer as the backend stores it: a string, a number, or a list for a
 * multiple-choice question. Typed loosely by the schema, hence unknown.
 */
export const formatAnswer = (answer: unknown): string | null => {
  if (Array.isArray(answer)) {
    return answer.length ? answer.join(', ') : null;
  }
  if (answer === null || answer === undefined || answer === '') {
    return null;
  }
  if (typeof answer === 'object') {
    return JSON.stringify(answer);
  }
  return String(answer);
};

/**
 * Who gave a response, for end-of-project answers, which each person gives
 * for themselves. Null for a proposal's answers, which are the team's.
 */
export const respondentLabel = (
  response: Pick<FormStepResponse, 'respondent_name' | 'respondent_email'>,
): string | null => {
  const name = response.respondent_name?.trim();
  const email = response.respondent_email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || null;
};

interface FormResponsesSectionProps {
  responses?: FormStepResponse[] | null;
  className?: string;
  /** Defaults to "Form answers". */
  title?: string;
}

/**
 * Answers to Formbricks forms, step by step, read-only: a proposal's, or a
 * project's end-of-project ones, each labelled with who gave it.
 *
 * Used on the applicant's draft, the proposal page and the review
 * page. The backend has already narrowed the steps to what the viewer may
 * see (reviewers get only the reviewer-visible ones), so this shows all it is
 * given, and nothing at all when there is nothing to show.
 */
export const FormResponsesSection = ({
  responses,
  className,
  title,
}: FormResponsesSectionProps) => {
  if (!responses?.length) {
    return null;
  }

  return (
    <FormTable.Card
      title={title ?? translate('Form answers')}
      className={className ?? 'card-bordered mb-7'}
    >
      <FormTable detailsMode>
        {/* Keyed by position as well: several people may answer one step,
            and each answer is its own block. */}
        {responses.map((step, index) => (
          <Fragment key={`${step.step_key}-${index}`}>
            <tr className="gray-bg">
              <th colSpan={2} className={index > 0 ? 'pt-5' : undefined}>
                <span className="fs-4 fw-bolder text-dark">
                  {step.step_label}
                </span>
                {respondentLabel(step) && (
                  <span
                    className="fs-5 fw-semibold text-dark ms-2"
                    data-testid="form-respondent"
                  >
                    {translate('— {respondent}', {
                      respondent: respondentLabel(step),
                    })}
                  </span>
                )}
                {step.submitted_at && (
                  <span className="text-muted fs-7 fw-normal ms-3">
                    {translate('Answered {date}', {
                      date: formatDateTime(step.submitted_at),
                    })}
                  </span>
                )}
              </th>
            </tr>
            {step.questions.map((question) => (
              <FormTable.Item
                key={question.question_id}
                label={question.label}
                value={renderFieldOrDash(formatAnswer(question.answer))}
              />
            ))}
          </Fragment>
        ))}
      </FormTable>
    </FormTable.Card>
  );
};

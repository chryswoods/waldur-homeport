import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/harness';

import { FormResponsesSection, respondentLabel } from './FormResponsesSection';

const response = (overrides = {}): any => ({
  step_key: 'feedback',
  step_label: 'Project feedback',
  submitted_at: '2027-01-30T10:00:00Z',
  respondent_name: null,
  respondent_email: null,
  questions: [{ question_id: 'q1', label: 'How did it go?', answer: 'Well' }],
  ...overrides,
});

describe('respondentLabel', () => {
  it('gives the name and email, or whichever there is', () => {
    expect(
      respondentLabel({
        respondent_name: 'Jane Smith',
        respondent_email: 'jane@example.org',
      }),
    ).toBe('Jane Smith (jane@example.org)');
    expect(respondentLabel({ respondent_name: 'Jane Smith' })).toBe(
      'Jane Smith',
    );
    expect(respondentLabel({ respondent_email: 'jane@example.org' })).toBe(
      'jane@example.org',
    );
    expect(
      respondentLabel({ respondent_name: null, respondent_email: null }),
    ).toBeNull();
  });
});

describe('FormResponsesSection', () => {
  it("shows two people's answers to one form as two labelled blocks", () => {
    renderWithProviders(
      <FormResponsesSection
        responses={[
          response({
            respondent_name: 'Jane Smith',
            respondent_email: 'jane@example.org',
          }),
          response({
            respondent_name: 'Raj Patel',
            respondent_email: 'raj@example.org',
            questions: [
              { question_id: 'q1', label: 'How did it go?', answer: 'Slowly' },
            ],
          }),
        ]}
      />,
    );
    const labels = screen.getAllByTestId('form-respondent');
    expect(labels.map((label) => label.textContent)).toEqual([
      '— Jane Smith (jane@example.org)',
      '— Raj Patel (raj@example.org)',
    ]);
    expect(screen.getAllByText('Project feedback')).toHaveLength(2);
    expect(screen.getByText('Well')).toBeInTheDocument();
    expect(screen.getByText('Slowly')).toBeInTheDocument();
  });

  it("labels nobody on a proposal's answers", () => {
    renderWithProviders(<FormResponsesSection responses={[response()]} />);
    expect(screen.getByText('Project feedback')).toBeInTheDocument();
    expect(screen.queryByTestId('form-respondent')).toBeNull();
  });
});

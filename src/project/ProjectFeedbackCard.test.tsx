import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectFormsLink, projectFormsRetrieve } from 'waldur-js-client';

import { isFeatureVisible } from '@/features/connect';
import { renderWithProviders } from '@/test/harness';
import { useUser } from '@/workspace/hooks';

import { ProjectFeedbackCard } from './ProjectFeedbackCard';

vi.mock('@/features/connect', () => ({ isFeatureVisible: vi.fn() }));

const project = { uuid: 'proj-1', customer_uuid: 'cust-1' };

const form = (overrides = {}): any => ({
  project_uuid: 'proj-1',
  flow_key: 'airr-end',
  flow_name: 'AIRR end of project',
  available: true,
  opens_on: '2026-12-18',
  is_open: true,
  can_fill_in: true,
  steps: [
    {
      key: 'feedback',
      label: 'Feedback',
      completed: false,
      submitted_at: null,
      in_progress: false,
    },
  ],
  missing: ['Feedback'],
  responses: [],
  ...overrides,
});

describe('ProjectFeedbackCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFeatureVisible).mockReturnValue(true);
    vi.mocked(useUser).mockReturnValue({
      is_staff: false,
      permissions: [],
    } as any);
    vi.spyOn(window.location, 'assign').mockImplementation(() => {});
  });

  it('opens a single-use link to the form in this tab', async () => {
    vi.mocked(useUser).mockReturnValue({ is_staff: true } as any);
    vi.mocked(projectFormsRetrieve).mockResolvedValue({ data: form() } as any);
    vi.mocked(projectFormsLink).mockResolvedValue({
      data: { survey_url: 'https://forms.example.org/s/x?project_uuid=1' },
    } as any);
    renderWithProviders(<ProjectFeedbackCard project={project} />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Fill in Feedback' }),
    );
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://forms.example.org/s/x?project_uuid=1',
      ),
    );
    expect(projectFormsLink).toHaveBeenCalledWith({
      path: { uuid: 'proj-1' },
      body: { step: 'feedback' },
    });
  });

  it('shows nothing before the forms open', async () => {
    vi.mocked(useUser).mockReturnValue({ is_staff: true } as any);
    vi.mocked(projectFormsRetrieve).mockResolvedValue({
      data: form({ is_open: false, can_fill_in: false }),
    } as any);
    const { container } = renderWithProviders(
      <ProjectFeedbackCard project={project} />,
    );
    await waitFor(() => expect(projectFormsRetrieve).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('stays once every form is answered, to read and change them', async () => {
    vi.mocked(useUser).mockReturnValue({ is_staff: true } as any);
    vi.mocked(projectFormsRetrieve).mockResolvedValue({
      data: form({
        missing: [],
        steps: [
          {
            key: 'feedback',
            label: 'Feedback',
            completed: true,
            submitted_at: '2027-01-30T10:00:00Z',
            in_progress: false,
          },
        ],
        responses: [
          {
            step_key: 'feedback',
            step_label: 'Feedback',
            submitted_at: '2027-01-30T10:00:00Z',
            questions: [
              { question_id: 'q1', label: 'How did it go?', answer: 'Well' },
            ],
          },
        ],
      }),
    } as any);
    renderWithProviders(<ProjectFeedbackCard project={project} />);

    expect(
      await screen.findByText(/Thank you for your feedback/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Feedback' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Well')).toBeInTheDocument();
  });

  it('shows nothing for a project without end-of-project forms', async () => {
    vi.mocked(projectFormsRetrieve).mockRejectedValue({
      status: 400,
      response: { status: 400 },
    });
    const { container } = renderWithProviders(
      <ProjectFeedbackCard project={project} />,
    );
    await waitFor(() => expect(projectFormsRetrieve).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing to someone who may not fill them in', async () => {
    vi.mocked(projectFormsRetrieve).mockResolvedValue({
      data: form({ can_fill_in: false }),
    } as any);
    const { container } = renderWithProviders(
      <ProjectFeedbackCard project={project} />,
    );
    await waitFor(() => expect(projectFormsRetrieve).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

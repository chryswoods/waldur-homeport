import { afterEach, describe, expect, it } from 'vitest';

import { ENV } from '@/core/config';

import { domainText, translate } from './translate';

describe('translate (domain message overrides)', () => {
  afterEach(() => {
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = undefined;
  });

  it('leaves messages unchanged when no translation domain is configured', () => {
    expect(translate('Marketplace')).toBe('Marketplace');
  });

  it('swaps marketplace terminology for the service_catalogue domain', () => {
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'service_catalogue';
    expect(translate('Marketplace')).toBe('Service catalog');
    expect(translate('Explore marketplace')).toBe('Explore service catalog');
  });

  it('swaps marketplace terminology for the academic domain, including its own overrides', () => {
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'academic';
    expect(translate('Marketplace')).toBe('Service catalog');
    expect(translate('Purchase')).toBe('Request');
  });

  it('falls back to the original message for an unknown domain', () => {
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'not-a-real-domain';
    expect(translate('Marketplace')).toBe('Marketplace');
  });
});

describe('the airrportal domain', () => {
  afterEach(() => {
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = undefined;
  });

  it('calls organisations allocators and projects awards', () => {
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'airrportal';
    expect(translate('Organizations')).toBe('Allocators');
    expect(translate('Organisation')).toBe('Allocator');
    expect(translate('Projects')).toBe('Awards');
    expect(translate('Create a project')).toBe('Create an award');
  });

  it('leaves the project a proposal describes alone', () => {
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'airrportal';
    expect(translate('Project details')).toBe('Project details');
    expect(translate('Project team')).toBe('Project team');
  });

  it('words the proposal summary for the site only, by slot', () => {
    expect(domainText('proposal.summary', 'Summary')).toBe('Summary');
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'airrportal';
    expect(domainText('proposal.summary', 'Summary')).toBe(
      'Summary (will be made public if your application is accepted)',
    );
    // The cost panel's heading is the same word, and stays.
    expect(translate('Summary')).toBe('Summary');
  });

  it("calls the proposal's name its title, and only that name", () => {
    expect(domainText('proposal.title', 'Name')).toBe('Name');
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'airrportal';
    expect(domainText('proposal.title', 'Name')).toBe('Project title');
    expect(translate('Name')).toBe('Name');
  });

  it('warns applicants not to put anything confidential in the details', () => {
    const plain = 'Basic information about your research project.';
    expect(domainText('proposal.details.subtitle', plain)).toBe(plain);
    (ENV.plugins.WALDUR_CORE as any).TRANSLATION_DOMAIN = 'airrportal';
    expect(domainText('proposal.details.subtitle', plain)).toMatch(
      /^Provide basic information about your research project\. As this information may be shared publicly, do not include any confidential/,
    );
  });
});

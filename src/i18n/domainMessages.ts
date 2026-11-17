import { translate } from 'waldur-i18n-runtime';

/**
 * Deployment-specific terminology overrides, keyed by
 * `ENV.plugins.WALDUR_CORE.TRANSLATION_DOMAIN`. Wired into the shared
 * translate() as a message-transform hook in ./translate.
 */
export const DOMAIN_MESSAGES: Record<string, Record<string, string>> = {
  service_catalogue: {
    'Explore {deployment} Marketplace': translate(
      'Explore {deployment} service catalog',
    ),
    'Explore marketplace': translate('Explore service catalog'),
    'Go to marketplace': translate('Go to service catalog'),
    'Label that is visible to users in Marketplace.': translate(
      'Label that is visible to users in service catalog.',
    ),
    Marketplace: translate('Service catalog'),
    'Marketplace offering': translate('Service catalog offering'),
    'Marketplace offerings': translate('Service catalog offerings'),
    'Marketplace resource pull has been scheduled.': translate(
      'Resource pull has been scheduled.',
    ),
    'Marketplace UUID': translate('Service catalog UUID'),
    'Unable to pull marketplace resource.': translate(
      'Unable to pull resource.',
    ),
    'Welcome to marketplace': translate('Welcome to service catalog'),
    'Marketplace services can only be provisioned for a certain affiliation. You currently do not have any organizations or projects connected with your account.':
      translate(
        'Services can only be provisioned for a certain affiliation. You currently do not have any organizations or projects connected with your account.',
      ),
    'Register as a customer of our portal and provide your cloud services through the Marketplace.':
      translate(
        'Register as a customer of our portal and provide your cloud services through the service catalog.',
      ),
    'Resource is not connected to the marketplace yet.': translate(
      'Resource is not connected to the service catalog yet.',
    ),
    'Tell me what you need and I will help you find the best offering in the marketplace.':
      translate(
        'Tell me what you need and I will help you find the best offering in the service catalog.',
      ),
    'There are no categories in marketplace yet.': translate(
      'There are no categories in catalog yet.',
    ),
    'There are no offerings in marketplace yet.': translate(
      'There are no offerings in catalog yet.',
    ),
    'Unique ID of a resource created via Marketplace': translate(
      'Unique ID of a resource created via service catalog',
    ),
    'You can find offerings to order in the marketplace': translate(
      'You can find offerings to order in the service catalog',
    ),
  },
  academic: {
    'Become a customer of our portal. Provision IT services from the Marketplace and manage your team from one place.':
      translate(
        'Become a customer of our portal. Provision IT services from the catalog and manage your team from one place.',
      ),
    'Explore {deployment} Marketplace': translate(
      'Explore {deployment} service catalog',
    ),
    'Explore marketplace': translate('Explore service catalog'),
    'Go to marketplace': translate('Go to service catalog'),
    'Label that is visible to users in Marketplace.': translate(
      'Label that is visible to users in service catalog.',
    ),
    Marketplace: translate('Service catalog'),
    'Marketplace offering': translate('Service catalog offering'),
    'Marketplace offerings': translate('Service catalog offerings'),
    'Marketplace resource pull has been scheduled.': translate(
      'Resource pull has been scheduled.',
    ),
    'Marketplace UUID': translate('Service catalog UUID'),
    'Unable to pull marketplace resource.': translate(
      'Unable to pull resource.',
    ),
    'Welcome to marketplace': translate('Welcome to service catalog'),
    'Marketplace services can only be provisioned for a certain affiliation. You currently do not have any organizations or projects connected with your account.':
      translate(
        'Services can only be provisioned for a certain affiliation. You currently do not have any organizations or projects connected with your account.',
      ),
    'Register as a customer of our portal and provide your cloud services through the Marketplace.':
      translate(
        'Register as a customer of our portal and provide your cloud services through the service catalog.',
      ),
    'Resource is not connected to the marketplace yet.': translate(
      'Resource is not connected to the service catalog yet.',
    ),
    'Tell me what you need and I will help you find the best offering in the marketplace.':
      translate(
        'Tell me what you need and I will help you find the best offering in the service catalog.',
      ),
    'There are no categories in marketplace yet.': translate(
      'There are no categories in catalog yet.',
    ),
    'There are no offerings in marketplace yet.': translate(
      'There are no offerings in catalog yet.',
    ),
    'Unique ID of a resource created via Marketplace': translate(
      'Unique ID of a resource created via service catalog',
    ),
    'You can find offerings to order in the marketplace': translate(
      'You can find offerings to order in the service catalog',
    ),
    Purchase: translate('Request'),
    'You have the right to purchase service without additional approval.':
      translate(
        'You have the right to request service without additional approval.',
      ),
  },
  academic_shared: {
    'Become a customer of our portal. Provision IT services from the Marketplace and manage your team from one place.':
      translate(
        'Become a customer of our portal. Provision IT services from the catalog and manage your team from one place.',
      ),
    'Explore {deployment} Marketplace': translate(
      'Explore {deployment} service catalog',
    ),
    'Explore marketplace': translate('Explore service catalog'),
    'Go to marketplace': translate('Go to service catalog'),
    'Label that is visible to users in Marketplace.': translate(
      'Label that is visible to users in service catalog.',
    ),
    Marketplace: translate('Service catalog'),
    'Marketplace offering': translate('Service catalog offering'),
    'Marketplace offerings': translate('Service catalog offerings'),
    'Marketplace resource pull has been scheduled.': translate(
      'Resource pull has been scheduled.',
    ),
    'Marketplace UUID': translate('Service catalog UUID'),
    'Unable to pull marketplace resource.': translate(
      'Unable to pull resource.',
    ),
    'Welcome to marketplace': translate('Welcome to service catalog'),
    'Marketplace services can only be provisioned for a certain affiliation. You currently do not have any organizations or projects connected with your account.':
      translate(
        'Services can only be provisioned for a certain affiliation. You currently do not have any organizations or projects connected with your account.',
      ),
    'Register as a customer of our portal and provide your cloud services through the Marketplace.':
      translate(
        'Register as a customer of our portal and provide your cloud services through the service catalog.',
      ),
    'Resource is not connected to the marketplace yet.': translate(
      'Resource is not connected to the service catalog yet.',
    ),
    'Tell me what you need and I will help you find the best offering in the marketplace.':
      translate(
        'Tell me what you need and I will help you find the best offering in the service catalog.',
      ),
    'There are no categories in marketplace yet.': translate(
      'There are no categories in catalog yet.',
    ),
    'There are no offerings in marketplace yet.': translate(
      'There are no offerings in catalog yet.',
    ),
    'Unique ID of a resource created via Marketplace': translate(
      'Unique ID of a resource created via service catalog',
    ),
    'You can find offerings to order in the marketplace': translate(
      'You can find offerings to order in the service catalog',
    ),
    Purchase: translate('Request'),
    'You have the right to purchase service without additional approval.':
      translate(
        'You have the right to request service without additional approval.',
      ),
  },
  // AIRR Portal: an organisation is an allocator, running calls and
  // allocating time, and a project is an award. Only where the words mean
  // those: "Project details" and "Project team" on a proposal still mean
  // the research project being proposed, so they are left alone.
  airrportal: {
    Organisation: translate('Allocator'),
    Organisations: translate('Allocators'),
    Organization: translate('Allocator'),
    Organizations: translate('Allocators'),
    'Organization dashboard': translate('Allocator dashboard'),
    'Organization name': translate('Allocator name'),
    'Organization UUID': translate('Allocator UUID'),
    'Organization abbreviation': translate('Allocator abbreviation'),
    'Organization events': translate('Allocator events'),
    'Organization group': translate('Allocator group'),
    'Organization groups': translate('Allocator groups'),
    'Organization Groups': translate('Allocator Groups'),
    'Organization has been created.': translate('Allocator has been created.'),
    'Organization has signed a fixed price agreement': translate(
      'Allocator has signed a fixed price agreement',
    ),
    'Organization removal': translate('Allocator removal'),
    'Organization role': translate('Allocator role'),
    'Organization roles': translate('Allocator roles'),
    'Organization updated successfully': translate(
      'Allocator updated successfully',
    ),
    'Organization description': translate('Allocator description'),
    'Organization member': translate('Allocator member'),
    'Organization resources': translate('Allocator resources'),
    'Organization summary': translate('Allocator summary'),
    'Organization info': translate('Allocator info'),
    'Create organization': translate('Create allocator'),
    'Create an organization': translate('Create an allocator'),
    'Create organisation': translate('Create allocator'),
    'Select organization': translate('Select allocator'),
    'Select an organization': translate('Select an allocator'),
    'Select organisation': translate('Select allocator'),
    'Select organization...': translate('Select allocator...'),
    'Select organizations...': translate('Select allocators...'),
    'Selected organization': translate('Selected allocator'),
    'No organizations': translate('No allocators'),
    'No organizations found': translate('No allocators found'),
    'No organisations found': translate('No allocators found'),
    'All organizations': translate('All allocators'),
    'Remove organization': translate('Remove allocator'),
    'Role in organization': translate('Role in allocator'),
    'Join organization': translate('Join allocator'),
    'Usage by organization': translate('Usage by allocator'),
    'By organization': translate('By allocator'),
    'Call managing organization': translate('Call managing allocator'),
    'Managing organisation': translate('Managing allocator'),
    'Is call managing organization': translate('Is call managing allocator'),
    'Registering the managing organisation': translate(
      'Registering the managing allocator',
    ),
    'Onboard organisation': translate('Onboard allocator'),
    'Unable to create organization.': translate('Unable to create allocator.'),
    'Unable to delete organization.': translate('Unable to delete allocator.'),
    'Unable to load organizations': translate('Unable to load allocators'),
    'Pending organization approval': translate('Pending allocator approval'),
    'Organization requests': translate('Allocator requests'),
    'Search and select organization...': translate(
      'Search and select allocator...',
    ),
    'Please select organization first': translate(
      'Please select allocator first',
    ),
    'Select organization first': translate('Select allocator first'),
    'Move to organization': translate('Move to allocator'),
    'Cancel organization creation': translate('Cancel allocator creation'),
    'Could not create organization': translate('Could not create allocator'),
    Project: translate('Award'),
    Projects: translate('Awards'),
    'Project dashboard': translate('Award dashboard'),
    'Project name': translate('Award name'),
    'Project description': translate('Award description'),
    'Project end date': translate('Award end date'),
    'Project End Date': translate('Award End Date'),
    'Project events': translate('Award events'),
    'Project role': translate('Award role'),
    'Project roles': translate('Award roles'),
    'Project removal': translate('Award removal'),
    'Project has been created.': translate('Award has been created.'),
    'Project has been updated.': translate('Award has been updated.'),
    'Project could not be moved.': translate('Award could not be moved.'),
    'Project could not be updated.': translate('Award could not be updated.'),
    'Project cost': translate('Award cost'),
    'Project image': translate('Award image'),
    'Project type': translate('Award type'),
    'Project update requests': translate('Award update requests'),
    'Project updates': translate('Award updates'),
    'Project field name': translate('Award field name'),
    'Project has reached its end date.': translate(
      'Award has reached its end date.',
    ),
    'Project ID': translate('Award ID'),
    'Project identifier': translate('Award identifier'),
    'Project members': translate('Award members'),
    'Project info': translate('Award info'),
    'Project detail': translate('Award detail'),
    'Project page': translate('Award page'),
    'Project link': translate('Award link'),
    'Project ends': translate('Award ends'),
    'Project duration': translate('Award duration'),
    'Project expired': translate('Award expired'),
    'Project deleted.': translate('Award deleted.'),
    'Project permanently deleted.': translate('Award permanently deleted.'),
    'Project recovered.': translate('Award recovered.'),
    'Recover Project': translate('Recover Award'),
    'Project Removed': translate('Award Removed'),
    'Create project': translate('Create award'),
    'Create a project': translate('Create an award'),
    'Add project': translate('Add award'),
    'Delete project': translate('Delete award'),
    'Update project': translate('Update award'),
    'Move project': translate('Move award'),
    'Move to project': translate('Move to award'),
    'Select project': translate('Select award'),
    'Select a project': translate('Select an award'),
    'Select a project.': translate('Select an award.'),
    'Select a project...': translate('Select an award...'),
    'Select project...': translate('Select award...'),
    'Select projects': translate('Select awards'),
    'Select project(s)': translate('Select award(s)'),
    'Selected projects': translate('Selected awards'),
    'Search for project': translate('Search for award'),
    'Search and select project...': translate('Search and select award...'),
    'Type to search projects...': translate('Type to search awards...'),
    'No projects': translate('No awards'),
    'No projects found': translate('No awards found'),
    'No projects found.': translate('No awards found.'),
    'There are no projects.': translate('There are no awards.'),
    'No active projects': translate('No active awards'),
    'All projects': translate('All awards'),
    'Active projects': translate('Active awards'),
    'Total projects': translate('Total awards'),
    'Role in project': translate('Role in award'),
    'Usage by project': translate('Usage by award'),
    'By project': translate('By award'),
    'Unable to create project.': translate('Unable to create award.'),
    'Unable to delete project.': translate('Unable to delete award.'),
    'Unable to update project.': translate('Unable to update award.'),
    'Unable to load projects': translate('Unable to load awards'),
    'Failed to load projects': translate('Failed to load awards'),
    'Loading projects': translate('Loading awards'),
    'Unnamed project': translate('Unnamed award'),
    'Unnamed Project': translate('Unnamed Award'),
    'Project has been approved.': translate('Award has been approved.'),
    'Project has been rejected.': translate('Award has been rejected.'),
    'Unable to approve project.': translate('Unable to approve award.'),
    'Unable to reject project.': translate('Unable to reject award.'),
    'Export projects to Excel': translate('Export awards to Excel'),
    'Notify project team': translate('Notify award team'),
    'Project Timeline': translate('Award Timeline'),
    'Pending project': translate('Pending award'),
    'Requested project': translate('Requested award'),
    'Requested project name': translate('Requested award name'),
    'Requested project description': translate('Requested award description'),
    'Organization / Project': translate('Allocator / Award'),
    'Filter by organization/project': translate('Filter by allocator/award'),
    'Users by organization': translate('Users by allocator'),
    'Members by organization': translate('Members by allocator'),
    // Carried over from the old awards site's wording.
    '{sender} has invited you to join {name} {type} in {role} role.': translate(
      "{sender} has invited you to join the {type} called '{name}' in the role of '{role}'.",
    ),
    'Upload additional documents, which support the proposal and help to review it.':
      translate(
        'You must complete any application forms described in the call details (available from the Documents tab of the Call Details page). Please upload the completed forms here.',
      ),
    'Upload supporting documentation': translate(
      'Upload any forms described in the call details (available from the Documents tab of the Call Details page).',
    ),
    'Sign in with {label}': translate('Click here to login'),
    Confidential: translate(
      'Involves confidential, sensitive or GDPR-protected information',
    ),
    Confidentiality: translate(
      'Confidential, sensitive or GDPR-protected information',
    ),
    'Civilian purpose': translate('Non-commercial or research only'),
  },
};

/**
 * Places where one deployment words a field differently, though the same
 * words mean something else elsewhere: "Summary" heads the cost panel too,
 * so the proposal's summary field is named by slot rather than by its text.
 */
export type DomainSlot =
  'proposal.summary' | 'proposal.title' | 'proposal.details.subtitle';

export const DOMAIN_SLOTS: Record<
  string,
  Partial<Record<DomainSlot, string>>
> = {
  airrportal: {
    // Tells applicants how Summary and Description differ, and gives the
    // site leave to publish the summaries of accepted applications.
    'proposal.summary': translate(
      'Summary (will be made public if your application is accepted)',
    ),
    // "Name" is used all over the app, so the proposal's own is a slot.
    'proposal.title': translate('Project title'),
    // On the applicant's form only: guidance for whoever fills it in.
    'proposal.details.subtitle': translate(
      'Provide basic information about your research project. As this information may be shared publicly, do not include any confidential, sensitive, or commercially restricted information.',
    ),
  },
};

import { getIconUrl } from '@/core/api';

import DefaultHeroImage from './brics-hero.jpg';

/**
 * CSS `background-image` value for the login page hero.
 *
 * `getIconUrl` builds a URL unconditionally, so it can never be used as a
 * truthiness check for "did the operator upload a hero image?" — deployments
 * that did not upload one simply serve 404 for it. Layering the bundled
 * default beneath the configured one lets the browser skip the layer that
 * fails to load and paint the fallback instead, so the hero is never empty.
 *
 * Same idiom as the marketplace and call management landing heroes.
 *
 * The bundled default is this deployment's own image rather than upstream's
 * stock photograph, so the branding is right even before an operator uploads
 * a hero_image.
 */
export const getHeroBackgroundImage = () =>
  `url(${getIconUrl('hero_image')}), url(${DefaultHeroImage})`;

// Used in the browser (scripts/matomo.ts): no import from the core here, it
// would pull build-time code into the page.
export interface MatomoConfig {
  /** Address of the Matomo instance, ending with `/`. */
  base: string;
  siteId: string;
}

/** The tracker commands, without cookies (decided by the owner). */
export function matomoCommands(config: MatomoConfig): unknown[][] {
  return [
    ['disableCookies'],
    ['setTrackerUrl', `${config.base}matomo.php`],
    ['setSiteId', config.siteId],
    ['trackPageView'],
    ['enableLinkTracking'],
  ];
}

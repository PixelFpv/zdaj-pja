import { useSyncExternalStore } from 'react';

export type Consent = 'granted' | 'denied';

const KEY = 'zdaj-pja.consent';
const GTM_ID = 'GTM-NBS4DT4J';
const GA_ID = 'G-52651534LX';
/** Lets document.title settle after a route change, and collapses quick redirects. */
const SEND_DELAY = 400;

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

function readConsent(): Consent | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

let consent: Consent | null = null;
let bannerOpen = false;
let loaded = false;
let currentPath: string | null = null;
let lastSentPath: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let snapshot: { consent: Consent | null; bannerOpen: boolean } = { consent, bannerOpen };

const listeners = new Set<() => void>();
function emit() {
  snapshot = { consent, bannerOpen };
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useConsent = () => useSyncExternalStore(subscribe, () => snapshot);

// Google's tag only accepts the arguments object, not a plain array.
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/** Nothing from Google is requested before this runs, and it only runs after consent. */
function loadTag() {
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // The container's own history listener would report every route a second time
  // with a "#" URL, so page views are sent only from sendPageView below.
  window.dataLayer.push({ 'gtm.blocklist': ['ccd_em_page_view'] });
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  // Must come before "js": the container sends its own first page view otherwise.
  gtag('set', { send_page_view: false });
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.append(script);
}

/** GA4 reports drop everything after "#", so routes are reported as real paths. */
const virtualUrl = (path: string) => `${location.origin}${location.pathname.replace(/\/$/, '')}${path}`;

function sendPageView() {
  if (!loaded || consent !== 'granted' || currentPath === null || currentPath === lastSentPath) return;
  const pageLocation = virtualUrl(currentPath);
  const referrer = lastSentPath === null ? document.referrer : virtualUrl(lastSentPath);
  lastSentPath = currentPath;
  // "set" also gives scroll and click events from this page the right address.
  gtag('set', { page_location: pageLocation, page_referrer: referrer });
  gtag('event', 'page_view', { send_to: GA_ID, page_location: pageLocation, page_referrer: referrer, page_title: document.title });
}

/** The address reported for a route. The default tab and filters such as scope are not separate pages. */
export function trackedPath(pathname: string, search: string): string {
  const tab = new URLSearchParams(search).get('tab');
  return tab && tab !== 'learn' ? `${pathname}?tab=${tab}` : pathname;
}

export function trackPage(path: string) {
  currentPath = path;
  clearTimeout(timer);
  timer = setTimeout(sendPageView, SEND_DELAY);
}

function clearAnalyticsCookies() {
  const parts = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length; i++) domains.push(`; domain=.${parts.slice(i).join('.')}`);
  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0].trim();
    if (!/^_g(a|id|at)/.test(name)) continue;
    for (const domain of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
  }
}

export function setConsent(value: Consent) {
  const wasLoaded = loaded;
  consent = value;
  bannerOpen = false;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* the choice lasts until the page is closed */
  }
  if (value === 'granted') {
    loadTag();
    sendPageView();
  } else {
    clearAnalyticsCookies();
    // A loaded tag can't be removed from the page, so a reload is what actually stops it.
    if (wasLoaded) {
      location.reload();
      return;
    }
  }
  emit();
}

export function openConsentBanner() {
  bannerOpen = true;
  emit();
}

export function initAnalytics() {
  consent = readConsent();
  bannerOpen = consent === null;
  snapshot = { consent, bannerOpen };
  if (consent === 'granted') loadTag();
}

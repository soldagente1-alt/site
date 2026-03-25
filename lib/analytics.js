import app from '../api/firebaseApp';
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";

let analyticsPromise = null;

async function getSiteAnalytics() {
  if (typeof window === "undefined") return null;

  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((ok) => (ok ? getAnalytics(app) : null))
      .catch(() => null);
  }

  return analyticsPromise;
}

export async function trackEvent(name, params = {}) {
  const analytics = await getSiteAnalytics();
  if (!analytics) return;
  logEvent(analytics, name, params);
}

export async function trackPageView(path, title = document.title) {
  await trackEvent("page_view", {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: title,
  });
}
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import app from "./firebaseApp";

let analyticsPromise = null;

export function getSiteAnalytics() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => {
        if (!supported) return null;

        try {
          return getAnalytics(app);
        } catch (error) {
          console.warn("Analytics não pôde ser iniciado:", error);
          return null;
        }
      })
      .catch((error) => {
        console.warn("Analytics não suportado neste ambiente:", error);
        return null;
      });
  }

  return analyticsPromise;
}

export async function trackEvent(eventName, params = {}) {
  const analytics = await getSiteAnalytics();
  if (!analytics) return false;

  try {
    logEvent(analytics, eventName, params);
    return true;
  } catch (error) {
    console.warn(`Falha ao registrar evento "${eventName}":`, error);
    return false;
  }
}

export async function trackPageView(path, title = document.title) {
  const analytics = await getSiteAnalytics();
  if (!analytics) return false;

  try {
    logEvent(analytics, "page_view", {
      page_title: title,
      page_location: window.location.href,
      page_path: path || window.location.pathname,
    });
    return true;
  } catch (error) {
    console.warn("Falha ao registrar page_view:", error);
    return false;
  }
}

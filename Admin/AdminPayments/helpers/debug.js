import { auth } from "../../../../api/firebaseAuth";

const PROJECT_ID = "soldagente-30f00";
const ADMIN_PAYMENTS_DEBUG = true;

function isLocalHost() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

function maskToken(token = "") {
  const s = String(token || "");
  if (!s) return "";
  if (s.length <= 20) return `${s.slice(0, 6)}...${s.slice(-4)}`;
  return `${s.slice(0, 12)}...${s.slice(-8)}`;
}

function safeCloneForDebug(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function adminPaymentsDebug(label, payload) {
  if (!ADMIN_PAYMENTS_DEBUG) return;
  const stamp = new Date().toISOString();
  console.log(`[AdminPayments DEBUG][${stamp}] ${label}`, safeCloneForDebug(payload));
  if (typeof window !== "undefined") {
    window.__adminPaymentsDebug = {
      ...(window.__adminPaymentsDebug || {}),
      [label]: safeCloneForDebug(payload),
      lastLabel: label,
      lastAt: stamp,
    };
  }
}

function getFunctionsBase() {
  const base = `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;
  adminPaymentsDebug("functionsBase", {
    projectId: PROJECT_ID,
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
    origin: typeof window !== "undefined" ? window.location.origin : "",
    isLocalHost: isLocalHost(),
    base,
  });
  return base;
}

async function getCurrentAuthToken() {
  const currentUser = auth.currentUser || null;
  return currentUser ? currentUser.getIdToken() : "";
}

export {
  PROJECT_ID,
  ADMIN_PAYMENTS_DEBUG,
  isLocalHost,
  maskToken,
  safeCloneForDebug,
  adminPaymentsDebug,
  getFunctionsBase,
  getCurrentAuthToken,
};

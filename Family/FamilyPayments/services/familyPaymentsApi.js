const PROJECT_ID = 'soldagente-30f00';

export function isLocalHost() {
  return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
}

export function getFunctionsBase() {
  return `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;
}

export async function callFamilyPaymentsFunction(path, body, currentUser = null) {
  const token = currentUser ? await currentUser.getIdToken() : "";
  const resp = await fetch(`${getFunctionsBase()}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || data?.message || 'Erro ao chamar Function');
  return data;
}

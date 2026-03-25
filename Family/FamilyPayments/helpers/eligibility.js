import {
  getFirstNonEmpty,
  parseMoneyToNumber,
  pickFirstPositive,
  getPaymentDateObj,
} from './formatters';

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isPaymentCurrentMonth(payment) {
  const dd = getPaymentDateObj(payment);
  return !!dd && monthKey(dd) === monthKey(new Date());
}

export function getCurrentMonthPayment(payments) {
  const mk = monthKey(new Date());
  return (
    (payments || [])
      .filter((p) => p.status === 'pending' || p.status === 'overdue')
      .filter((p) => {
        const dd = getPaymentDateObj(p);
        return dd && monthKey(dd) === mk;
      })
      .sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0))[0] || null
  );
}

export function getFamilyPlanId(obj) {
  return (
    obj?.plan_id ||
    obj?.planId ||
    obj?.planID ||
    obj?.selected_plan_id ||
    obj?.selectedPlanId ||
    obj?.subscription_plan_id ||
    null
  );
}

export function getPlanMonthlyFromPlanDoc(planDoc) {
  if (!planDoc) return null;
  const nested = planDoc?.plan || planDoc?.data || null;
  return pickFirstPositive(
    planDoc?.monthly_price,
    planDoc?.monthly_value,
    planDoc?.price_monthly,
    planDoc?.value_monthly,
    planDoc?.plan_monthly_price,
    planDoc?.plan_monthly_value,
    planDoc?.price,
    planDoc?.value,
    planDoc?.amount_monthly,
    planDoc?.mensalidade,
    nested?.monthly_price,
    nested?.monthly_value,
    nested?.price_monthly,
    nested?.value_monthly,
    nested?.price,
    nested?.value,
    nested?.mensalidade,
  );
}

export function inferPlanMonthlyFromPayments(payments) {
  const amounts = (payments || [])
    .map((p) => parseMoneyToNumber(p?.amount))
    .filter((n) => n !== null && n > 0);
  if (!amounts.length) return null;
  const counts = new Map();
  for (const n of amounts) {
    const key = n.toFixed(2);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey = null;
  let bestCount = -1;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  const best = bestKey ? Number(bestKey) : null;
  if (best !== null && Number.isFinite(best) && best > 0) return best;
  const sorted = [...amounts].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || null;
}

export function normalizeStatus(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isFamilyActiveNow(family) {
  const status = normalizeStatus(family?.status);
  const activationStatus = normalizeStatus(family?.activation_status);
  return status === 'active' || activationStatus === 'kit_ativo';
}

export function getNfseStatus(payment) {
  return normalizeStatus(
    payment?.nfse_status || payment?.nfse?.status || payment?.fiscal?.nfse_status || payment?.fiscal?.status,
  );
}

export function hasIssuedNfse(payment) {
  const status = getNfseStatus(payment);
  return status === 'issued' || status === 'authorized' || status === 'completed';
}

export function getNfseUrl(payment) {
  return getFirstNonEmpty(
    payment?.nfse_pdf_url,
    payment?.nfse_consulta_url,
    payment?.nfse_xml_url,
    payment?.nfse?.pdfUrl,
    payment?.nfse?.consultaUrl,
    payment?.nfse?.xmlUrl,
    payment?.fiscal?.pdfUrl,
  );
}

export function getNfseError(payment) {
  return getFirstNonEmpty(
    payment?.nfse_last_error,
    payment?.nfse_error,
    payment?.nfse?.lastError,
    payment?.nfse?.error,
    payment?.fiscal?.lastError,
  );
}

export function getNfseTitle(payment, familyIsActive, canNf) {
  if (!familyIsActive) return 'Nota fiscal disponível somente após ativação da família.';
  if (!canNf) return 'NFS-e disponível apenas para parcela paga.';
  if (hasIssuedNfse(payment)) return 'Abrir NFS-e emitida';
  const status = getNfseStatus(payment);
  if (status === 'requested' || status === 'processing' || status === 'pending') {
    return 'Atualizar emissão da NFS-e';
  }
  return 'Emitir NFS-e';
}

export const DUE_DAY_OPTIONS = [5, 10, 15, 20, 25];

export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'corrente', label: 'Conta corrente' },
  { value: 'poupanca', label: 'Conta poupança' },
];

export function buildPixChargeRequest({ paymentId, familyId, allowAnticipation = false, force = false, source = '' }) {
  return { paymentId, familyId, allowAnticipation, force, source };
}

export function getDefaultBillingSettings() {
  return {
    providerName: 'bnb',
    providerMode: 'mock',
    currentMonthOnly: true,
    pix: {
      enabled: true,
      currentMonthOnly: true,
      key: '',
      beneficiaryName: 'Sol da Gente',
      beneficiaryCity: 'Feira de Santana',
      description: 'Mensalidade Sol da Gente',
    },
    boleto: {
      enabled: true,
      onDemandOnly: true,
      usePaymentDueDate: true,
      currentMonthOnly: false,
    },
    autoDebit: {
      enabled: false,
      fallbackToPix: true,
      fallbackToBoleto: false,
      type: 'manual',
    },
    raw: {},
  };
}

export function getAutoDebitFallbackLabel(settings) {
  if (settings?.autoDebit?.fallbackToPix && settings?.autoDebit?.fallbackToBoleto) return 'reabrir Pix e depois boleto';
  if (settings?.autoDebit?.fallbackToPix) return 'reabrir Pix';
  if (settings?.autoDebit?.fallbackToBoleto) return 'oferecer boleto';
  return 'sem fallback';
}

export function getAutoDebitLastAttempt(payment) { return payment?.billing?.autoDebit?.lastAttempt || null; }
export function computeNextDueDate(dueDay, fromDate = new Date()) { const day = Number(dueDay); if (!Number.isFinite(day) || day < 1 || day > 28) return null; const y = fromDate.getFullYear(); const m = fromDate.getMonth(); let candidate = new Date(y, m, day, 12, 0, 0, 0); if (candidate.getTime() <= fromDate.getTime()) candidate = new Date(y, m + 1, day, 12, 0, 0, 0); return candidate; }
export function getPixPayload(payment) { return payment?.asaas?.pix?.payload || payment?.billing?.pix?.payload || payment?.kobana?.pix_brcode || payment?.pix_code || ''; }
export function getPixEncodedImageBase64(payment) { return payment?.asaas?.pix?.encodedImage || payment?.billing?.pix?.encodedImage || payment?.pix_encodedImage || ''; }
export function getBoletoUrl(payment) { return payment?.asaas?.boleto?.bankSlipUrl || payment?.billing?.boleto?.bankSlipUrl || payment?.kobana?.boleto_url || payment?.boleto_url || ''; }
export function getDigitableLine(payment) { return payment?.asaas?.boleto?.digitableLine || payment?.billing?.boleto?.digitableLine || payment?.kobana?.digitable_line || payment?.digitable_line || ''; }
export function getAsaasPixPaymentId(payment) { return payment?.asaas?.pix?.paymentId || payment?.billing?.pix?.paymentId || ''; }
export function getAsaasBoletoPaymentId(payment) { return payment?.asaas?.boleto?.paymentId || payment?.billing?.boleto?.paymentId || ''; }
export function hasAnyPix(payment) { return !!getPixPayload(payment) || !!getAsaasPixPaymentId(payment); }
export function hasAnyBoleto(payment) { return !!getBoletoUrl(payment) || !!getDigitableLine(payment) || !!getAsaasBoletoPaymentId(payment); }
export function openUrl(url) { if (url) window.open(url, '_blank', 'noopener,noreferrer'); }

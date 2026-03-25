import {
  parseMoneyToNumber,
  pickFirstPositive,
} from "./formatters";

function buildPixChargeRequest({
  paymentId,
  familyId,
  allowAnticipation = false,
  force = false,
  source = "",
}) {
  return {
    paymentId,
    familyId,
    allowAnticipation,
    force,
    source,
  };
}

function getDefaultBillingSettings() {
  return {
    providerName: "bnb",
    providerMode: "mock",
    currentMonthOnly: true,
    pix: {
      enabled: true,
      currentMonthOnly: true,
      key: "",
      beneficiaryName: "Sol da Gente",
      beneficiaryCity: "Feira de Santana",
      description: "Mensalidade Sol da Gente",
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
      type: "manual",
    },
    raw: {},
  };
}

function getPixPayload(payment) {
  return (
    payment?.asaas?.pix?.payload ||
    payment?.billing?.pix?.payload ||
    payment?.kobana?.pix_brcode ||
    payment?.pix_code ||
    ""
  );
}

function getPixEncodedImageBase64(payment) {
  return (
    payment?.asaas?.pix?.encodedImage ||
    payment?.billing?.pix?.encodedImage ||
    payment?.pix_encodedImage ||
    ""
  );
}

function getBoletoUrl(payment) {
  return (
    payment?.asaas?.boleto?.bankSlipUrl ||
    payment?.billing?.boleto?.bankSlipUrl ||
    payment?.kobana?.boleto_url ||
    payment?.boleto_url ||
    ""
  );
}

function getDigitableLine(payment) {
  return (
    payment?.asaas?.boleto?.digitableLine ||
    payment?.billing?.boleto?.digitableLine ||
    payment?.kobana?.digitable_line ||
    payment?.digitable_line ||
    ""
  );
}

function getAsaasPixPaymentId(payment) {
  return payment?.asaas?.pix?.paymentId || payment?.billing?.pix?.paymentId || "";
}

function getAsaasBoletoPaymentId(payment) {
  return payment?.asaas?.boleto?.paymentId || payment?.billing?.boleto?.paymentId || "";
}

function hasAnyPix(payment) {
  return !!getPixPayload(payment) || !!getAsaasPixPaymentId(payment);
}

function hasAnyBoleto(payment) {
  return !!getBoletoUrl(payment) || !!getDigitableLine(payment) || !!getAsaasBoletoPaymentId(payment);
}

function getBillingBeneficiaryLabel(familyData, groupData, billingSettings) {
  return (
    groupData?.pix_beneficiary ||
    familyData?.pix_beneficiary ||
    billingSettings?.pix?.beneficiaryName ||
    "Sol da Gente"
  );
}

export {
  buildPixChargeRequest,
  getDefaultBillingSettings,
  getPixPayload,
  getPixEncodedImageBase64,
  getBoletoUrl,
  getDigitableLine,
  getAsaasPixPaymentId,
  getAsaasBoletoPaymentId,
  hasAnyPix,
  hasAnyBoleto,
  getBillingBeneficiaryLabel,
  parseMoneyToNumber,
  pickFirstPositive,
};

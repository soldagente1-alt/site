import {
  adminPaymentsDebug,
  getFunctionsBase,
  getCurrentAuthToken,
  maskToken,
} from "../helpers/debug";
import { getDefaultBillingSettings } from "../helpers/billing";
import { resolveTemplateLayout, fetchLayoutFromJsonUrl } from "../helpers/documents";

async function callFunction(path, body) {
  const startedAt = Date.now();
  const token = await getCurrentAuthToken();
  const url = `${getFunctionsBase()}/${path}`;
  const payload = body || {};

  adminPaymentsDebug("functionRequest", {
    path,
    url,
    method: "POST",
    hasToken: !!token,
    tokenPreview: maskToken(token),
    payload,
  });

  let resp;
  let rawText = "";
  let data = {};

  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    rawText = await resp.text();
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { rawText };
    }

    adminPaymentsDebug("functionResponse", {
      path,
      url,
      ok: !!resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      durationMs: Date.now() - startedAt,
      data,
      rawText,
    });
  } catch (error) {
    adminPaymentsDebug("functionNetworkError", {
      path,
      url,
      durationMs: Date.now() - startedAt,
      errorMessage: error?.message || String(error),
      stack: error?.stack || "",
    });
    throw error;
  }

  if (!resp.ok) {
    const err = new Error(data?.error || data?.message || `Erro ao chamar Function (${resp.status})`);
    err.status = resp.status;
    err.responseData = data;
    err.responseText = rawText;
    throw err;
  }

  return data;
}

async function loadBillingSettings() {
  const data = await callFunction("getBillingSettings", {});
  return data?.settings || getDefaultBillingSettings();
}

async function loadDocumentTemplates() {
  const data = await callFunction("familyGetPaymentTemplates", {});
  const receipt = data?.templates?.receipt_pre_homologation || null;
  const invoice = data?.templates?.invoice_post_homologation || null;

  const templates = {
    receipt_pre_homologation: receipt,
    invoice_post_homologation: invoice,
  };

  const layouts = {
    receipt_pre_homologation: resolveTemplateLayout(
      receipt?.layout_zones,
      "receipt_pre_homologation",
      "receipt"
    ),
    invoice_post_homologation: resolveTemplateLayout(
      invoice?.layout_zones,
      "invoice_post_homologation",
      "invoice"
    ),
  };

  if (!layouts.receipt_pre_homologation && receipt?.json?.download_url) {
    layouts.receipt_pre_homologation = await fetchLayoutFromJsonUrl(
      receipt.json.download_url,
      "receipt_pre_homologation",
      "receipt"
    );
  }

  if (!layouts.invoice_post_homologation && invoice?.json?.download_url) {
    layouts.invoice_post_homologation = await fetchLayoutFromJsonUrl(
      invoice.json.download_url,
      "invoice_post_homologation",
      "invoice"
    );
  }

  return { templates, layouts };
}

const createPixCharge = (payload) => callFunction("createPixCharge", payload);
const createBoletoCharge = (payload) => callFunction("createBoletoCharge", payload);
const confirmSandboxPayment = (payload) => callFunction("confirmSandboxPayment", payload);
const issueNfse = (payload) => callFunction("issueNfseGovBr", payload);
const refreshNfse = (payload) => callFunction("refreshNfseGovBr", payload);
const markPaymentPaid = (payload) => callFunction("adminPaymentsMarkPaid", payload);
const cancelPayment = (payload) => callFunction("adminPaymentsCancelPayment", payload);

export {
  callFunction,
  loadBillingSettings,
  loadDocumentTemplates,
  createPixCharge,
  createBoletoCharge,
  confirmSandboxPayment,
  issueNfse,
  refreshNfse,
  markPaymentPaid,
  cancelPayment,
};

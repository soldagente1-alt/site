import {
  moneyBRL,
  formatDateBR,
  getPaymentIssueDate,
  getPaymentDateObj,
  formatCompetence,
  getStatusLabel,
  getFamilyDisplayName,
  getFamilyCpf,
  getFamilyGroupLabel,
} from "./formatters";
import {
  getBillingBeneficiaryLabel,
  getPixPayload,
  getDigitableLine,
} from "./billing";

function getDocTemplateTitle(kind) {
  if (kind === "receipt") return "Recibo de pagamento";
  if (kind === "invoice") return "Fatura / Boleto";
  return "Documento";
}

function buildDocumentNumber(kind, payment) {
  const year = new Date().getFullYear();
  const suffix = String(payment?.id || "doc").slice(-6).toUpperCase();
  if (kind === "receipt") return `RCP-${year}-${suffix}`;
  if (kind === "invoice") return `FAT-${year}-${suffix}`;
  return `${year}-${suffix}`;
}

function resolveTemplateLayout(layoutZones, templateId, fallbackKind) {
  if (!layoutZones) return null;
  if (layoutZones?.canvas && layoutZones?.fields) return layoutZones;
  if (layoutZones?.[templateId]?.canvas && layoutZones?.[templateId]?.fields) {
    return layoutZones[templateId];
  }
  if (layoutZones?.[fallbackKind]?.canvas && layoutZones?.[fallbackKind]?.fields) {
    return layoutZones[fallbackKind];
  }
  return null;
}

async function fetchLayoutFromJsonUrl(url, templateId, fallbackKind) {
  const response = await fetch(url);
  const json = await response.json();
  return resolveTemplateLayout(json, templateId, fallbackKind);
}

function buildDocPreviewData({
  kind,
  payment,
  familyData,
  groupData,
  planName,
  planMonthlyAmount,
  template,
  layout,
  billingSettings,
}) {
  const amount = Number(payment?.amount || planMonthlyAmount || 0);
  const installmentText = `Parcela ${payment?.installment_number || "-"}/${payment?.total_installments || "-"}`;
  const competence = formatCompetence(payment);
  const customerName = getFamilyDisplayName(familyData);
  const customerCpf = getFamilyCpf(familyData);
  const familyGroup = getFamilyGroupLabel(familyData, groupData);
  const beneficiary = getBillingBeneficiaryLabel(familyData, groupData, billingSettings);
  const pixPayload = getPixPayload(payment);
  const digitableLine = getDigitableLine(payment);

  if (kind === "receipt") {
    return {
      kind,
      title: getDocTemplateTitle(kind),
      templateId: "receipt_pre_homologation",
      template,
      layout,
      number: payment?.receipt_number || buildDocumentNumber(kind, payment),
      issueDate: formatDateBR(getPaymentIssueDate(payment)),
      status: payment?.status === "paid" ? "Pago" : getStatusLabel(payment?.status),
      dueDate: `${installmentText} • ${competence}`,
      competence: planName || "Pagamento antecipado",
      customerName,
      customerCpf,
      familyGroup,
      items: [
        {
          description: `Pagamento antecipado da ${installmentText.toLowerCase()} referente à competência ${competence}.`,
          qty: "1",
          value: `R$ ${moneyBRL(amount)}`,
        },
      ],
      declarationLine1: `Recebemos de ${customerName} o valor referente a esta parcela antecipada.`,
      declarationLine2: `Referência: ${installmentText} • competência ${competence}.`,
      declarationLine3: "Documento emitido antes da homologação / ativação da família.",
      verificationCode:
        payment?.receipt_code ||
        `${familyData?.id ? String(familyData.id).slice(0, 6).toUpperCase() : "FAM"}-${
          payment?.id ? String(payment.id).slice(-6).toUpperCase() : "DOC"
        }`,
      qrPayload: pixPayload,
      pixKey: "",
      pixBeneficiary: "",
      pixCopyPaste: "",
      boletoLine: "",
      observationLine1: "",
      observationLine2: "",
      observationLine3: "",
    };
  }

  return {
    kind,
    title: getDocTemplateTitle(kind),
    templateId: "invoice_post_homologation",
    template,
    layout,
    number: payment?.invoice_number || buildDocumentNumber(kind, payment),
    issueDate: formatDateBR(getPaymentIssueDate(payment)),
    status: getStatusLabel(payment?.status),
    dueDate: formatDateBR(getPaymentDateObj(payment)),
    competence,
    customerName,
    customerCpf,
    familyGroup,
    items: [
      {
        description: `Mensalidade ${planName ? `do plano ${planName}` : "do grupo"} • ${competence} • ${installmentText}.`,
        qty: "1",
        value: `R$ ${moneyBRL(amount)}`,
      },
    ],
    declarationLine1: "",
    declarationLine2: "",
    declarationLine3: "",
    verificationCode: "",
    qrPayload: pixPayload,
    pixKey: pixPayload ? "Disponível via QR ou copia e cola" : "A gerar",
    pixBeneficiary: beneficiary,
    pixCopyPaste: pixPayload,
    boletoLine: digitableLine,
    observationLine1: `Fatura referente à competência ${competence}.`,
    observationLine2:
      payment?.status === "paid"
        ? "Pagamento já identificado para esta parcela."
        : "Documento válido para cobrança da parcela no vencimento.",
    observationLine3: planName
      ? `Plano: ${planName}.`
      : "Documento pós-homologação para acompanhamento da parcela.",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPrintableDocumentHtml(docData, qrUrl = "") {
  const layout = docData?.layout;
  if (!layout?.canvas || !layout?.fields) return "";
  const fields = layout.fields;
  const toPct = (value, total) => `${(Number(value || 0) / Number(total || 1)) * 100}%`;

  function styleFromBox(box, extra = "") {
    if (!box) return "";
    return [
      `left:${toPct(box.x, layout.canvas.width)}`,
      `top:${toPct(box.y, layout.canvas.height)}`,
      `width:${toPct(box.w, layout.canvas.width)}`,
      `height:${toPct(box.h, layout.canvas.height)}`,
      extra,
    ]
      .filter(Boolean)
      .join(";");
  }

  function textField(box, value, opts = {}) {
    if (!box || !value) return "";
    const {
      align = "left",
      size = 14,
      weight = 700,
      wrap = false,
      mono = false,
      color = "#5A3A2A",
    } = opts;

    return `<div class="field" style="${styleFromBox(
      box,
      [
        "display:flex",
        `align-items:${wrap ? "flex-start" : "center"}`,
        `justify-content:${align === "right" ? "flex-end" : "flex-start"}`,
        `color:${color}`,
        `font-family:${mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "Georgia, serif"}`,
        `font-weight:${weight}`,
        `font-size:${size}px`,
        `line-height:${wrap ? "1.35" : "1.1"}`,
        `white-space:${wrap ? "pre-wrap" : "nowrap"}`,
        "overflow:hidden",
      ].join(";")
    )}">${escapeHtml(value)}</div>`;
  }

  const itemsHtml = (docData.items || [])
    .map(
      (item) =>
        `<div style="display:grid;grid-template-columns:1fr 70px 120px;gap:12px;align-items:center;min-height:42px;"><div>${escapeHtml(
          item.description
        )}</div><div style="text-align:right;">${escapeHtml(item.qty)}</div><div style="text-align:right;font-weight:700;">${escapeHtml(
          item.value
        )}</div></div>`
    )
    .join("");

  const itemsAreaHtml = fields?.itemsArea
    ? `<div class="field" style="${styleFromBox(fields.itemsArea, "color:#5A3A2A;font-family:Georgia,serif;font-size:11px;display:grid;align-content:start;gap:14px;padding-top:2px;")}">${itemsHtml}</div>`
    : "";

  const qrHtml =
    fields?.qrArea && qrUrl
      ? `<div class="field" style="${styleFromBox(fields.qrArea, "display:flex;align-items:center;justify-content:center;")}"><img src="${qrUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain;" /></div>`
      : "";

  const barcodeHtml = fields?.barcodeArea
    ? `<div class="field" style="${styleFromBox(fields.barcodeArea, `background:repeating-linear-gradient(90deg, rgba(69,49,35,0.95) 0 2px, transparent 2px 4px, rgba(69,49,35,0.95) 4px 5px, transparent 5px 8px);opacity:${docData?.boletoLine ? 0.9 : 0.15};border-radius:8px;`)}"></div>`
    : "";

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(
    docData.title
  )}</title><style>* { box-sizing: border-box; } body { margin: 0; padding: 24px; background: #f8fafc; font-family: Arial, sans-serif; } .page { width: 1024px; max-width: 100%; margin: 0 auto; } .doc { position: relative; width: 100%; aspect-ratio: ${layout.canvas.width} / ${layout.canvas.height}; background-image: url('${
    docData.template?.png?.download_url || ""
  }'); background-size: cover; background-position: center; overflow: hidden; border-radius: 20px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12); background-color: #fff; } .field { position: absolute; } @media print { body { padding: 0; background: #fff; } .page { width: 100%; margin: 0; } .doc { border-radius: 0; box-shadow: none; break-inside: avoid; } }</style></head><body><div class="page"><div class="doc">${textField(fields?.number, docData.number, { size: 14 })}${textField(fields?.issueDate, docData.issueDate, { size: 14 })}${textField(fields?.status, docData.status, { size: 14 })}${textField(fields?.dueDate, docData.dueDate, { size: 13 })}${textField(fields?.competence, docData.competence, { size: 14 })}${textField(fields?.customerName, docData.customerName, { size: 15 })}${textField(fields?.customerCpf, docData.customerCpf, { size: 14 })}${textField(fields?.familyGroup, docData.familyGroup, { size: 13 })}${textField(fields?.declarationLine1, docData.declarationLine1, { size: 12 })}${textField(fields?.declarationLine2, docData.declarationLine2, { size: 12 })}${textField(fields?.declarationLine3, docData.declarationLine3, { size: 12 })}${textField(fields?.verificationCode, docData.verificationCode, { size: 12 })}${textField(fields?.pixKey, docData.pixKey, { size: 11 })}${textField(fields?.pixBeneficiary, docData.pixBeneficiary, { size: 11 })}${textField(fields?.pixCopyPaste, docData.pixCopyPaste, { size: 10, wrap: true, mono: true, weight: 600 })}${textField(fields?.boletoLine, docData.boletoLine, { size: 10, wrap: true, mono: true, weight: 700 })}${textField(fields?.observationLine1, docData.observationLine1, { size: 11 })}${textField(fields?.observationLine2, docData.observationLine2, { size: 11 })}${textField(fields?.observationLine3, docData.observationLine3, { size: 11 })}${itemsAreaHtml}${qrHtml}${barcodeHtml}</div></div></body></html>`;
}

export {
  getDocTemplateTitle,
  buildDocumentNumber,
  resolveTemplateLayout,
  fetchLayoutFromJsonUrl,
  buildDocPreviewData,
  escapeHtml,
  buildPrintableDocumentHtml,
};

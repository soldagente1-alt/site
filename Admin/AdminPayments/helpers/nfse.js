function getNfseStatus(payment) {
  return String(
    payment?.nfse_status || payment?.nfse?.status || payment?.invoice?.nfseStatus || ""
  )
    .trim()
    .toLowerCase();
}

function hasIssuedNfse(payment) {
  if (!payment) return false;
  return (
    getNfseStatus(payment) === "issued" ||
    !!payment?.nfse_number ||
    !!payment?.nfse?.number ||
    !!payment?.nfse_pdf_url ||
    !!payment?.nfse?.pdfUrl ||
    !!payment?.nfse_consulta_url ||
    !!payment?.nfse?.consultaUrl
  );
}

function getNfseUrl(payment) {
  return (
    payment?.nfse_pdf_url ||
    payment?.nfse_consulta_url ||
    payment?.nfse_xml_url ||
    payment?.nfse?.pdfUrl ||
    payment?.nfse?.consultaUrl ||
    payment?.nfse?.xmlUrl ||
    payment?.nfse?.url ||
    ""
  );
}

function getNfseError(payment) {
  return (
    payment?.nfse_error ||
    payment?.nfse?.error ||
    payment?.invoice?.nfseError ||
    ""
  );
}

function getNfseTitle(payment, familyIsActive, canNf) {
  if (!familyIsActive) return "A NFS-e é liberada apenas após ativação da família.";
  if (hasIssuedNfse(payment)) return "Abrir NFS-e emitida";
  if (canNf) return "Emitir NFS-e nacional";
  return "A NFS-e é liberada apenas para parcelas pagas.";
}

function openUrl(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export {
  getNfseStatus,
  hasIssuedNfse,
  getNfseUrl,
  getNfseError,
  getNfseTitle,
  openUrl,
};

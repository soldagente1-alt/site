import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  buildDocPreviewData,
  buildPrintableDocumentHtml,
  getNfseError,
  getNfseStatus,
  getNfseUrl,
  hasIssuedNfse,
  openUrl,
} from "../helpers";
import {
  issueNfse,
  loadDocumentTemplates,
  refreshNfse,
} from "../services/adminPaymentsApi";

export default function useAdminPaymentsDocuments({
  billingSettings,
  selectedFamilyData,
  selectedGroupData,
  planName,
  planMonthlyAmount,
  familyIsActive,
  reloadPayments,
}) {
  const [docTemplates, setDocTemplates] = useState({
    receipt_pre_homologation: null,
    invoice_post_homologation: null,
  });
  const [templateLayouts, setTemplateLayouts] = useState({
    receipt_pre_homologation: null,
    invoice_post_homologation: null,
  });
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [docPreview, setDocPreview] = useState(null);
  const [printingDoc, setPrintingDoc] = useState(false);
  const [issuingNfPaymentId, setIssuingNfPaymentId] = useState("");
  const [refreshingNfPaymentId, setRefreshingNfPaymentId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadDocumentTemplates();
        setDocTemplates(data.templates);
        setTemplateLayouts(data.layouts);
      } catch (error) {
        console.error(error);
        toast.error("Não consegui carregar os templates de recibo/fatura.");
      }
    };

    load();
  }, []);

  const openTemplate = useCallback(
    async (kind, payment) => {
      const templateKey = kind === "receipt" ? "receipt_pre_homologation" : "invoice_post_homologation";
      const friendlyName = kind === "receipt" ? "recibo" : "fatura";
      const template = docTemplates[templateKey];
      const layout = templateLayouts[templateKey] || null;

      if (!template?.pdf?.download_url && !template?.png?.download_url) {
        toast.error(`O ${friendlyName} ainda não foi configurado pelo admin.`);
        return;
      }

      setDocPreview(
        buildDocPreviewData({
          kind,
          payment,
          familyData: selectedFamilyData,
          groupData: selectedGroupData,
          planName,
          planMonthlyAmount,
          template,
          layout,
          billingSettings,
        })
      );
      setDocPreviewOpen(true);
    },
    [billingSettings, docTemplates, planMonthlyAmount, planName, selectedFamilyData, selectedGroupData, templateLayouts]
  );

  const openReceiptTemplate = useCallback((payment) => openTemplate("receipt", payment), [openTemplate]);
  const openInvoiceTemplate = useCallback((payment) => openTemplate("invoice", payment), [openTemplate]);

  const handlePrintOrSavePdf = useCallback(async () => {
    if (!docPreview) return;
    if (!docPreview?.layout?.canvas || !docPreview?.layout?.fields) {
      toast.error("O layout dinâmico ainda não foi configurado para este documento.");
      return;
    }

    try {
      setPrintingDoc(true);
      let qrUrl = "";
      if (docPreview.qrPayload) {
        qrUrl = await QRCode.toDataURL(docPreview.qrPayload, { margin: 1, width: 260 });
      }

      const html = buildPrintableDocumentHtml(docPreview, qrUrl);
      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) {
        toast.error("Seu navegador bloqueou a janela de impressão.");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      const triggerPrint = () => {
        printWindow.focus();
        printWindow.print();
      };

      if (printWindow.document.readyState === "complete") {
        setTimeout(triggerPrint, 300);
      } else {
        printWindow.onload = () => setTimeout(triggerPrint, 300);
      }
    } catch (error) {
      console.error(error);
      toast.error("Não consegui preparar a impressão do documento.");
    } finally {
      setPrintingDoc(false);
    }
  }, [docPreview]);

  const handleIssueNf = useCallback(
    async (payment) => {
      if (!payment?.id || !selectedFamilyData?.id) return;
      if (!familyIsActive) {
        toast.error("A NFS-e só é liberada depois que a família estiver ativa.");
        return;
      }
      if (payment?.status !== "paid") {
        toast.error("A NFS-e só pode ser emitida para parcelas pagas.");
        return;
      }

      if (hasIssuedNfse(payment)) {
        const url = getNfseUrl(payment);
        if (url) return openUrl(url);
        toast.success(
          payment?.nfse_number
            ? `NFS-e ${payment.nfse_number} já foi emitida para esta parcela.`
            : "Esta parcela já possui NFS-e emitida."
        );
        return;
      }

      try {
        setIssuingNfPaymentId(payment.id);
        toast.message("Emitindo NFS-e nacional...");
        const data = await issueNfse({
          paymentId: payment.id,
          familyId: selectedFamilyData.id,
        });

        await reloadPayments({ preserveSelected: true });
        const returnedUrl =
          data?.pdfUrl ||
          data?.nfse?.pdfUrl ||
          data?.nfse?.consultaUrl ||
          data?.nfse?.xmlUrl ||
          data?.nfse?.url ||
          "";

        toast.success(
          data?.number || data?.nfse?.number
            ? `NFS-e ${data?.number || data?.nfse?.number} emitida com sucesso.`
            : "NFS-e emitida com sucesso."
        );
        if (returnedUrl) openUrl(returnedUrl);
      } catch (error) {
        console.error(error);
        toast.error(error?.message || "Não consegui emitir a NFS-e agora.");
      } finally {
        setIssuingNfPaymentId("");
      }
    },
    [familyIsActive, reloadPayments, selectedFamilyData]
  );

  const handleRefreshNf = useCallback(
    async (payment) => {
      if (!payment?.id || !selectedFamilyData?.id) return;
      try {
        setRefreshingNfPaymentId(payment.id);
        toast.message("Atualizando status da NFS-e...");
        const data = await refreshNfse({
          paymentId: payment.id,
          familyId: selectedFamilyData.id,
        });

        await reloadPayments({ preserveSelected: true });
        const nextUrl =
          data?.pdfUrl ||
          data?.nfse?.pdfUrl ||
          data?.nfse?.consultaUrl ||
          data?.nfse?.xmlUrl ||
          data?.nfse?.url ||
          getNfseUrl(payment);

        if (
          data?.nfseStatus === "issued" ||
          data?.nfse?.status === "issued" ||
          data?.number ||
          data?.nfse?.number
        ) {
          toast.success(
            data?.number || data?.nfse?.number
              ? `NFS-e ${data?.number || data?.nfse?.number} disponível.`
              : "NFS-e localizada com sucesso."
          );
          if (nextUrl) openUrl(nextUrl);
        } else {
          toast.message("A NFS-e ainda está em processamento.");
        }
      } catch (error) {
        console.error(error);
        toast.error(error?.message || "Não consegui atualizar a NFS-e agora.");
      } finally {
        setRefreshingNfPaymentId("");
      }
    },
    [reloadPayments, selectedFamilyData]
  );

  const handleOpenNf = useCallback(
    (payment) => {
      if (!familyIsActive) {
        toast.message(
          "Enquanto a família não estiver ativa, o fluxo correto continua sendo o recibo."
        );
        return;
      }

      const url = getNfseUrl(payment);
      if (url) return openUrl(url);

      const nfseStatus = getNfseStatus(payment);
      if (["requested", "processing", "pending"].includes(nfseStatus)) {
        return handleRefreshNf(payment);
      }
      if (nfseStatus === "error") {
        toast.error(getNfseError(payment) || "A última tentativa de emissão da NFS-e falhou.");
        return;
      }
      return handleIssueNf(payment);
    },
    [familyIsActive, handleIssueNf, handleRefreshNf]
  );

  return {
    docPreviewOpen,
    setDocPreviewOpen,
    docPreview,
    printingDoc,
    issuingNfPaymentId,
    refreshingNfPaymentId,
    openReceiptTemplate,
    openInvoiceTemplate,
    handlePrintOrSavePdf,
    handleIssueNf,
    handleRefreshNf,
    handleOpenNf,
  };
}

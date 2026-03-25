import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  adminPaymentsDebug,
  buildPixChargeRequest,
  getAsaasPixPaymentId,
  getAsaasBoletoPaymentId,
  getBoletoUrl,
  getDigitableLine,
  getPixPayload,
  hasAnyBoleto,
  hasAnyPix,
} from "../helpers";
import {
  confirmSandboxPayment,
  createBoletoCharge,
  createPixCharge,
} from "../services/adminPaymentsApi";

export default function useAdminPaymentsCharges({
  selectedPayment,
  billingSettings,
  pixEnabledForSelected,
  pixAnticipationAvailableForSelected,
  isPixAnticipationMode,
  boletoEnabledForSelected,
  reloadPayments,
  showPayModal,
}) {
  const [payTab, setPayTab] = useState("pix");
  const [pixQrDataUrl, setPixQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [creatingPix, setCreatingPix] = useState(false);
  const [creatingBoleto, setCreatingBoleto] = useState(false);
  const [confirmingPay, setConfirmingPay] = useState(false);

  useEffect(() => {
    if (!showPayModal || !selectedPayment) return;
    if (pixEnabledForSelected || pixAnticipationAvailableForSelected) return setPayTab("pix");
    if (boletoEnabledForSelected) return setPayTab("boleto");
    setPayTab("pix");
  }, [
    boletoEnabledForSelected,
    pixAnticipationAvailableForSelected,
    pixEnabledForSelected,
    selectedPayment,
    showPayModal,
  ]);

  useEffect(() => {
    const payload = getPixPayload(selectedPayment);
    if (!payload) {
      setPixQrDataUrl("");
      setQrLoading(false);
      return;
    }

    let cancelled = false;
    setQrLoading(true);

    (async () => {
      try {
        const url = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
        if (!cancelled) setPixQrDataUrl(url);
      } catch (error) {
        console.error(error);
        if (!cancelled) setPixQrDataUrl("");
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPayment]);

  const hasPix = useMemo(() => hasAnyPix(selectedPayment), [selectedPayment]);
  const hasBoleto = useMemo(() => hasAnyBoleto(selectedPayment), [selectedPayment]);

  const copyText = async (text, okMsg = "Copiado!") => {
    try {
      await navigator.clipboard.writeText(text || "");
      toast.success(okMsg);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível copiar. Tente manualmente.");
    }
  };

  const copyPixCode = () => {
    const code = getPixPayload(selectedPayment);
    if (!code) return toast.error("Pix ainda não disponível.");
    return copyText(code, "Código Pix copiado!");
  };

  const copyDigitableLine = () => {
    const line = getDigitableLine(selectedPayment);
    if (!line) return toast.error("Linha digitável ainda não disponível.");
    return copyText(line, "Linha digitável copiada!");
  };

  const downloadBoleto = () => {
    const url = getBoletoUrl(selectedPayment);
    if (!url) return toast.error("Boleto ainda não disponível.");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCreatePix = async () => {
    if (!selectedPayment?.id) {
      adminPaymentsDebug("handleCreatePixBlocked", { reason: "missing-payment-id", selectedPayment });
      return;
    }
    if (!(pixEnabledForSelected || pixAnticipationAvailableForSelected)) {
      adminPaymentsDebug("handleCreatePixBlocked", {
        reason: "pix-not-enabled-for-selected",
        paymentId: selectedPayment?.id || "",
        pixEnabledForSelected,
        pixAnticipationAvailableForSelected,
        isPixAnticipationMode,
        billingSettings,
      });
      return toast.error("O Pix não está liberado para esta parcela nas configurações atuais.");
    }

    const requestBody = buildPixChargeRequest({
      paymentId: selectedPayment.id,
      familyId: selectedPayment.family_id || "",
      allowAnticipation: isPixAnticipationMode,
      force: false,
      source: isPixAnticipationMode ? "admin_manual_anticipation" : "admin_manual_current",
    });

    try {
      setCreatingPix(true);
      toast.message(isPixAnticipationMode ? "Gerando Pix antecipado…" : "Gerando Pix…");
      await createPixCharge(requestBody);
      await reloadPayments({ preserveSelected: true });
      toast.success(isPixAnticipationMode ? "Pix antecipado gerado!" : "Pix gerado!");
    } catch (error) {
      adminPaymentsDebug("handleCreatePixError", {
        paymentId: selectedPayment?.id || "",
        errorMessage: error?.message || String(error),
        status: error?.status || null,
        responseData: error?.responseData || null,
        responseText: error?.responseText || "",
        stack: error?.stack || "",
      });
      console.error(error);
      toast.error(error?.message || "Falha ao gerar Pix");
    } finally {
      setCreatingPix(false);
    }
  };

  const handleCreateBoleto = async () => {
    if (!selectedPayment?.id) {
      adminPaymentsDebug("handleCreateBoletoBlocked", { reason: "missing-payment-id", selectedPayment });
      return;
    }
    if (!boletoEnabledForSelected) {
      adminPaymentsDebug("handleCreateBoletoBlocked", {
        reason: "boleto-not-enabled-for-selected",
        paymentId: selectedPayment?.id || "",
        boletoEnabledForSelected,
        billingSettings,
      });
      return toast.error("O boleto não está liberado para esta parcela nas configurações atuais.");
    }

    try {
      setCreatingBoleto(true);
      toast.message(
        billingSettings?.boleto?.onDemandOnly ? "Solicitando boleto…" : "Gerando boleto…"
      );
      await createBoletoCharge({
        paymentId: selectedPayment.id,
        familyId: selectedPayment.family_id || "",
      });
      await reloadPayments({ preserveSelected: true });
      toast.success(
        billingSettings?.boleto?.onDemandOnly ? "Boleto solicitado e gerado!" : "Boleto gerado!"
      );
    } catch (error) {
      adminPaymentsDebug("handleCreateBoletoError", {
        paymentId: selectedPayment?.id || "",
        errorMessage: error?.message || String(error),
      });
      console.error(error);
      toast.error(error?.message || "Falha ao gerar boleto");
    } finally {
      setCreatingBoleto(false);
    }
  };

  const handleConfirmSandboxPayment = async () => {
    const asaasPaymentId = getAsaasPixPaymentId(selectedPayment);
    if (!asaasPaymentId) {
      adminPaymentsDebug("handleConfirmSandboxPaymentBlocked", {
        reason: "missing-asaas-payment-id",
        paymentId: selectedPayment?.id || "",
      });
      return toast.error("Não há cobrança Pix do sandbox para confirmar.");
    }

    try {
      setConfirmingPay(true);
      toast.message("Confirmando pagamento no sandbox…");
      await confirmSandboxPayment({ asaasPaymentId });
      await reloadPayments({ preserveSelected: true });
      toast.success("Pagamento confirmado (sandbox). Aguarde atualizar status.");
    } catch (error) {
      adminPaymentsDebug("handleConfirmSandboxPaymentError", {
        paymentId: selectedPayment?.id || "",
        asaasPaymentId,
        errorMessage: error?.message || String(error),
      });
      console.error(error);
      toast.error(error?.message || "Falha ao confirmar pagamento");
    } finally {
      setConfirmingPay(false);
    }
  };

  return {
    payTab,
    setPayTab,
    pixQrDataUrl,
    qrLoading,
    creatingPix,
    creatingBoleto,
    confirmingPay,
    hasPix,
    hasBoleto,
    copyPixCode,
    copyDigitableLine,
    downloadBoleto,
    handleCreatePix,
    handleCreateBoleto,
    handleConfirmSandboxPayment,
    getAsaasPixPaymentId,
    getAsaasBoletoPaymentId,
    getPixPayload,
    getDigitableLine,
    getBoletoUrl,
  };
}

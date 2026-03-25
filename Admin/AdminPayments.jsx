import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { auth } from "../../api/firebaseAuth";
import {
  statusConfig,
  typeConfig,
  isLocalHost,
  moneyBRL,
  parseMoneyToNumber,
  pickFirstPositive,
  getPaymentDateObj,
  isPaymentCurrentMonth,
  getPlanMonthlyFromPlanDoc,
  inferPlanMonthlyFromPayments,
  isFamilyActiveNow,
  getNfseStatus,
  hasIssuedNfse,
  getNfseError,
  getNfseTitle,
  getFamilyDisplayName,
  getFamilyCpf,
  fmtDueDate,
  safeFormatDateBR,
  ensureFamilyInstallments,
  adminPaymentsDebug,
  openUrl,
} from "./AdminPayments/helpers";
import {
  markPaymentPaid,
  cancelPayment as cancelPaymentRequest,
} from "./AdminPayments/services/adminPaymentsApi";
import useAdminPaymentsData from "./AdminPayments/hooks/useAdminPaymentsData";
import useAdminPaymentsDocuments from "./AdminPayments/hooks/useAdminPaymentsDocuments";
import useAdminPaymentsCharges from "./AdminPayments/hooks/useAdminPaymentsCharges";
import AdminPaymentsHeader from "./AdminPayments/components/AdminPaymentsHeader";
import AdminPaymentsStats from "./AdminPayments/components/AdminPaymentsStats";
import AdminPaymentsFilters from "./AdminPayments/components/AdminPaymentsFilters";
import AdminPaymentsTable from "./AdminPayments/components/AdminPaymentsTable";
import GenerateInstallmentsDialog from "./AdminPayments/components/GenerateInstallmentsDialog";
import PaymentDialog from "./AdminPayments/components/PaymentDialog";
import DocumentPreviewDialog from "./AdminPayments/components/DocumentPreviewDialog";

export default function AdminPayments() {
  const [familySearch, setFamilySearch] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("overdue");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const {
    payments,
    families,
    loading,
    billingSettings,
    selectedPayment,
    selectedFamilyData,
    selectedGroupData,
    selectedFamilyPlan,
    loadingSelectedContext,
    familyIndex,
    activeFamilies,
    reloadPayments,
    openPayment,
    patchPayment,
  } = useAdminPaymentsData();

  const familyPaymentsForSelected = useMemo(() => {
    if (!selectedPayment?.family_id) return [];
    return payments.filter((payment) => payment.family_id === selectedPayment.family_id);
  }, [payments, selectedPayment?.family_id]);

  const selectedPaymentIsCurrentMonth = useMemo(
    () => isPaymentCurrentMonth(selectedPayment),
    [selectedPayment]
  );

  const familyIsActive = useMemo(
    () => isFamilyActiveNow(selectedFamilyData),
    [selectedFamilyData]
  );

  const planMonthlyAmount = useMemo(() => {
    const fromGroup = pickFirstPositive(
      selectedGroupData?.plan_monthly_price,
      selectedGroupData?.plan_monthly_value,
      selectedGroupData?.monthly_price,
      selectedGroupData?.monthly_value,
      selectedGroupData?.mensalidade
    );
    if (fromGroup) return fromGroup;

    const fromPlan = getPlanMonthlyFromPlanDoc(selectedFamilyPlan);
    if (fromPlan) return fromPlan;

    const fromFamily = pickFirstPositive(
      selectedFamilyData?.monthly_payment,
      selectedFamilyData?.mensalidade
    );
    if (fromFamily) return fromFamily;

    const fromCurrent = parseMoneyToNumber(selectedPayment?.amount);
    if (fromCurrent && fromCurrent > 0) return fromCurrent;

    const fromPayments = inferPlanMonthlyFromPayments(familyPaymentsForSelected);
    if (fromPayments) return fromPayments;

    return 0;
  }, [
    familyPaymentsForSelected,
    selectedFamilyData,
    selectedFamilyPlan,
    selectedGroupData,
    selectedPayment?.amount,
  ]);

  const planName = useMemo(
    () =>
      (selectedGroupData?.plan_name && String(selectedGroupData.plan_name)) ||
      (selectedFamilyPlan?.name && String(selectedFamilyPlan.name)) ||
      (selectedFamilyPlan?.title && String(selectedFamilyPlan.title)) ||
      null,
    [selectedGroupData, selectedFamilyPlan]
  );

  const {
    docPreviewOpen,
    setDocPreviewOpen,
    docPreview,
    printingDoc,
    issuingNfPaymentId,
    refreshingNfPaymentId,
    openReceiptTemplate,
    openInvoiceTemplate,
    handlePrintOrSavePdf,
    handleOpenNf,
  } = useAdminPaymentsDocuments({
    billingSettings,
    selectedFamilyData,
    selectedGroupData,
    planName,
    planMonthlyAmount,
    familyIsActive,
    reloadPayments,
  });

  const pixEnabledForSelected = useMemo(
    () =>
      !!selectedPayment &&
      !!billingSettings?.pix?.enabled &&
      (!billingSettings?.pix?.currentMonthOnly || selectedPaymentIsCurrentMonth),
    [billingSettings, selectedPayment, selectedPaymentIsCurrentMonth]
  );

  const pixAnticipationAvailableForSelected = useMemo(
    () =>
      !!selectedPayment &&
      !!billingSettings?.pix?.enabled &&
      selectedPayment?.status !== "paid" &&
      !selectedPaymentIsCurrentMonth,
    [billingSettings, selectedPayment, selectedPaymentIsCurrentMonth]
  );

  const boletoEnabledForSelected = useMemo(
    () =>
      !!selectedPayment &&
      !!billingSettings?.boleto?.enabled &&
      (!billingSettings?.boleto?.currentMonthOnly || selectedPaymentIsCurrentMonth),
    [billingSettings, selectedPayment, selectedPaymentIsCurrentMonth]
  );

  const isPixAnticipationMode = useMemo(
    () => pixAnticipationAvailableForSelected && !pixEnabledForSelected,
    [pixAnticipationAvailableForSelected, pixEnabledForSelected]
  );

  const pixTabAvailable = useMemo(
    () => pixEnabledForSelected || pixAnticipationAvailableForSelected,
    [pixAnticipationAvailableForSelected, pixEnabledForSelected]
  );

  const canReceipt = useMemo(
    () => !!selectedPayment && !familyIsActive && selectedPayment.status === "paid",
    [familyIsActive, selectedPayment]
  );

  const canInvoice = useMemo(
    () => !!selectedPayment && familyIsActive && (selectedPayment.status === "paid" || selectedPaymentIsCurrentMonth),
    [familyIsActive, selectedPayment, selectedPaymentIsCurrentMonth]
  );

  const nfAlreadyIssued = useMemo(() => hasIssuedNfse(selectedPayment), [selectedPayment]);

  const canNf = useMemo(
    () => !!selectedPayment && familyIsActive && (selectedPayment.status === "paid" || nfAlreadyIssued),
    [familyIsActive, nfAlreadyIssued, selectedPayment]
  );

  const {
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
  } = useAdminPaymentsCharges({
    selectedPayment,
    billingSettings,
    pixEnabledForSelected,
    pixAnticipationAvailableForSelected,
    isPixAnticipationMode,
    boletoEnabledForSelected,
    reloadPayments,
    showPayModal,
  });

  const filteredPayments = useMemo(() => {
    const familyTerm = (familySearch || "").trim().toLowerCase();
    const refTerm = (search || "").trim().toLowerCase();

    return [...payments]
      .filter((payment) => {
        const family = familyIndex.get(payment.family_id) || null;
        const familyName = getFamilyDisplayName(family).toLowerCase();
        const familyCpf = getFamilyCpf(family).toLowerCase();
        const reference = String(payment.reference || "").toLowerCase();

        const matchesFamily =
          !familyTerm || familyName.includes(familyTerm) || familyCpf.includes(familyTerm);
        const matchesReference = !refTerm || reference.includes(refTerm);

        let matchesStatus = true;
        if (statusFilter === "current_month") {
          matchesStatus = isPaymentCurrentMonth(payment);
        } else if (statusFilter !== "all") {
          matchesStatus = payment.status === statusFilter;
        }

        const matchesType = typeFilter === "all" || payment.type === typeFilter;
        return matchesFamily && matchesReference && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const dueDateA = getPaymentDateObj(a)?.getTime() || 0;
        const dueDateB = getPaymentDateObj(b)?.getTime() || 0;
        if (dueDateA !== dueDateB) return dueDateA - dueDateB;
        return Number(a.installment_number || 0) - Number(b.installment_number || 0);
      });
  }, [familyIndex, familySearch, payments, search, statusFilter, typeFilter]);

  const pendingPayments = payments.filter((payment) => payment.status === "pending");
  const overduePayments = payments.filter((payment) => payment.status === "overdue");
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const totalPending = pendingPayments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
  const totalOverdue = overduePayments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);

  const isLocal = isLocalHost();

  const openPayModal = async (payment) => {
    adminPaymentsDebug("openPayModal", {
      paymentId: payment?.id || "",
      familyId: payment?.family_id || payment?.familyId || payment?.family?.id || "",
      status: payment?.status || "",
      installmentNumber: payment?.installment_number || null,
      dueDate: payment?.due_date || payment?.dueDate || null,
      amount: payment?.amount || payment?.value || payment?.monthly_value || null,
    });
    setShowPayModal(true);
    await openPayment(payment);
  };

  const handleMarkAsPaid = async (payment) => {
    try {
      const response = await markPaymentPaid({ paymentId: payment.id });
      const paidAt = response?.paidAt || new Date().toISOString().slice(0, 10);
      patchPayment(payment.id, { status: "paid", payment_date: paidAt });
      toast.success("Pagamento marcado como pago!");
      await reloadPayments({ preserveSelected: true });
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Erro ao atualizar pagamento");
    }
  };

  const handleCancelPayment = async (paymentId) => {
    try {
      await cancelPaymentRequest({ paymentId });
      patchPayment(paymentId, { status: "cancelled" });
      toast.success("Pagamento cancelado.");
      await reloadPayments({ preserveSelected: true });
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Erro ao cancelar pagamento");
    }
  };

  if (loading) return <p>Carregando pagamentos...</p>;

  return (
    <div className="space-y-6">
      <AdminPaymentsHeader
        onExport={() => toast.message("Exportação ainda não implementada nesta refatoração.")}
        onGenerate={() => setShowGenerateModal(true)}
      />

      <AdminPaymentsStats
        totalCount={payments.length}
        pendingCount={pendingPayments.length}
        totalPending={totalPending}
        overdueCount={overduePayments.length}
        totalOverdue={totalOverdue}
        paidCount={paidPayments.length}
        moneyBRL={moneyBRL}
      />

      <AdminPaymentsFilters
        familySearch={familySearch}
        onFamilySearchChange={setFamilySearch}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      <AdminPaymentsTable
        filteredPayments={filteredPayments}
        familyIndex={familyIndex}
        statusConfig={statusConfig}
        typeConfig={typeConfig}
        openPayModal={openPayModal}
        markAsPaid={handleMarkAsPaid}
        cancelPayment={handleCancelPayment}
        getFamilyDisplayName={getFamilyDisplayName}
        getFamilyCpf={getFamilyCpf}
        moneyBRL={moneyBRL}
        safeFormatDateBR={safeFormatDateBR}
      />

      <GenerateInstallmentsDialog
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        selectedFamily={selectedFamily}
        onSelectedFamilyChange={setSelectedFamily}
        activeFamilies={activeFamilies}
        getFamilyDisplayName={getFamilyDisplayName}
        generating={generating}
        onGenerate={async () => {
          if (!selectedFamily) return;

          setGenerating(true);
          try {
            const createdByUid = auth?.currentUser?.uid || null;
            const { createdCount, familyName, costCenterId } = await ensureFamilyInstallments({
              familyId: selectedFamily,
              families,
              createdByUid,
            });

            if (createdCount === 0) {
              toast.message(`Nenhuma parcela faltante para ${familyName}.`);
            } else {
              toast.success(
                `Geradas ${createdCount} parcelas + lançamentos contábeis para ${familyName} (CC: ${costCenterId}).`
              );
            }

            setShowGenerateModal(false);
            setSelectedFamily("");
            await reloadPayments({ preserveSelected: true });
          } catch (error) {
            console.error(error);
            toast.error(error.message || "Erro ao gerar parcelas");
          } finally {
            setGenerating(false);
          }
        }}
      />

      <PaymentDialog
        open={showPayModal}
        onOpenChange={setShowPayModal}
        selectedPayment={selectedPayment}
        billingSettings={billingSettings}
        selectedFamilyData={selectedFamilyData}
        loadingSelectedContext={loadingSelectedContext}
        statusConfig={statusConfig}
        moneyBRL={moneyBRL}
        fmtDueDate={fmtDueDate}
        getFamilyDisplayName={getFamilyDisplayName}
        getFamilyCpf={getFamilyCpf}
        openReceiptTemplate={openReceiptTemplate}
        openInvoiceTemplate={openInvoiceTemplate}
        handleOpenNf={handleOpenNf}
        canReceipt={canReceipt}
        canInvoice={canInvoice}
        canNf={canNf}
        familyIsActive={familyIsActive}
        selectedPaymentIsCurrentMonth={selectedPaymentIsCurrentMonth}
        getNfseTitle={getNfseTitle}
        issuingNfPaymentId={issuingNfPaymentId}
        refreshingNfPaymentId={refreshingNfPaymentId}
        hasIssuedNfse={hasIssuedNfse}
        getNfseStatus={getNfseStatus}
        getNfseError={getNfseError}
        payTab={payTab}
        onPayTabChange={setPayTab}
        pixTabAvailable={pixTabAvailable}
        boletoEnabledForSelected={boletoEnabledForSelected}
        qrLoading={qrLoading}
        pixQrDataUrl={pixQrDataUrl}
        getAsaasPixPaymentId={getAsaasPixPaymentId}
        handleCreatePix={handleCreatePix}
        creatingPix={creatingPix}
        isPixAnticipationMode={isPixAnticipationMode}
        getPixPayload={getPixPayload}
        copyPixCode={copyPixCode}
        isLocal={isLocal}
        handleConfirmSandboxPayment={handleConfirmSandboxPayment}
        confirmingPay={confirmingPay}
        getAsaasBoletoPaymentId={getAsaasBoletoPaymentId}
        handleCreateBoleto={handleCreateBoleto}
        creatingBoleto={creatingBoleto}
        getDigitableLine={getDigitableLine}
        copyDigitableLine={copyDigitableLine}
        downloadBoleto={downloadBoleto}
        getBoletoUrl={getBoletoUrl}
        hasPix={hasPix}
        hasBoleto={hasBoleto}
      />

      <DocumentPreviewDialog
        open={docPreviewOpen}
        onOpenChange={setDocPreviewOpen}
        docPreview={docPreview}
        openUrl={openUrl}
        handlePrintOrSavePdf={handlePrintOrSavePdf}
        printingDoc={printingDoc}
      />
    </div>
  );
}

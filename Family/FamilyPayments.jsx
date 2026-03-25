import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  QrCode,
  Download,
  ChevronDown,
  Sparkles,
  Loader2,
  Receipt,
  Pencil,
  FileText,
  Printer,
  Landmark,
} from 'lucide-react';
import QRCode from 'qrcode';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../api/firebaseAuth';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import {
  ACCOUNT_TYPE_OPTIONS,
  DUE_DAY_OPTIONS,
  buildPixChargeRequest,
  computeNextDueDate,
  getAsaasBoletoPaymentId,
  getAsaasPixPaymentId,
  getAutoDebitFallbackLabel,
  getAutoDebitLastAttempt,
  getBoletoUrl,
  getDefaultBillingSettings,
  getDigitableLine,
  getPixEncodedImageBase64,
  getPixPayload,
  hasAnyBoleto,
  hasAnyPix,
  openUrl,
} from './FamilyPayments/helpers/actions';
import {
  buildDocPreviewData,
  buildPrintableDocumentHtml,
  fetchLayoutFromJsonUrl,
  resolveTemplateLayout,
} from './FamilyPayments/helpers/documents';
import {
  getCurrentMonthPayment,
  getFamilyPlanId,
  getNfseError,
  getNfseStatus,
  getNfseTitle,
  getNfseUrl,
  getPlanMonthlyFromPlanDoc,
  hasIssuedNfse,
  inferPlanMonthlyFromPayments,
  isFamilyActiveNow,
  isPaymentCurrentMonth,
  monthKey,
} from './FamilyPayments/helpers/eligibility';
import {
  fmtDueDate,
  formatDateBR,
  getFamilyCpf,
  getFamilyDisplayName,
  getPaymentDateObj,
  getYearKey,
  moneyBRL,
  parseMoneyToNumber,
  pickFirstPositive,
  statusConfig,
  statusFallback,
} from './FamilyPayments/helpers/formatters';
import { callFamilyPaymentsFunction as callFamilyPaymentsFunctionRaw, getFunctionsBase, isLocalHost } from './FamilyPayments/services/familyPaymentsApi';

export default function FamilyPayments() {
  const [familyData, setFamilyData] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [familyPlan, setFamilyPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTab, setPayTab] = useState('pix');
  const [dueModalOpen, setDueModalOpen] = useState(false);
  const [savingDue, setSavingDue] = useState(false);
  const [billingDueDay, setBillingDueDay] = useState('');
  const [billingPreview, setBillingPreview] = useState('');
  const [pixQrDataUrl, setPixQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [creatingPix, setCreatingPix] = useState(false);
  const [creatingBoleto, setCreatingBoleto] = useState(false);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [issuingNfPaymentId, setIssuingNfPaymentId] = useState('');
  const [refreshingNfPaymentId, setRefreshingNfPaymentId] = useState('');
  const [docTemplates, setDocTemplates] = useState({ receipt_pre_homologation: null, invoice_post_homologation: null });
  const [templateLayouts, setTemplateLayouts] = useState({ receipt_pre_homologation: null, invoice_post_homologation: null });
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [docPreview, setDocPreview] = useState(null);
  const [printingDoc, setPrintingDoc] = useState(false);
  const [billingSettings, setBillingSettings] = useState(getDefaultBillingSettings());
  const [loadingBillingSettings, setLoadingBillingSettings] = useState(true);
  const [autoDebitMandate, setAutoDebitMandate] = useState(null);
  const [loadingAutoDebitMandate, setLoadingAutoDebitMandate] = useState(false);
  const [autoDebitDialogOpen, setAutoDebitDialogOpen] = useState(false);
  const [savingAutoDebit, setSavingAutoDebit] = useState(false);
  const [simulatingAutoDebit, setSimulatingAutoDebit] = useState('');
  const [autoDebitForm, setAutoDebitForm] = useState({ holderName: '', holderDocument: '', bankName: '', agency: '', account: '', accountType: 'corrente' });
  const autoPixGuardRef = useRef({ monthKey: '', paymentId: '', inFlight: false, completed: false });

  async function callFamilyPaymentsFunction(path, body) {
    return callFamilyPaymentsFunctionRaw(path, body, auth.currentUser);
  }
  const isLocal = isLocalHost();

  async function loadBillingSettings() {
    setLoadingBillingSettings(true);
    try {
      const data = await callFamilyPaymentsFunction('getBillingSettings', {});
      setBillingSettings(data?.settings || getDefaultBillingSettings());
    } catch (error) {
      console.error(error);
      setBillingSettings(getDefaultBillingSettings());
      toast.error('Não consegui carregar as configurações de cobrança. Usei o padrão do sistema.');
    } finally {
      setLoadingBillingSettings(false);
    }
  }

  async function loadDocumentTemplatesFromFunction() {
    try {
      const data = await callFamilyPaymentsFunction('familyGetPaymentTemplates', {});
      const receipt = data?.templates?.receipt_pre_homologation || null;
      const invoice = data?.templates?.invoice_post_homologation || null;
      setDocTemplates({ receipt_pre_homologation: receipt, invoice_post_homologation: invoice });
      const nextLayouts = {
        receipt_pre_homologation: resolveTemplateLayout(receipt?.layout_zones, 'receipt_pre_homologation', 'receipt'),
        invoice_post_homologation: resolveTemplateLayout(invoice?.layout_zones, 'invoice_post_homologation', 'invoice'),
      };
      if (!nextLayouts.receipt_pre_homologation && receipt?.json?.download_url) {
        try { nextLayouts.receipt_pre_homologation = await fetchLayoutFromJsonUrl(receipt.json.download_url, 'receipt_pre_homologation', 'receipt'); } catch (e) { console.error(e); }
      }
      if (!nextLayouts.invoice_post_homologation && invoice?.json?.download_url) {
        try { nextLayouts.invoice_post_homologation = await fetchLayoutFromJsonUrl(invoice.json.download_url, 'invoice_post_homologation', 'invoice'); } catch (e) { console.error(e); }
      }
      setTemplateLayouts(nextLayouts);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPaymentsSnapshot(user) {
    if (!user?.uid) return;
    setPlanLoading(true);
    setLoadingAutoDebitMandate(true);
    try {
      const data = await callFamilyPaymentsFunction('familyGetPaymentsSnapshot', { familyId: user.uid });
      const family = data?.family || null;
      const group = data?.group || null;
      const plan = data?.plan || null;
      const nextPayments = Array.isArray(data?.payments) ? [...data.payments] : [];
      nextPayments.sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0));
      setFamilyData(family);
      setGroupData(group);
      setFamilyPlan(plan);
      setPayments(nextPayments);
      setAutoDebitMandate(data?.autoDebitMandate || null);
      setAutoDebitForm((prev) => ({ ...prev, holderName: prev.holderName || getFamilyDisplayName(family), holderDocument: prev.holderDocument || getFamilyCpf(family) }));
      const famDueDay = (Number.isFinite(Number(family?.billing_due_day)) && Number(family?.billing_due_day)) || (Number.isFinite(Number(family?.due_day)) && Number(family?.due_day)) || null;
      const effectiveDue = famDueDay && famDueDay >= 1 && famDueDay <= 28 ? famDueDay : 10;
      setBillingDueDay(String(effectiveDue));
      const next = computeNextDueDate(effectiveDue, new Date());
      setBillingPreview(next ? format(next, 'dd/MM/yyyy') : '');
      if (selectedPayment?.id) {
        const updated = nextPayments.find((p) => p.id === selectedPayment.id);
        if (updated) setSelectedPayment(updated);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setPlanLoading(false);
      setLoadingAutoDebitMandate(false);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      await Promise.all([loadPaymentsSnapshot(user), loadDocumentTemplatesFromFunction(), loadBillingSettings()]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const d = Number(billingDueDay);
    const next = computeNextDueDate(d, new Date());
    setBillingPreview(next ? format(next, 'dd/MM/yyyy') : '');
  }, [billingDueDay]);

  async function saveDueDay() {
    const user = auth.currentUser;
    if (!user?.uid) return;
    try {
      setSavingDue(true);
      await callFamilyPaymentsFunction('familySavePaymentDueDay', { familyId: user.uid, dueDay: Number(billingDueDay) });
      toast.success('Vencimento atualizado!');
      setDueModalOpen(false);
      await loadPaymentsSnapshot(user);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Não consegui salvar o vencimento agora.');
    } finally {
      setSavingDue(false);
    }
  }

  const pendingPayments = useMemo(() => payments.filter((p) => p.status === 'pending' || p.status === 'overdue'), [payments]);
  const paidPayments = useMemo(() => payments.filter((p) => p.status === 'paid'), [payments]);
  const totalPaid = useMemo(() => paidPayments.reduce((acc, p) => acc + (parseMoneyToNumber(p.amount) || 0), 0), [paidPayments]);
  const totalPending = useMemo(() => pendingPayments.reduce((acc, p) => acc + (parseMoneyToNumber(p.amount) || 0), 0), [pendingPayments]);
  const currentMonthPayment = useMemo(() => getCurrentMonthPayment(payments), [payments]);
  const planMonthlyAmount = useMemo(() => { const fromGroup = pickFirstPositive(groupData?.plan_monthly_price, groupData?.plan_monthly_value, groupData?.monthly_price, groupData?.monthly_value, groupData?.mensalidade); if (fromGroup) return fromGroup; const fromPlan = getPlanMonthlyFromPlanDoc(familyPlan); if (fromPlan) return fromPlan; const fromFamily = pickFirstPositive(familyData?.monthly_payment, familyData?.mensalidade); if (fromFamily) return fromFamily; const fromCurrent = parseMoneyToNumber(currentMonthPayment?.amount); if (fromCurrent && fromCurrent > 0) return fromCurrent; const fromPayments = inferPlanMonthlyFromPayments(payments); if (fromPayments) return fromPayments; return 0; }, [groupData, familyPlan, familyData, currentMonthPayment?.amount, payments]);
  const planName = useMemo(() => (groupData?.plan_name && String(groupData.plan_name)) || (familyPlan?.name && String(familyPlan.name)) || (familyPlan?.title && String(familyPlan.title)) || null, [groupData, familyPlan]);
  const familyIsActive = useMemo(() => isFamilyActiveNow(familyData), [familyData]);
  const pixEnabledForSelected = useMemo(() => !!selectedPayment && !!billingSettings?.pix?.enabled && (!billingSettings?.pix?.currentMonthOnly || isPaymentCurrentMonth(selectedPayment)), [selectedPayment, billingSettings]);
  const pixAnticipationAvailableForSelected = useMemo(() => !!selectedPayment && !!billingSettings?.pix?.enabled && selectedPayment?.status !== 'paid' && !isPaymentCurrentMonth(selectedPayment), [selectedPayment, billingSettings]);
  const pixTabAvailable = useMemo(() => pixEnabledForSelected || pixAnticipationAvailableForSelected, [pixEnabledForSelected, pixAnticipationAvailableForSelected]);
  const boletoEnabledForSelected = useMemo(() => !!selectedPayment && !!billingSettings?.boleto?.enabled && (!billingSettings?.boleto?.currentMonthOnly || isPaymentCurrentMonth(selectedPayment)), [selectedPayment, billingSettings]);
  const isPixAnticipationMode = useMemo(() => pixAnticipationAvailableForSelected && !pixEnabledForSelected, [pixAnticipationAvailableForSelected, pixEnabledForSelected]);
  const autoDebitStatus = useMemo(() => { if (!billingSettings?.autoDebit?.enabled) return { label: 'Desabilitada', tone: 'bg-slate-100 text-slate-700', help: 'A cobrança automática ainda não foi ativada pelo administrador.' }; if (autoDebitMandate?.active === true) return { label: 'Ativa', tone: 'bg-green-100 text-green-700', help: 'Sua autorização de débito automático está registrada no sistema.' }; if (autoDebitMandate) return { label: 'Inativa', tone: 'bg-yellow-100 text-yellow-700', help: 'Existe um cadastro salvo, mas a autorização não está ativa neste momento.' }; return { label: 'Não aderida', tone: 'bg-amber-100 text-amber-700', help: 'Você ainda não cadastrou autorização para cobrança automática.' }; }, [billingSettings, autoDebitMandate]);
  function openPayModal(payment) { setSelectedPayment(payment); setShowPayModal(true); }

  useEffect(() => {
    if (!showPayModal || !selectedPayment) return;
    if (pixTabAvailable) return setPayTab('pix');
    if (boletoEnabledForSelected) return setPayTab('boleto');
    setPayTab('pix');
  }, [showPayModal, selectedPayment, pixTabAvailable, boletoEnabledForSelected]);

  useEffect(() => {
    const p = currentMonthPayment;
    const currentUser = auth.currentUser;
    if (!currentUser || !p?.id || loadingBillingSettings || !billingSettings?.pix?.enabled || billingSettings?.providerMode !== 'mock') return;
    if (billingSettings?.pix?.currentMonthOnly && !isPaymentCurrentMonth(p)) return;
    if (hasAnyPix(p)) return;

    const mk = monthKey(new Date());
    const alreadyCompleted =
      autoPixGuardRef.current.monthKey === mk &&
      autoPixGuardRef.current.paymentId === p.id &&
      autoPixGuardRef.current.completed === true;

    if (alreadyCompleted || autoPixGuardRef.current.inFlight) return;

    autoPixGuardRef.current = { monthKey: mk, paymentId: p.id, inFlight: true, completed: false };

    (async () => {
      try {
        await callFamilyPaymentsFunction(
          'createPixCharge',
          buildPixChargeRequest({
            paymentId: p.id,
            familyId: familyData?.id || currentUser?.uid || '',
            allowAnticipation: false,
            force: false,
            source: 'family_auto_current_month',
          })
        );
        autoPixGuardRef.current = { monthKey: mk, paymentId: p.id, inFlight: false, completed: true };
        const user = auth.currentUser;
        if (user) await loadPaymentsSnapshot(user);
        toast.success('Pix do mês atual gerado automaticamente.');
      } catch (e) {
        autoPixGuardRef.current = { monthKey: '', paymentId: '', inFlight: false, completed: false };
        toast.error(e?.message || 'Falha ao gerar automaticamente o Pix do mês atual.');
      }
    })();
  }, [currentMonthPayment?.id, familyData?.id, loadingBillingSettings, billingSettings?.pix?.enabled, billingSettings?.pix?.currentMonthOnly, billingSettings?.providerMode]);

  useEffect(() => {
    const p = selectedPayment;
    if (!p) { setPixQrDataUrl(''); setQrLoading(false); return; }
    const encoded = getPixEncodedImageBase64(p); const payload = getPixPayload(p);
    if (encoded) { setPixQrDataUrl(`data:image/png;base64,${encoded}`); setQrLoading(false); return; }
    if (!payload) { setPixQrDataUrl(''); setQrLoading(false); return; }
    let cancelled = false; setQrLoading(true);
    (async () => {
      try { const url = await QRCode.toDataURL(payload, { margin: 1, width: 320 }); if (!cancelled) setPixQrDataUrl(url); }
      catch (e) { console.error(e); if (!cancelled) setPixQrDataUrl(''); }
      finally { if (!cancelled) setQrLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedPayment]);

  const copyText = async (text, okMsg = 'Copiado!') => { try { await navigator.clipboard.writeText(text || ''); toast.success(okMsg); } catch (e) { console.error(e); toast.error('Não foi possível copiar. Tente manualmente.'); } };
  const copyPixCode = () => { const code = getPixPayload(selectedPayment); if (!code) return toast.error('Pix ainda não disponível.'); return copyText(code, 'Código Pix copiado!'); };
  const copyDigitableLine = () => { const line = getDigitableLine(selectedPayment); if (!line) return toast.error('Linha digitável ainda não disponível.'); return copyText(line, 'Linha digitável copiada!'); };
  const downloadBoleto = () => { const url = getBoletoUrl(selectedPayment); if (!url) return toast.error('Boleto ainda não disponível.'); window.open(url, '_blank', 'noopener,noreferrer'); };
  const hasPix = hasAnyPix(selectedPayment);
  const hasBoleto = hasAnyBoleto(selectedPayment);
  const selectedAutoDebitAttempt = useMemo(() => getAutoDebitLastAttempt(selectedPayment), [selectedPayment]);

  async function handleCreatePix() {
    if (!selectedPayment?.id) return;
    if (!(pixEnabledForSelected || pixAnticipationAvailableForSelected)) {
      return toast.error('O Pix não está liberado para esta parcela nas configurações atuais.');
    }

    try {
      setCreatingPix(true);
      toast.message(isPixAnticipationMode ? 'Gerando Pix antecipado…' : 'Gerando Pix…');

      await callFamilyPaymentsFunction(
        'createPixCharge',
        buildPixChargeRequest({
          paymentId: selectedPayment.id,
          familyId: familyData?.id || auth.currentUser?.uid || '',
          allowAnticipation: isPixAnticipationMode,
          force: false,
          source: isPixAnticipationMode ? 'family_manual_anticipation' : 'family_manual_current',
        })
      );

      const user = auth.currentUser;
      if (user) await loadPaymentsSnapshot(user);

      toast.success(isPixAnticipationMode ? 'Pix antecipado gerado!' : 'Pix gerado!');
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Falha ao gerar Pix');
    } finally {
      setCreatingPix(false);
    }
  }

  async function handleCreateBoleto() { if (!selectedPayment?.id) return; if (!boletoEnabledForSelected) return toast.error('O boleto não está liberado para esta parcela nas configurações atuais.'); try { setCreatingBoleto(true); toast.message(billingSettings?.boleto?.onDemandOnly ? 'Solicitando boleto…' : 'Gerando boleto…'); await callFamilyPaymentsFunction('createBoletoCharge', { paymentId: selectedPayment.id, familyId: familyData?.id || auth.currentUser?.uid || '' }); const user = auth.currentUser; if (user) await loadPaymentsSnapshot(user); toast.success(billingSettings?.boleto?.onDemandOnly ? 'Boleto solicitado e gerado!' : 'Boleto gerado!'); } catch (e) { console.error(e); toast.error(e?.message || 'Falha ao gerar boleto'); } finally { setCreatingBoleto(false); } }
  async function handleConfirmSandboxPayment() { const asaasPaymentId = getAsaasPixPaymentId(selectedPayment); if (!asaasPaymentId) return toast.error('Não há cobrança Pix do sandbox para confirmar.'); try { setConfirmingPay(true); toast.message('Confirmando pagamento no sandbox…'); await callFamilyPaymentsFunction('confirmSandboxPayment', { asaasPaymentId }); const user = auth.currentUser; if (user) await loadPaymentsSnapshot(user); toast.success('Pagamento confirmado (sandbox). Aguarde atualizar status.'); } catch (e) { console.error(e); toast.error(e?.message || 'Falha ao confirmar pagamento'); } finally { setConfirmingPay(false); } }
  async function handleSaveAutoDebitMandate() { if (!familyData?.id) return; if (!autoDebitForm.holderName.trim() || !autoDebitForm.holderDocument.trim() || !autoDebitForm.bankName.trim() || !autoDebitForm.agency.trim() || !autoDebitForm.account.trim()) return toast.error('Preencha os dados bancários básicos para aderir à cobrança automática.'); try { setSavingAutoDebit(true); await callFamilyPaymentsFunction('registerAutoDebitMandate', { familyId: familyData.id, holderName: autoDebitForm.holderName.trim(), holderDocument: autoDebitForm.holderDocument.trim(), bankName: autoDebitForm.bankName.trim(), agency: autoDebitForm.agency.trim(), account: autoDebitForm.account.trim(), accountType: autoDebitForm.accountType, active: true }); const user = auth.currentUser; if (user) await loadPaymentsSnapshot(user); setAutoDebitDialogOpen(false); toast.success('Solicitação de débito automático salva.'); } catch (error) { console.error(error); toast.error(error?.message || 'Não consegui salvar a adesão ao débito automático.'); } finally { setSavingAutoDebit(false); } }
  async function handleDisableAutoDebitMandate() { if (!familyData?.id) return; try { setSavingAutoDebit(true); await callFamilyPaymentsFunction('registerAutoDebitMandate', { familyId: familyData.id, holderName: autoDebitMandate?.holder_name || autoDebitForm.holderName, holderDocument: autoDebitMandate?.holder_document || autoDebitForm.holderDocument, bankName: autoDebitMandate?.bank_name || autoDebitForm.bankName, agency: autoDebitMandate?.agency || autoDebitForm.agency, account: autoDebitMandate?.account || autoDebitForm.account, accountType: autoDebitMandate?.account_type || autoDebitForm.accountType, active: false }); const user = auth.currentUser; if (user) await loadPaymentsSnapshot(user); toast.success('Cobrança automática desativada.'); } catch (error) { console.error(error); toast.error(error?.message || 'Não consegui desativar a cobrança automática.'); } finally { setSavingAutoDebit(false); } }
  async function handleSimulateAutoDebit(result) { if (!selectedPayment?.id) return; if (!autoDebitMandate?.active) return toast.error('Ative primeiro a autorização de débito automático.'); try { setSimulatingAutoDebit(result); toast.message(result === 'success' ? 'Simulando liquidação do débito automático...' : 'Simulando falha do débito automático com fallback...'); const data = await callFamilyPaymentsFunction('simulateAutoDebitAttempt', { paymentId: selectedPayment.id, familyId: familyData?.id, result }); const user = auth.currentUser; if (user) await loadPaymentsSnapshot(user); if (data?.fallbackMethod === 'pix') setPayTab('pix'); if (data?.fallbackMethod === 'boleto') setPayTab('boleto'); toast.success(data?.message || 'Tentativa de débito automático processada.'); } catch (error) { console.error(error); toast.error(error?.message || 'Não consegui simular o débito automático.'); } finally { setSimulatingAutoDebit(''); } }

  async function openReceiptTemplate(payment) { const tpl = docTemplates.receipt_pre_homologation; if (!tpl?.pdf?.download_url && !tpl?.png?.download_url) return toast.error('O recibo ainda não foi configurado pelo admin.'); let layout = templateLayouts.receipt_pre_homologation || resolveTemplateLayout(tpl?.layout_zones, 'receipt_pre_homologation', 'receipt'); if (!layout && tpl?.json?.download_url) { try { layout = await fetchLayoutFromJsonUrl(tpl.json.download_url, 'receipt_pre_homologation', 'receipt'); setTemplateLayouts((prev) => ({ ...prev, receipt_pre_homologation: layout })); } catch (e) { console.error(e); } } setDocPreview(buildDocPreviewData({ kind: 'receipt', payment, familyData, groupData, planName, planMonthlyAmount, template: tpl, layout, billingSettings })); setDocPreviewOpen(true); }
  async function openInvoiceTemplate(payment) { const tpl = docTemplates.invoice_post_homologation; if (!tpl?.pdf?.download_url && !tpl?.png?.download_url) return toast.error('A fatura ainda não foi configurada pelo admin.'); let layout = templateLayouts.invoice_post_homologation || resolveTemplateLayout(tpl?.layout_zones, 'invoice_post_homologation', 'invoice'); if (!layout && tpl?.json?.download_url) { try { layout = await fetchLayoutFromJsonUrl(tpl.json.download_url, 'invoice_post_homologation', 'invoice'); setTemplateLayouts((prev) => ({ ...prev, invoice_post_homologation: layout })); } catch (e) { console.error(e); } } setDocPreview(buildDocPreviewData({ kind: 'invoice', payment, familyData, groupData, planName, planMonthlyAmount, template: tpl, layout, billingSettings })); setDocPreviewOpen(true); }
  async function handlePrintOrSavePdf() { if (!docPreview) return; if (!docPreview?.layout?.canvas || !docPreview?.layout?.fields) return toast.error('O layout dinâmico ainda não foi configurado para este documento.'); try { setPrintingDoc(true); let qrUrl = ''; if (docPreview.qrPayload) qrUrl = await QRCode.toDataURL(docPreview.qrPayload, { margin: 1, width: 260 }); const html = buildPrintableDocumentHtml(docPreview, qrUrl); const printWindow = window.open('', '_blank', 'noopener,noreferrer'); if (!printWindow) return toast.error('Seu navegador bloqueou a janela de impressão.'); printWindow.document.open(); printWindow.document.write(html); printWindow.document.close(); const triggerPrint = () => { printWindow.focus(); printWindow.print(); }; if (printWindow.document.readyState === 'complete') setTimeout(triggerPrint, 300); else printWindow.onload = () => setTimeout(triggerPrint, 300); } catch (e) { console.error(e); toast.error('Não consegui preparar a impressão do documento.'); } finally { setPrintingDoc(false); } }
  async function handleIssueNf(payment) { if (!payment?.id || !familyData?.id) return; if (!familyIsActive) return toast.error('A NFS-e só é liberada depois que a família estiver ativa.'); if (payment?.status !== 'paid') return toast.error('A NFS-e só pode ser emitida para parcelas pagas.'); if (hasIssuedNfse(payment)) { const url = getNfseUrl(payment); if (url) return openUrl(url); return toast.success(payment?.nfse_number ? `NFS-e ${payment.nfse_number} já foi emitida para esta parcela.` : 'Esta parcela já possui NFS-e emitida.'); } try { setIssuingNfPaymentId(payment.id); toast.message('Emitindo NFS-e nacional...'); const data = await callFamilyPaymentsFunction('issueNfseGovBr', { paymentId: payment.id, familyId: familyData.id }); const user = auth.currentUser; if (user) await loadPaymentsSnapshot(user); const returnedUrl = data?.pdfUrl || data?.nfse?.pdfUrl || data?.nfse?.consultaUrl || data?.nfse?.xmlUrl || data?.nfse?.url || ''; toast.success(data?.number || data?.nfse?.number ? `NFS-e ${data?.number || data?.nfse?.number} emitida com sucesso.` : 'NFS-e emitida com sucesso.'); if (returnedUrl) openUrl(returnedUrl); } catch (e) { console.error(e); toast.error(e?.message || 'Não consegui emitir a NFS-e agora.'); } finally { setIssuingNfPaymentId(''); } }
  async function handleRefreshNf(payment) { if (!payment?.id || !familyData?.id) return; try { setRefreshingNfPaymentId(payment.id); toast.message('Atualizando status da NFS-e...'); const data = await callFamilyPaymentsFunction('refreshNfseGovBr', { paymentId: payment.id, familyId: familyData.id }); const user = auth.currentUser; if (user) await loadPaymentsSnapshot(user); const nextUrl = data?.pdfUrl || data?.nfse?.pdfUrl || data?.nfse?.consultaUrl || data?.nfse?.xmlUrl || data?.nfse?.url || getNfseUrl(payment); if (data?.nfseStatus === 'issued' || data?.nfse?.status === 'issued' || data?.number || data?.nfse?.number) { toast.success(data?.number || data?.nfse?.number ? `NFS-e ${data?.number || data?.nfse?.number} disponível.` : 'NFS-e localizada com sucesso.'); if (nextUrl) openUrl(nextUrl); } else toast.message('A NFS-e ainda está em processamento.'); } catch (e) { console.error(e); toast.error(e?.message || 'Não consegui atualizar a NFS-e agora.'); } finally { setRefreshingNfPaymentId(''); } }
  function handleOpenNf(payment) { if (!familyIsActive) return toast.message('Enquanto a família não estiver ativa, o fluxo correto continua sendo o recibo.'); const url = getNfseUrl(payment); if (url) return openUrl(url); const nfseStatus = getNfseStatus(payment); if (nfseStatus === 'requested' || nfseStatus === 'processing' || nfseStatus === 'pending') return handleRefreshNf(payment); if (nfseStatus === 'error') return toast.error(getNfseError(payment) || 'A última tentativa de emissão da NFS-e falhou.'); return handleIssueNf(payment); }

  const currentDueDay = (Number.isFinite(Number(familyData?.billing_due_day)) && Number(familyData?.billing_due_day)) || (Number.isFinite(Number(familyData?.due_day)) && Number(familyData?.due_day)) || null;
  const planIdHint = getFamilyPlanId(familyData) || getFamilyPlanId(groupData) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos</h1>
          <p className="text-slate-600">Gerencie seus boletos, Pix e documentos da parcela</p>
          {planName || planIdHint ? <p className="text-xs text-slate-500 mt-1">Plano: <b>{planName ? planName : planIdHint ? `ID ${String(planIdHint)}` : '—'}</b>{planLoading ? ' • carregando...' : ''}</p> : null}
          <p className="text-xs text-slate-500 mt-2">📅 Vencimento escolhido: <b>{currentDueDay ? `dia ${currentDueDay}` : 'não definido'}</b>{billingPreview ? ` • próximo: ${billingPreview}` : ''}</p>
          <p className="text-xs text-slate-500 mt-1">Documento liberado agora: <b>{familyIsActive ? 'Fatura' : 'Recibo'}</b>{familyIsActive ? ' • NFS-e nacional disponível para parcelas pagas' : ' • antes da ativação da família'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary">Provider: {(billingSettings?.providerName || 'bnb').toUpperCase()}</Badge>
            <Badge variant="secondary">Modo: {billingSettings?.providerMode || 'mock'}</Badge>
            <Badge variant="secondary">Pix: {billingSettings?.pix?.enabled ? 'ativo' : 'inativo'}</Badge>
            <Badge variant="secondary">Boleto: {billingSettings?.boleto?.enabled ? (billingSettings?.boleto?.onDemandOnly ? 'sob solicitação' : 'ativo') : 'inativo'}</Badge>
            <Badge variant="secondary">Débito automático: {billingSettings?.autoDebit?.enabled ? autoDebitStatus.label : 'inativo'}</Badge>
          </div>
        </div>
        <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => setDueModalOpen(true)}><Pencil className="w-4 h-4 mr-2" />Alterar vencimento</Button>
      </div>

      <Dialog open={dueModalOpen} onOpenChange={setDueModalOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Definir dia de vencimento</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-xl border bg-amber-50 p-3 text-sm text-amber-900">Selecione o <b>dia do mês</b> para vencimento das suas parcelas.</div><div><div className="text-sm font-medium text-slate-700 mb-2">Dia de vencimento (mensal)</div><Select value={billingDueDay} onValueChange={setBillingDueDay}><SelectTrigger className="h-11"><SelectValue placeholder="Selecione o dia" /></SelectTrigger><SelectContent>{DUE_DAY_OPTIONS.map((d) => <SelectItem key={String(d)} value={String(d)}>Dia {d}</SelectItem>)}</SelectContent></Select><div className="text-xs text-slate-500 mt-2">Próximo vencimento estimado: <strong>{billingPreview || '—'}</strong></div></div></div><div className="gap-2"><Button variant="outline" onClick={() => setDueModalOpen(false)} disabled={savingDue}>Cancelar</Button><Button className="bg-amber-500 hover:bg-amber-600" onClick={saveDueDay} disabled={savingDue || !billingDueDay}>{savingDue ? 'Salvando...' : 'Salvar vencimento'}</Button></div></DialogContent></Dialog>

      <div className="grid sm:grid-cols-3 gap-4"><SummaryCard icon={CheckCircle2} label="Total Pago" value={totalPaid} color="green" /><SummaryCard icon={Clock} label="Pendente" value={totalPending} color="yellow" /><SummaryCard icon={CreditCard} label="Mensalidade do plano" value={planMonthlyAmount} color="amber" /></div>
      {planMonthlyAmount <= 0 ? <div className="text-xs text-amber-700">Nenhum plano definido ainda. O admin precisa selecionar um plano ao criar o grupo.</div> : null}

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="w-5 h-5" />Cobrança automática / débito em conta</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><Badge className={autoDebitStatus.tone}>{autoDebitStatus.label}</Badge><span className="text-sm text-slate-700">Tipo configurado: <b>{billingSettings?.autoDebit?.type === 'automatic' ? 'automático' : 'manual'}</b></span></div><p className="text-sm text-slate-500 mt-2">{autoDebitStatus.help}</p>{billingSettings?.autoDebit?.enabled ? <p className="text-xs text-slate-500 mt-2">Fallback atual: <b>{getAutoDebitFallbackLabel(billingSettings)}</b>.</p> : <p className="text-xs text-slate-500 mt-2">Este bloco já está pronto na interface, mas depende de ativação administrativa.</p>}{autoDebitMandate ? <p className="text-xs text-slate-500 mt-2">Banco: <b>{autoDebitMandate.bank_name || '—'}</b>{autoDebitMandate.agency ? ` • agência ${autoDebitMandate.agency}` : ''}{autoDebitMandate.account ? ` • conta ${autoDebitMandate.account}` : ''}</p> : null}</div><div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={() => { setAutoDebitForm((prev) => ({ ...prev, holderName: autoDebitMandate?.holder_name || prev.holderName || getFamilyDisplayName(familyData), holderDocument: autoDebitMandate?.holder_document || prev.holderDocument || getFamilyCpf(familyData), bankName: autoDebitMandate?.bank_name || prev.bankName, agency: autoDebitMandate?.agency || prev.agency, account: autoDebitMandate?.account || prev.account, accountType: autoDebitMandate?.account_type || prev.accountType || 'corrente' })); setAutoDebitDialogOpen(true); }} disabled={!billingSettings?.autoDebit?.enabled || loadingAutoDebitMandate}>{autoDebitMandate?.active ? 'Editar adesão' : 'Aderir agora'}</Button>{autoDebitMandate?.active ? <Button className="bg-slate-900 hover:bg-slate-800" onClick={handleDisableAutoDebitMandate} disabled={savingAutoDebit}>{savingAutoDebit ? 'Salvando...' : 'Desativar'}</Button> : null}</div></div><div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">Esta etapa registra sua intenção/autorização no sistema. A liquidação bancária real será ligada ao provider do banco depois da contratação definitiva.</div></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Histórico de Pagamentos</CardTitle></CardHeader><CardContent><Tabs defaultValue="pending"><TabsList className="mb-4"><TabsTrigger value="pending">Pendentes{pendingPayments.length > 0 && <Badge className="ml-2 bg-yellow-500 text-white">{pendingPayments.length}</Badge>}</TabsTrigger><TabsTrigger value="paid">Pagos</TabsTrigger><TabsTrigger value="all">Todos</TabsTrigger></TabsList><TabsContent value="pending"><PaymentsByYear payments={pendingPayments} onSelect={openPayModal} familyIsActive={familyIsActive} onOpenReceipt={openReceiptTemplate} onOpenInvoice={openInvoiceTemplate} onOpenNf={handleOpenNf} issuingNfPaymentId={issuingNfPaymentId} refreshingNfPaymentId={refreshingNfPaymentId} /></TabsContent><TabsContent value="paid"><PaymentsByYear payments={paidPayments} onSelect={openPayModal} familyIsActive={familyIsActive} onOpenReceipt={openReceiptTemplate} onOpenInvoice={openInvoiceTemplate} onOpenNf={handleOpenNf} issuingNfPaymentId={issuingNfPaymentId} refreshingNfPaymentId={refreshingNfPaymentId} /></TabsContent><TabsContent value="all"><PaymentsByYear payments={payments} onSelect={openPayModal} familyIsActive={familyIsActive} onOpenReceipt={openReceiptTemplate} onOpenInvoice={openInvoiceTemplate} onOpenNf={handleOpenNf} issuingNfPaymentId={issuingNfPaymentId} refreshingNfPaymentId={refreshingNfPaymentId} /></TabsContent></Tabs></CardContent></Card>

      <Dialog open={showPayModal} onOpenChange={setShowPayModal}><DialogContent className="w-[96vw] max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden"><DialogHeader><DialogTitle>Pagar</DialogTitle></DialogHeader>{selectedPayment && <div className="space-y-4"><div className="rounded-xl border bg-slate-50 p-4"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><div className="text-2xl sm:text-3xl font-bold">R$ {moneyBRL(parseMoneyToNumber(selectedPayment.amount) || 0)}</div><div className="text-sm text-slate-500">Parcela {selectedPayment.installment_number}/{selectedPayment.total_installments} • Venc. {fmtDueDate(selectedPayment)}</div><div className="text-xs text-slate-500 mt-1">Provider: <b>{(billingSettings?.providerName || 'bnb').toUpperCase()}</b> • modo <b>{billingSettings?.providerMode || 'mock'}</b></div></div><div className="flex justify-start sm:justify-end">{(() => { const s = statusConfig[selectedPayment.status] || statusFallback; return <Badge className={s.color}>{s.label}</Badge>; })()}</div></div></div>{familyIsActive ? <div className="rounded-xl border bg-white p-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Nota fiscal de serviço</div><div className="text-xs text-slate-500 mt-1">{selectedPayment?.status === 'paid' ? hasIssuedNfse(selectedPayment) ? 'Esta parcela já possui NFS-e vinculada.' : 'Parcela elegível para emissão da NFS-e nacional.' : 'A NFS-e será liberada quando esta parcela estiver paga.'}</div>{getNfseStatus(selectedPayment) ? <div className="text-xs text-slate-500 mt-1">Status NF: <b>{getNfseStatus(selectedPayment)}</b>{selectedPayment?.nfse_number ? ` • nº ${selectedPayment.nfse_number}` : ''}</div> : null}</div><div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={() => handleRefreshNf(selectedPayment)} disabled={!selectedPayment || selectedPayment.status !== 'paid' || refreshingNfPaymentId === selectedPayment.id}>{refreshingNfPaymentId === selectedPayment?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Atualizar NF</Button><Button className="bg-slate-900 hover:bg-slate-800" onClick={() => handleOpenNf(selectedPayment)} disabled={!selectedPayment || selectedPayment.status !== 'paid' || issuingNfPaymentId === selectedPayment.id || refreshingNfPaymentId === selectedPayment.id}>{issuingNfPaymentId === selectedPayment?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}{hasIssuedNfse(selectedPayment) ? 'Abrir NF' : 'Emitir NF'}</Button></div></div>{getNfseError(selectedPayment) ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Último erro da NF: {getNfseError(selectedPayment)}</div> : null}</div> : null}{autoDebitMandate?.active ? <div className="rounded-xl border bg-white p-4 space-y-3"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Cobrança automática desta parcela</div><div className="text-xs text-slate-500 mt-1">Status do cadastro: <b>ativo</b> • fallback configurado: <b>{getAutoDebitFallbackLabel(billingSettings)}</b></div>{selectedAutoDebitAttempt ? <div className="text-xs text-slate-500 mt-1">Última tentativa: <b>{selectedAutoDebitAttempt.status === 'success' ? 'sucesso' : 'falha'}</b>{selectedAutoDebitAttempt?.attemptedAt ? ` • ${formatDateBR(selectedAutoDebitAttempt.attemptedAt)}` : ''}{selectedAutoDebitAttempt?.fallbackUsed && selectedAutoDebitAttempt.fallbackUsed !== 'none' ? ` • fallback usado: ${selectedAutoDebitAttempt.fallbackUsed === 'pix' ? 'Pix' : 'boleto'}` : ''}</div> : <div className="text-xs text-slate-500 mt-1">Ainda não há tentativa registrada para esta parcela.</div>}</div>{billingSettings?.providerMode === 'mock' ? <div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={() => handleSimulateAutoDebit('failed')} disabled={!!simulatingAutoDebit || selectedPayment?.status === 'paid'}>{simulatingAutoDebit === 'failed' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Simular falha</Button><Button className="bg-slate-900 hover:bg-slate-800" onClick={() => handleSimulateAutoDebit('success')} disabled={!!simulatingAutoDebit || selectedPayment?.status === 'paid'}>{simulatingAutoDebit === 'success' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Simular débito pago</Button></div> : <div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">A execução real do débito será conectada quando o provider bancário sair do modo mock.</div>}</div></div> : null}{pixTabAvailable || boletoEnabledForSelected ? <Tabs value={payTab} onValueChange={setPayTab} className="w-full"><TabsList className="w-full">{pixTabAvailable ? <TabsTrigger value="pix" className="flex-1">Pix</TabsTrigger> : null}{boletoEnabledForSelected ? <TabsTrigger value="boleto" className="flex-1">Boleto</TabsTrigger> : null}</TabsList>{pixTabAvailable ? <TabsContent value="pix" className="mt-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="rounded-xl border bg-amber-50 p-4"><div className="flex flex-col items-center gap-3">{qrLoading ? <div className="py-6 text-slate-600 flex flex-col items-center"><Loader2 className="w-6 h-6 animate-spin mb-2" />Gerando QR Code...</div> : pixQrDataUrl ? <div className="bg-white rounded-xl p-3 shadow-sm"><img src={pixQrDataUrl} alt="QR Code Pix" className="w-52 h-52 object-contain" /></div> : <div className="py-6 text-center"><QrCode className="w-16 h-16 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Pix ainda não disponível</p></div>}<p className="text-sm text-slate-700">Escaneie no app do seu banco</p></div></div><div className="space-y-3">{getAsaasPixPaymentId(selectedPayment) ? <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />Pix já gerado para esta parcela.</div> : <Button className="w-full h-10 bg-slate-900 hover:bg-slate-800" onClick={handleCreatePix} disabled={creatingPix}>{creatingPix ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}{isPixAnticipationMode ? 'Gerar Pix antecipado' : 'Gerar Pix'}</Button>}<div className="rounded-xl border p-3 bg-white"><div className="text-xs font-semibold text-slate-700 mb-2">Pix copia e cola</div><div className="flex gap-2 items-center min-w-0"><div className="flex-1 min-w-0 bg-slate-100 px-3 py-2 rounded font-mono text-xs truncate">{getPixPayload(selectedPayment) || 'PIX NÃO CONFIGURADO'}</div><Button variant="outline" onClick={copyPixCode} disabled={!getPixPayload(selectedPayment)} className="shrink-0"><Copy className="w-4 h-4" /></Button></div></div><div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">{isPixAnticipationMode ? <>Esta parcela está fora do mês corrente. O botão acima libera o <b>Pix antecipado</b> manualmente.</> : <>O Pix está configurado para {billingSettings?.pix?.currentMonthOnly ? <b>mês corrente</b> : <b>múltiplas competências</b>}.</>}</div>{isLocal ? <Button variant="outline" className="w-full h-10" onClick={handleConfirmSandboxPayment} disabled={confirmingPay || !getAsaasPixPaymentId(selectedPayment)}>{confirmingPay ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}Confirmar pagamento (sandbox)</Button> : null}{isLocal ? <div className="text-[11px] text-slate-400">Functions base: <span className="font-mono">{getFunctionsBase()}</span></div> : null}</div></div>{!hasPix ? <div className="text-xs text-slate-500 text-center mt-3">Este pagamento ainda não tem Pix gerado. Clique em <b>{isPixAnticipationMode ? 'Gerar Pix antecipado' : 'Gerar Pix'}</b>.</div> : null}</TabsContent> : null}{boletoEnabledForSelected ? <TabsContent value="boleto" className="mt-4"><div className="space-y-3">{getAsaasBoletoPaymentId(selectedPayment) ? <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center gap-2"><Receipt className="w-4 h-4 text-slate-700" />Boleto já gerado para esta parcela.</div> : <Button variant="outline" className="w-full h-10" onClick={handleCreateBoleto} disabled={creatingBoleto}>{creatingBoleto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}{billingSettings?.boleto?.onDemandOnly ? 'Solicitar boleto' : 'Gerar boleto'}</Button>}<div className="rounded-xl border p-3 bg-white"><div className="text-xs font-semibold text-slate-700 mb-2">Linha digitável</div><div className="flex gap-2 items-center min-w-0"><div className="flex-1 min-w-0 bg-slate-100 px-3 py-2 rounded font-mono text-xs truncate">{getDigitableLine(selectedPayment) || 'LINHA DIGITÁVEL NÃO DISPONÍVEL'}</div><Button variant="outline" onClick={copyDigitableLine} disabled={!getDigitableLine(selectedPayment)} className="shrink-0"><Copy className="w-4 h-4" /></Button></div></div><Button className="w-full h-10 bg-amber-500 hover:bg-amber-600" onClick={downloadBoleto} disabled={!getBoletoUrl(selectedPayment)}><Download className="w-4 h-4 mr-2" />Baixar Boleto (PDF)</Button><div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">O boleto usa o vencimento já definido na parcela: <b>{fmtDueDate(selectedPayment)}</b>.</div>{!hasBoleto ? <div className="text-xs text-slate-500 text-center">Este pagamento ainda não tem boleto gerado. Clique em <b>{billingSettings?.boleto?.onDemandOnly ? 'Solicitar boleto' : 'Gerar boleto'}</b>.</div> : null}</div></TabsContent> : null}</Tabs> : <div className="rounded-xl border bg-slate-50 px-4 py-4 text-sm text-slate-600">Nenhum meio de cobrança está liberado para esta parcela pelas configurações atuais.</div>}</div>}</DialogContent></Dialog>

      <Dialog open={docPreviewOpen} onOpenChange={setDocPreviewOpen}><DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden"><DialogHeader><DialogTitle>{docPreview?.title || 'Documento'}</DialogTitle></DialogHeader>{docPreview ? <div className="space-y-4"><div className="rounded-xl border bg-slate-50 p-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><div className="text-lg font-semibold text-slate-900">{docPreview.title}</div><div className="text-sm text-slate-600">{docPreview.number} • Valor {docPreview.items?.[0]?.value || 'R$ 0,00'}</div><div className="text-xs text-slate-500 mt-1">Emissão: {docPreview.issueDate} • Vencimento: {docPreview.dueDate}</div></div><div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={() => openUrl(docPreview.template?.png?.download_url)} disabled={!docPreview.template?.png?.download_url}><FileText className="w-4 h-4 mr-2" />Abrir PNG</Button><Button variant="outline" onClick={() => openUrl(docPreview.template?.pdf?.download_url)} disabled={!docPreview.template?.pdf?.download_url}><Download className="w-4 h-4 mr-2" />Abrir PDF base</Button><Button className="bg-slate-900 hover:bg-slate-800" onClick={handlePrintOrSavePdf} disabled={printingDoc || !docPreview?.layout?.canvas}>{printingDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}Imprimir / salvar PDF</Button></div></div></div><div className="rounded-xl border bg-white p-3 overflow-auto"><DynamicPaymentDocumentPreview docData={docPreview} /></div><div className="text-xs text-slate-500">O botão <b>Imprimir / salvar PDF</b> abre a versão preenchida do documento no navegador para impressão ou salvar como PDF.</div></div> : null}</DialogContent></Dialog>

      <Dialog open={autoDebitDialogOpen} onOpenChange={setAutoDebitDialogOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Adesão à cobrança automática</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">Cadastre os dados básicos da conta para deixar sua autorização pronta. A liquidação bancária real será conectada ao banco depois da homologação final.</div><div className="grid md:grid-cols-2 gap-4"><div className="space-y-1"><Label>Titular</Label><Input value={autoDebitForm.holderName} onChange={(e) => setAutoDebitForm((prev) => ({ ...prev, holderName: e.target.value }))} placeholder="Nome do titular" disabled={savingAutoDebit} /></div><div className="space-y-1"><Label>CPF do titular</Label><Input value={autoDebitForm.holderDocument} onChange={(e) => setAutoDebitForm((prev) => ({ ...prev, holderDocument: e.target.value }))} placeholder="000.000.000-00" disabled={savingAutoDebit} /></div><div className="space-y-1"><Label>Banco</Label><Input value={autoDebitForm.bankName} onChange={(e) => setAutoDebitForm((prev) => ({ ...prev, bankName: e.target.value }))} placeholder="Ex.: BNB" disabled={savingAutoDebit} /></div><div className="space-y-1"><Label>Agência</Label><Input value={autoDebitForm.agency} onChange={(e) => setAutoDebitForm((prev) => ({ ...prev, agency: e.target.value }))} placeholder="0000" disabled={savingAutoDebit} /></div><div className="space-y-1"><Label>Conta</Label><Input value={autoDebitForm.account} onChange={(e) => setAutoDebitForm((prev) => ({ ...prev, account: e.target.value }))} placeholder="000000-0" disabled={savingAutoDebit} /></div><div className="space-y-1"><Label>Tipo de conta</Label><Select value={autoDebitForm.accountType} onValueChange={(value) => setAutoDebitForm((prev) => ({ ...prev, accountType: value }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{ACCOUNT_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div></div><div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">Ao salvar, o sistema registra sua autorização de cobrança automática e mantém fallback para os outros meios conforme a configuração do admin.</div><div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setAutoDebitDialogOpen(false)} disabled={savingAutoDebit}>Cancelar</Button><Button className="bg-slate-900 hover:bg-slate-800" onClick={handleSaveAutoDebitMandate} disabled={savingAutoDebit}>{savingAutoDebit ? 'Salvando...' : 'Salvar adesão'}</Button></div></div></DialogContent></Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) { const styles = { green: { card: 'bg-green-50 border-green-200', iconBox: 'bg-green-100', icon: 'text-green-600', text: 'text-green-700', sub: 'text-green-600' }, yellow: { card: 'bg-yellow-50 border-yellow-200', iconBox: 'bg-yellow-100', icon: 'text-yellow-600', text: 'text-yellow-700', sub: 'text-yellow-600' }, amber: { card: 'bg-amber-50 border-amber-200', iconBox: 'bg-amber-100', icon: 'text-amber-600', text: 'text-amber-700', sub: 'text-amber-600' }, slate: { card: 'bg-slate-50 border-slate-200', iconBox: 'bg-slate-100', icon: 'text-slate-600', text: 'text-slate-700', sub: 'text-slate-600' } }; const s = styles[color] || styles.slate; return <Card className={`${s.card}`}><CardContent className="p-4 flex items-center gap-3"><div className={`w-10 h-10 ${s.iconBox} rounded-xl flex items-center justify-center`}><Icon className={`${s.icon}`} /></div><div><p className={`text-sm ${s.sub}`}>{label}</p><p className={`text-xl font-bold ${s.text}`}>R$ {moneyBRL(value || 0)}</p></div></CardContent></Card>; }
function PaymentsByYear({ payments, onSelect, familyIsActive, onOpenReceipt, onOpenInvoice, onOpenNf, issuingNfPaymentId, refreshingNfPaymentId }) { const [openYears, setOpenYears] = useState({}); const groups = useMemo(() => { const map = new Map(); (payments || []).forEach((p) => { const y = getYearKey(p); if (!map.has(y)) map.set(y, []); map.get(y).push(p); }); const entries = Array.from(map.entries()).sort((a, b) => { if (a[0] === 'Sem data') return 1; if (b[0] === 'Sem data') return -1; return Number(a[0]) - Number(b[0]); }); entries.forEach(([_, list]) => { list.sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0)); }); return entries; }, [payments]); useEffect(() => { if (!groups.length) return; const mostRecentYear = groups[groups.length - 1][0]; setOpenYears((prev) => (prev[mostRecentYear] === undefined ? { ...prev, [mostRecentYear]: true } : prev)); }, [groups]); if (!payments?.length) return <div className="text-center py-12 text-slate-500"><CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />Nenhum pagamento encontrado</div>; return <div className="space-y-3">{groups.map(([year, list]) => { const open = !!openYears[year]; const paidCount = list.filter((p) => p.status === 'paid').length; return <div key={year} className="border rounded-xl overflow-hidden bg-white"><button type="button" onClick={() => setOpenYears((p) => ({ ...p, [year]: !p[year] }))} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100"><div className="flex items-center gap-3"><div className="font-semibold text-slate-900">{year}</div><div className="text-xs text-slate-600">{list.length} parcela(s) • {paidCount} paga(s)</div></div><ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open ? <div className="p-3 space-y-3"><PaymentsList payments={list} onSelect={onSelect} familyIsActive={familyIsActive} onOpenReceipt={onOpenReceipt} onOpenInvoice={onOpenInvoice} onOpenNf={onOpenNf} issuingNfPaymentId={issuingNfPaymentId} refreshingNfPaymentId={refreshingNfPaymentId} /></div> : null}</div>; })}</div>; }
function DocActionSquare({ label, onClick, disabled = false, title = '' }) { return <button type="button" onClick={(e) => { e.stopPropagation(); if (!disabled) onClick?.(); }} disabled={disabled} title={title || label} className={[ 'w-10 h-10 rounded-xl border text-xs font-semibold transition', disabled ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50' ].join(' ')}>{label}</button>; }
function PaymentsList({ payments, onSelect, familyIsActive, onOpenReceipt, onOpenInvoice, onOpenNf, issuingNfPaymentId, refreshingNfPaymentId }) { return <div className="space-y-3">{payments.map((p, i) => { const status = statusConfig[p.status] || statusFallback; const Icon = status.icon || statusFallback.icon; const isPaid = p.status === 'paid'; const isCurrentMonth = isPaymentCurrentMonth(p); const canReceipt = !familyIsActive && isPaid; const canInvoice = familyIsActive && (isPaid || isCurrentMonth); const nfAlreadyIssued = hasIssuedNfse(p); const canNf = familyIsActive && (isPaid || nfAlreadyIssued); const nfBusy = issuingNfPaymentId === p.id || refreshingNfPaymentId === p.id; const nfLabel = nfBusy ? '...' : 'NF'; return <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="p-4 bg-slate-50 rounded-xl flex justify-between gap-3 cursor-pointer hover:bg-slate-100" onClick={() => onSelect(p)}><div className="flex gap-4 min-w-0"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status.color}`}><Icon /></div><div className="min-w-0"><p className="font-semibold">R$ {moneyBRL(parseMoneyToNumber(p.amount) || 0)}</p><div className="text-sm text-slate-500 flex gap-3 flex-wrap"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDueDate(p)}</span><span>Parcela {p.installment_number}/{p.total_installments}</span></div></div></div><div className="flex items-center gap-2 shrink-0">{canReceipt ? <DocActionSquare label="Rc" onClick={() => onOpenReceipt?.(p)} title="Abrir recibo pré-homologação" /> : null}{canInvoice ? <DocActionSquare label="Ft" onClick={() => onOpenInvoice?.(p)} title="Abrir fatura pós-homologação" /> : null}{canNf ? <DocActionSquare label={nfLabel} onClick={() => onOpenNf?.(p)} title={getNfseTitle(p, familyIsActive, canNf)} disabled={!canNf} /> : null}{getNfseStatus(p) ? <Badge className="bg-slate-900 text-white">NF {getNfseStatus(p) === 'issued' ? 'emitida' : getNfseStatus(p)}</Badge> : null}<Badge className={status.color}>{status.label}</Badge></div></motion.div>; })}</div>; }
function DynamicPaymentDocumentPreview({ docData }) { const layout = docData?.layout; const [qrUrl, setQrUrl] = useState(''); useEffect(() => { let cancelled = false; async function buildQr() { if (!docData?.qrPayload) return setQrUrl(''); try { const url = await QRCode.toDataURL(docData.qrPayload, { margin: 1, width: 260 }); if (!cancelled) setQrUrl(url); } catch (e) { console.error(e); if (!cancelled) setQrUrl(''); } } buildQr(); return () => { cancelled = true; }; }, [docData?.qrPayload]); if (!docData?.template?.png?.download_url) return <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-600">O PNG do template ainda não foi enviado pelo admin.</div>; if (!layout?.canvas || !layout?.fields) return <div className="space-y-3"><div className="rounded-xl border bg-amber-50 px-4 py-3 text-sm text-amber-900">O layout dinâmico ainda não foi configurado. Mostrando apenas a arte base.</div><img src={docData.template.png.download_url} alt={docData.title} className="w-full h-auto rounded-lg" /></div>; const toPct = (value, total) => `${(Number(value || 0) / Number(total || 1)) * 100}%`; function boxStyle(box) { return { position: 'absolute', left: toPct(box.x, layout.canvas.width), top: toPct(box.y, layout.canvas.height), width: toPct(box.w, layout.canvas.width), height: toPct(box.h, layout.canvas.height) }; } function textField(box, value, options = {}) { if (!box || !value) return null; const { align = 'left', size = 14, weight = 700, wrap = false, mono = false, color = '#5A3A2A' } = options; return <div style={{ ...boxStyle(box), display: 'flex', alignItems: wrap ? 'flex-start' : 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', color, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Georgia, serif', fontWeight: weight, fontSize: size, lineHeight: wrap ? 1.35 : 1.1, whiteSpace: wrap ? 'pre-wrap' : 'nowrap', overflow: 'hidden', paddingTop: wrap ? 2 : 0 }}>{value}</div>; } const items = docData?.items || []; const itemsArea = layout?.fields?.itemsArea; return <div className="w-full"><div style={{ position: 'relative', width: '100%', maxWidth: 980, margin: '0 auto', aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}`, backgroundImage: `url(${docData.template.png.download_url})`, backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden', borderRadius: 20 }}>{textField(layout.fields?.number, docData.number, { size: 14 })}{textField(layout.fields?.issueDate, docData.issueDate, { size: 14 })}{textField(layout.fields?.status, docData.status, { size: 14 })}{textField(layout.fields?.dueDate, docData.dueDate, { size: 13 })}{textField(layout.fields?.competence, docData.competence, { size: 14 })}{textField(layout.fields?.customerName, docData.customerName, { size: 15 })}{textField(layout.fields?.customerCpf, docData.customerCpf, { size: 14 })}{textField(layout.fields?.familyGroup, docData.familyGroup, { size: 13 })}{textField(layout.fields?.declarationLine1, docData.declarationLine1, { size: 12 })}{textField(layout.fields?.declarationLine2, docData.declarationLine2, { size: 12 })}{textField(layout.fields?.declarationLine3, docData.declarationLine3, { size: 12 })}{textField(layout.fields?.verificationCode, docData.verificationCode, { size: 12 })}{textField(layout.fields?.pixKey, docData.pixKey, { size: 11 })}{textField(layout.fields?.pixBeneficiary, docData.pixBeneficiary, { size: 11 })}{textField(layout.fields?.pixCopyPaste, docData.pixCopyPaste, { size: 10, wrap: true, mono: true, weight: 600 })}{textField(layout.fields?.boletoLine, docData.boletoLine, { size: 10, wrap: true, mono: true, weight: 700 })}{textField(layout.fields?.observationLine1, docData.observationLine1, { size: 11 })}{textField(layout.fields?.observationLine2, docData.observationLine2, { size: 11 })}{textField(layout.fields?.observationLine3, docData.observationLine3, { size: 11 })}{itemsArea ? <div style={{ ...boxStyle(itemsArea), color: '#5A3A2A', fontFamily: 'Georgia, serif', fontSize: 11, display: 'grid', alignContent: 'start', gap: 14, paddingTop: 2 }}>{items.map((item, index) => <div key={`${item.description}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 120px', gap: 12, alignItems: 'center', minHeight: 42 }}><div>{item.description}</div><div style={{ textAlign: 'right' }}>{item.qty}</div><div style={{ textAlign: 'right', fontWeight: 700 }}>{item.value}</div></div>)}</div> : null}{layout.fields?.qrArea && qrUrl ? <div style={{ ...boxStyle(layout.fields.qrArea), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src={qrUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div> : null}{layout.fields?.barcodeArea ? <div style={{ ...boxStyle(layout.fields.barcodeArea), background: 'repeating-linear-gradient(90deg, rgba(69,49,35,0.95) 0 2px, transparent 2px 4px, rgba(69,49,35,0.95) 4px 5px, transparent 5px 8px)', opacity: docData?.boletoLine ? 0.9 : 0.15, borderRadius: 8 }} /> : null}</div></div>; }
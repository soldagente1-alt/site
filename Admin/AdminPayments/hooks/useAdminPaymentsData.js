import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getDefaultBillingSettings, normalizeStatus } from "../helpers";
import { loadBillingSettings } from "../services/adminPaymentsApi";
import {
  fetchPayments,
  fetchFamilies,
  loadSelectedContext as loadSelectedContextService,
  patchPaymentInList,
  markPaymentOverdue,
  getPendingOverdueIds,
} from "../services/adminPaymentsData";

export default function useAdminPaymentsData() {
  const [payments, setPayments] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingSettings, setBillingSettings] = useState(getDefaultBillingSettings());
  const [loadingBillingSettings, setLoadingBillingSettings] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedFamilyData, setSelectedFamilyData] = useState(null);
  const [selectedGroupData, setSelectedGroupData] = useState(null);
  const [selectedFamilyPlan, setSelectedFamilyPlan] = useState(null);
  const [loadingSelectedContext, setLoadingSelectedContext] = useState(false);

  const overdueCheckedRef = useRef(false);
  const selectedPaymentIdRef = useRef("");

  const familyIndex = useMemo(() => {
    const map = new Map();
    families.forEach((family) => map.set(family.id, family));
    return map;
  }, [families]);

  const reloadPayments = useCallback(async ({ preserveSelected = true } = {}) => {
    overdueCheckedRef.current = false;
    const nextPayments = await fetchPayments();
    setPayments(nextPayments);

    if (preserveSelected && selectedPaymentIdRef.current) {
      const nextSelected = nextPayments.find((payment) => payment.id === selectedPaymentIdRef.current) || null;
      setSelectedPayment(nextSelected);
    }

    return nextPayments;
  }, []);

  const reloadFamilies = useCallback(async () => {
    const nextFamilies = await fetchFamilies();
    setFamilies(nextFamilies);
    return nextFamilies;
  }, []);

  const refreshBillingSettings = useCallback(async () => {
    setLoadingBillingSettings(true);
    try {
      const settings = await loadBillingSettings();
      setBillingSettings(settings);
      return settings;
    } catch (error) {
      console.error(error);
      setBillingSettings(getDefaultBillingSettings());
      toast.error("Não consegui carregar as configurações de cobrança. Usei o padrão do sistema.");
      return getDefaultBillingSettings();
    } finally {
      setLoadingBillingSettings(false);
    }
  }, []);

  const refreshSelectedContext = useCallback(
    async (payment) => {
      if (!payment?.family_id) {
        setSelectedFamilyData(null);
        setSelectedGroupData(null);
        setSelectedFamilyPlan(null);
        return null;
      }

      setLoadingSelectedContext(true);
      try {
        const { family, group, plan } = await loadSelectedContextService(payment, familyIndex);
        setSelectedFamilyData(family || null);
        setSelectedGroupData(group || null);
        setSelectedFamilyPlan(plan || null);
        return { family, group, plan };
      } catch (error) {
        console.error(error);
        toast.error("Não consegui carregar o contexto da família para documentos.");
        return null;
      } finally {
        setLoadingSelectedContext(false);
      }
    },
    [familyIndex]
  );

  const openPayment = useCallback(
    async (payment) => {
      setSelectedPayment(payment);
      await refreshSelectedContext(payment);
    },
    [refreshSelectedContext]
  );

  const patchPayment = useCallback((paymentId, patch) => {
    setPayments((current) => patchPaymentInList(current, paymentId, patch));
    setSelectedPayment((current) => (current?.id === paymentId ? { ...current, ...patch } : current));
  }, []);

  useEffect(() => {
    selectedPaymentIdRef.current = selectedPayment?.id || "";
  }, [selectedPayment]);

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          reloadPayments({ preserveSelected: false }),
          refreshBillingSettings(),
          reloadFamilies(),
        ]);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [reloadFamilies, reloadPayments, refreshBillingSettings]);

  useEffect(() => {
    if (!payments.length || overdueCheckedRef.current) return;

    overdueCheckedRef.current = true;
    const overdueIds = getPendingOverdueIds(payments);
    if (!overdueIds.length) return;

    overdueIds.forEach(async (paymentId) => {
      try {
        await markPaymentOverdue(paymentId);
        patchPayment(paymentId, { status: "overdue" });
      } catch (error) {
        console.error(error);
      }
    });
  }, [payments, patchPayment]);

  const activeFamilies = useMemo(
    () => families.filter((family) => normalizeStatus(family?.status) === "active"),
    [families]
  );

  return {
    payments,
    families,
    loading,
    billingSettings,
    loadingBillingSettings,
    selectedPayment,
    selectedFamilyData,
    selectedGroupData,
    selectedFamilyPlan,
    loadingSelectedContext,
    familyIndex,
    activeFamilies,
    setSelectedPayment,
    reloadPayments,
    reloadFamilies,
    refreshBillingSettings,
    refreshSelectedContext,
    openPayment,
    patchPayment,
  };
}

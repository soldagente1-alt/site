import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Sun,
  Zap,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Users,
  Battery,
  Gauge,
  Shield,
} from "lucide-react";

import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

/* =========================
   STATUS CONFIG
========================= */
const statusLabels = {
  pending: { label: "Aguardando aprovação", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Aprovado", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  in_group: { label: "Em grupo", color: "bg-purple-100 text-purple-700", icon: Users },
  active: { label: "Kit ativo", color: "bg-green-100 text-green-700", icon: Zap },
  completed: { label: "Quitado", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 }
};

export default function FamilyPlan() {
  const [familyData, setFamilyData] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);

  function asNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function getInstallments(plan) {
    return (
      asNumber(plan?.installments, 0) ||
      asNumber(plan?.installments_qty, 0) ||
      asNumber(plan?.installments_quantity, 0) ||
      asNumber(plan?.number_of_installments, 0) ||
      asNumber(plan?.parcelas, 0)
    );
  }

  function getMonthlyFromPlan(plan) {
    const direct =
      asNumber(plan?.monthly_payment, 0) ||
      asNumber(plan?.monthly_value, 0) ||
      asNumber(plan?.monthly_installment, 0);

    if (direct > 0) return direct;

    const kitValue = asNumber(plan?.kit_value, 0);
    const inst = getInstallments(plan);
    if (kitValue > 0 && inst > 0) return kitValue / inst;

    return 0;
  }

  async function loadAll(user) {
    try {
      setLoading(true);

      const familyRef = doc(db, "Family", user.uid);
      const familySnap = await getDoc(familyRef);
      if (!familySnap.exists()) {
        setFamilyData(null);
        setGroupData(null);
        setTotalPaid(0);
        return;
      }

      const family = { id: familySnap.id, ...familySnap.data() };

      const effectivePlanId = family.plan_id || family.pre_enrolled_plan_id || null;

      let plan = null;
      if (effectivePlanId) {
        const planRef = doc(db, "Familyplans", effectivePlanId);
        const planSnap = await getDoc(planRef);
        if (planSnap.exists()) {
          plan = planSnap.data();
        }
      }

      setFamilyData({ ...family, plan });

      const paymentsSnap = await getDocs(collection(db, "Payments"));
      const paidTotal = paymentsSnap.docs
        .map((d) => d.data())
        .filter((p) => p.family_id === family.id && p.status === "paid")
        .reduce((acc, p) => acc + (p.amount || 0), 0);

      setTotalPaid(paidTotal);

      const effectiveGroupId = family.group_id || family.pre_enrolled_group_id || null;
      if (effectiveGroupId) {
        const groupSnap = await getDoc(doc(db, "Group", effectiveGroupId));
        if (groupSnap.exists()) {
          setGroupData(groupSnap.data());
        } else {
          setGroupData(null);
        }
      } else {
        setGroupData(null);
      }
    } catch (err) {
      console.error("Erro ao carregar plano:", err);
      toast.error("Erro ao carregar seu plano.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      await loadAll(user);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Carregando plano...</h2>
        <p className="text-slate-500">Buscando dados do seu kit solar.</p>
      </div>
    );
  }

  if (!familyData) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Plano não encontrado</h2>
        <p className="text-slate-500">Não encontramos um plano associado a este usuário.</p>
      </div>
    );
  }

  const monthlyPaymentNum = Number(
    familyData.monthly_payment || getMonthlyFromPlan(familyData.plan) || 0
  );
  const currentBillNum = Number(familyData.current_energy_bill || 0);

  const concessionFee = 50;
  const withSolTotal = monthlyPaymentNum + concessionFee;

  const monthlySavings = currentBillNum - withSolTotal;
  const annualSavings = monthlySavings * 12;
  const annualSavingsBeforpayoff = annualSavings * 10;

  const statusObj = statusLabels[familyData.status || "pending"] || statusLabels.pending;
  const StatusIcon = statusObj.icon;

  const createdDateFormatted = (() => {
    if (!groupData?.created_date) return "-";

    if (groupData.created_date?.seconds) {
      return format(new Date(groupData.created_date.seconds * 1000), "dd/MM/yyyy");
    }

    const dateObj = new Date(groupData.created_date);
    if (!isNaN(dateObj)) {
      return format(dateObj, "dd/MM/yyyy");
    }

    return "-";
  })();

  return (
    <div className="space-y-6">
      {/* ✅ Botão removido: vencimento agora é na página de Pagamentos */}

      <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
        <CardContent className="p-6 flex justify-between">
          <div>
            <Badge className="bg-white/20 text-white mb-3 flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusObj.label}
            </Badge>
            <h2 className="text-2xl font-bold">{familyData.plan?.name || "Kit Solar"}</h2>
            <p className="text-amber-100">
              Potência: {familyData.plan?.kit_power || "-"} kWp • {familyData.plan?.panel_quantity || "-"} painéis
            </p>
          </div>
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
            <Sun className="w-10 h-10" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="w-5 h-5 text-amber-500" />
            Detalhes do Kit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoDetail
              icon={<Sun className="w-6 h-6 text-amber-600" />}
              title="Painéis Solares"
              value={`${familyData.plan?.panel_quantity || "-"} unidades`}
              bg="amber"
            />
            <InfoDetail
              icon={<Gauge className="w-6 h-6 text-sky-600" />}
              title="Potência Total"
              value={`${familyData.plan?.kit_power || "-"} kWp`}
              bg="sky"
            />
            <InfoDetail
              icon={<Zap className="w-6 h-6 text-green-600" />}
              title="Geração Média Mensal"
              value={`~${familyData.plan?.average_generation || "-"} kWh`}
              bg="green"
            />
            <InfoDetail
              icon={<Shield className="w-6 h-6 text-purple-600" />}
              title="Garantia"
              value={`${familyData.plan?.warranty_years || "-"} anos`}
              bg="purple"
            />
          </div>
        </CardContent>
      </Card>

      {groupData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Detalhes do Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoDetail
                icon={<Users className="w-6 h-6 text-amber-600" />}
                title="Nome do Grupo"
                value={groupData.name}
                bg="amber"
              />
              <InfoDetail
                icon={<Calendar className="w-6 h-6 text-sky-600" />}
                title="Data de Criação"
                value={createdDateFormatted}
                bg="sky"
              />
              <InfoDetail
                icon={<Users className="w-6 h-6 text-green-600" />}
                title="Participantes"
                value={`${groupData.current_participants || 0}/${groupData.max_participants || "-"}`}
                bg="green"
              />
              <InfoDetail
                icon={<Badge className="bg-purple-200 text-purple-700 px-2 py-1 rounded-full text-xs" />}
                title="Status do Grupo"
                value={groupData.status || "-"}
                bg="purple"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sua Economia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoBox label="Conta antiga" value={`R$ ${formatBRL(currentBillNum)}`} variant="red" suffix="/mês" />
            <InfoBox label="Com Sol da Gente + Concessionária" value={`R$ ${formatBRL(withSolTotal)}`} variant="green" suffix="/mês" />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-600">Economia mensal</p>
            <p className="text-3xl font-bold text-green-700">R$ {formatBRL(monthlySavings)}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <InfoBox label="Economia anual" value={`R$ ${formatBRL(annualSavings)}`} />
            <InfoBox label="Em 10 anos" value={`R$ ${formatBRL(annualSavingsBeforpayoff)}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="text-red-500" />
            Local da Instalação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl">
            <p className="font-medium">
              {familyData.address?.street}, {familyData.address?.number}
            </p>
            <p className="text-slate-600">
              {familyData.address?.city}/{familyData.address?.state}
            </p>
          </div>

          {familyData.installation_date && (
            <div className="bg-green-50 p-4 rounded-xl flex gap-4">
              <Calendar className="text-green-600" />
              <div>
                <p className="text-sm text-green-600">Instalação</p>
                <p className="font-semibold text-green-700">
                  {format(
                    new Date(familyData.installation_date.seconds * 1000),
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR }
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBox({ label, value, variant = "slate", suffix = "" }) {
  const styles = {
    slate: "bg-slate-50 text-slate-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700"
  };

  return (
    <div className={`rounded-xl p-4 text-center ${styles[variant]}`}>
      <p className="text-sm">{label}</p>
      <p className="text-xl font-bold">
        {typeof value === "number" ? `R$ ${value.toLocaleString("pt-BR")}` : value}
        {suffix}
      </p>
    </div>
  );
}

function InfoDetail({ icon, title, value, bg }) {
  const bgClasses = {
    amber: "bg-amber-100",
    sky: "bg-sky-100",
    green: "bg-green-100",
    purple: "bg-purple-100"
  };
  return (
    <div className={`flex items-center gap-4 p-4 ${bgClasses[bg]} rounded-xl`}>
      <div className="w-12 h-12 flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function formatBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

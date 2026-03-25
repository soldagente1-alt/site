import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

function moneyBRL(v = 0) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoneyToNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pickFirstPositive(...vals) {
  for (const v of vals) {
    const n = parseMoneyToNumber(v);
    if (n !== null && n > 0) return n;
  }
  return null;
}

function getFirstNonEmpty(...vals) {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function safeDateFromFirestoreLike(value) {
  if (!value) return null;

  try {
    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      return isValid(d) ? d : null;
    }

    if (typeof value === "object" && value?.seconds !== undefined) {
      const ms = Number(value.seconds) * 1000;
      const d = new Date(ms);
      return isValid(d) ? d : null;
    }

    if (value instanceof Date) {
      return isValid(value) ? value : null;
    }

    if (typeof value === "number") {
      const ms = value < 1e12 ? value * 1000 : value;
      const d = new Date(ms);
      return isValid(d) ? d : null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? `${trimmed}T00:00:00`
        : trimmed;
      const d = new Date(normalized);
      return isValid(d) ? d : null;
    }

    return null;
  } catch {
    return null;
  }
}

function safeFormatDateBR(value, fallback = "-") {
  const d = safeDateFromFirestoreLike(value);
  return d ? format(d, "dd/MM/yyyy") : fallback;
}

function getTimestampDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPaymentDateObj(payment) {
  return getTimestampDate(payment?.due_date) || getTimestampDate(payment?.due_at);
}

function getPaymentIssueDate(payment) {
  return (
    getTimestampDate(payment?.paid_at) ||
    getTimestampDate(payment?.paidAt) ||
    getTimestampDate(payment?.payment_date) ||
    getTimestampDate(payment?.updated_at) ||
    getTimestampDate(payment?.created_at) ||
    getPaymentDateObj(payment) ||
    new Date()
  );
}

function fmtDueDate(payment) {
  const d = getPaymentDateObj(payment);
  return d ? format(d, "dd/MM/yyyy") : "Sem vencimento";
}

function formatDateBR(dateValue) {
  const d = getTimestampDate(dateValue);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

function formatCompetence(payment) {
  const d = getPaymentDateObj(payment);
  return d ? format(d, "MM/yyyy", { locale: ptBR }) : "—";
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isPaymentCurrentMonth(payment) {
  const dd = getPaymentDateObj(payment);
  return !!dd && monthKey(dd) === monthKey(new Date());
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function getFamilyPlanId(entity) {
  return (
    entity?.plan_id ||
    entity?.family_plan_id ||
    entity?.familyPlanId ||
    entity?.planId ||
    null
  );
}

function getPlanMonthlyFromPlanDoc(plan) {
  return pickFirstPositive(
    plan?.monthly_payment,
    plan?.monthly_price,
    plan?.monthly_value,
    plan?.mensalidade,
    plan?.plan_monthly_price,
    plan?.plan_monthly_value
  );
}

function inferPlanMonthlyFromPayments(payments = []) {
  const candidates = payments
    .map((payment) => pickFirstPositive(payment?.amount, payment?.value, payment?.monthly_value))
    .filter((value) => value !== null && value > 0);

  if (!candidates.length) return null;

  const frequency = new Map();
  candidates.forEach((value) => {
    const rounded = Number(Number(value).toFixed(2));
    frequency.set(rounded, (frequency.get(rounded) || 0) + 1);
  });

  return [...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function isFamilyActiveNow(family) {
  const status = normalizeStatus(family?.status || family?.activation_status || family?.pipeline_stage);
  return ["active", "kit_ativo", "homologated", "ativo"].includes(status);
}

function getStatusLabel(status) {
  return statusConfig[normalizeStatus(status)]?.label || "—";
}

function getFamilyDisplayName(family) {
  return (
    getFirstNonEmpty(
      family?.full_name,
      family?.name,
      family?.responsavel_nome,
      family?.lead_name,
      family?.displayName,
      family?.nome
    ) || "Família sem nome"
  );
}

function getFamilyCpf(family) {
  return (
    getFirstNonEmpty(
      family?.cpf,
      family?.responsavel_cpf,
      family?.document,
      family?.cpf_cnpj,
      family?.taxId
    ) || "—"
  );
}

function getGroupDisplayName(group) {
  return getFirstNonEmpty(group?.name, group?.title, group?.label, group?.codigo, group?.code) || "Sem grupo";
}

function getFamilyGroupLabel(familyData, groupData) {
  return getGroupDisplayName(groupData) || getFirstNonEmpty(familyData?.group_name, familyData?.group_code) || "Sem grupo";
}

const statusConfig = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  paid: { label: "Pago", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  overdue: { label: "Atrasado", color: "bg-red-100 text-red-700", icon: AlertCircle },
  cancelled: { label: "Cancelado", color: "bg-slate-100 text-slate-700", icon: Clock },
};

const statusFallback = { label: "—", color: "bg-slate-100 text-slate-700", icon: Clock };

const typeConfig = {
  family_payment: { label: "Entrada", color: "bg-green-100 text-green-700" },
  investor_return: { label: "Retorno", color: "bg-sky-100 text-sky-700" },
  franchise_commission: { label: "Comissão", color: "bg-amber-100 text-amber-700" },
};

export {
  moneyBRL,
  parseMoneyToNumber,
  pickFirstPositive,
  getFirstNonEmpty,
  safeDateFromFirestoreLike,
  safeFormatDateBR,
  getTimestampDate,
  getPaymentDateObj,
  getPaymentIssueDate,
  fmtDueDate,
  formatDateBR,
  formatCompetence,
  monthKey,
  isPaymentCurrentMonth,
  normalizeStatus,
  getFamilyPlanId,
  getPlanMonthlyFromPlanDoc,
  inferPlanMonthlyFromPayments,
  isFamilyActiveNow,
  getStatusLabel,
  getFamilyDisplayName,
  getFamilyCpf,
  getGroupDisplayName,
  getFamilyGroupLabel,
  statusConfig,
  statusFallback,
  typeConfig,
};

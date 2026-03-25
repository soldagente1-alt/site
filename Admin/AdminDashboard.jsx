import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileSignature,
  Filter,
  FolderKanban,
  HandCoins,
  Landmark,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sun,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

import {
  MiniAreaCompareChart,
  MiniBarChart,
  MiniDonutChart,
} from "../../components/ui/light-charts";

/* =========================
   HELPERS
========================= */
function norm(v) {
  return String(v || "").trim().toLowerCase();
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function getAnyValue(obj, keys = []) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function toDateAny(value) {
  if (!value) return null;
  try {
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      const dt = new Date(s);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

function moneyBRL(value) {
  return num(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function intBR(value) {
  return num(value).toLocaleString("pt-BR");
}

function pctBR(value) {
  return `${num(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function safeAvg(sum, count) {
  return count > 0 ? sum / count : 0;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getLastMonths(count = 6) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return months;
}

function monthLabel(date) {
  return date
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .replace(/^./, (c) => c.toUpperCase());
}

function normalSide(type) {
  return type === "ASSET" || type === "EXPENSE" ? "D" : "C";
}

function getPaymentAmount(payment) {
  return num(payment?.amount ?? payment?.value ?? payment?.total ?? 0);
}

function getPaymentStatus(payment) {
  return norm(payment?.status || payment?.payment_status);
}

function getPaymentDueDate(payment) {
  return (
    toDateAny(payment?.due_date) ||
    toDateAny(payment?.dueDate) ||
    toDateAny(payment?.billing_date) ||
    toDateAny(payment?.created_at) ||
    null
  );
}

function getPaymentPaidDate(payment) {
  return (
    toDateAny(payment?.paid_at) ||
    toDateAny(payment?.paid_date) ||
    toDateAny(payment?.payment_date) ||
    toDateAny(payment?.updated_at) ||
    null
  );
}

function getGroupCapacity(group) {
  return (
    num(group?.capacity) ||
    num(group?.group_capacity) ||
    num(group?.max_participants) ||
    num(group?.max_families) ||
    num(group?.total_slots) ||
    0
  );
}

function getGroupParticipants(group) {
  return (
    num(group?.current_participants) ||
    num(group?.current_families) ||
    num(group?.members_count) ||
    num(group?.participants) ||
    0
  );
}

function getFamilyGroupId(family) {
  return String(
    getAnyValue(family, [
      "group_participant_group_id",
      "open_group_id",
      "group_id",
      "groupId",
      "groupID",
      "id_group",
    ]) || ""
  ).trim();
}

function getGroupFranchiseId(group) {
  return String(
    getAnyValue(group, ["franchise_id", "franchiseId", "franchiseID", "owner_franchise_id"]) || ""
  ).trim();
}

function getFamilyFranchiseId(family, groupMap) {
  const direct = String(
    getAnyValue(family, ["franchise_id", "franchiseId", "franchiseID", "owner_franchise_id"]) || ""
  ).trim();
  if (direct) return direct;

  const groupId = getFamilyGroupId(family);
  if (!groupId) return "";
  return getGroupFranchiseId(groupMap[groupId] || {});
}

function getEntityFamilyId(entity) {
  return String(
    getAnyValue(entity, ["family_id", "familyId", "family_uid", "familyUid", "familyID", "familyUID"]) || ""
  ).trim();
}

function getEntityGroupId(entity) {
  return String(
    getAnyValue(entity, ["group_participant_group_id", "open_group_id", "group_id", "groupId", "groupID", "id_group"]) ||
      ""
  ).trim();
}

function getEntityFranchiseId(entity) {
  return String(
    getAnyValue(entity, ["franchise_id", "franchiseId", "franchiseID", "owner_franchise_id"]) || ""
  ).trim();
}

function normalizeFamilyStage(family) {
  if (!family) return "cadastro";
  if (norm(family?.activation_status) === "kit_ativo" || norm(family?.status) === "active") {
    return "ativo";
  }

  const s = norm(family?.pipeline_stage);
  const map = {
    cadastro: "cadastro",
    plano: "grupo",
    grupo: "grupo",
    contrato: "contrato",
    projeto_eletrico: "projeto_eletrico",
    visita: "instalacao",
    instalacao: "instalacao",
    "instalação": "instalacao",
    homologacao: "homologacao",
    "homologação": "homologacao",
    ativo: "ativo",
  };

  return map[s] || "cadastro";
}

function safeCollectionResult(result) {
  if (result.status !== "fulfilled") return [];
  return result.value;
}

async function readCollection(name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn(`Falha ao carregar ${name}:`, error);
    return [];
  }
}

function inPeriod(date, fromDate) {
  if (!fromDate) return true;
  if (!date) return false;
  return date >= fromDate;
}

function resolveRoutePath(page) {
  const key = String(page || "").trim();
  const routeMap = {
    AdminFamilies: "/admin/families",
    AdminGroups: "/admin/groups",
    AdminContract: "/admin/contract",
    Reports: "/admin/financeiro/relatorios",
    AdminWaitlist: "/admin/adminwaitlist",
    AdminPayments: "/admin/payments",
    AdminPlans: "/admin/plans",
    AdminDashboard: "/admin/dashboard",
  };

  if (routeMap[key]) return routeMap[key];
  if (key.startsWith("/")) return key;
  return "/admin/dashboard";
}

function createNavUrl(page, params = {}) {
  const base = resolveRoutePath(page);
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    qp.set(key, String(value));
  });
  const suffix = qp.toString();
  return suffix ? `${base}?${suffix}` : base;
}

const GROUP_STATUS_COLORS = ["#0f766e", "#2563eb", "#d97706", "#16a34a", "#7c3aed", "#dc2626"];
const BILLING_STATUS_COLORS = ["#16a34a", "#f59e0b", "#dc2626", "#64748b"];
const PERIOD_OPTIONS = [
  { value: "30d", label: "30 dias", days: 30, months: 6 },
  { value: "90d", label: "90 dias", days: 90, months: 6 },
  { value: "180d", label: "180 dias", days: 180, months: 6 },
  { value: "365d", label: "12 meses", days: 365, months: 12 },
  { value: "all", label: "Tudo", days: null, months: 12 },
];

/* =========================
   COMPONENT
========================= */
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const [families, setFamilies] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [groups, setGroups] = useState([]);
  const [payments, setPayments] = useState([]);
  const [waitlistLeads, setWaitlistLeads] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [engineeringProjects, setEngineeringProjects] = useState([]);
  const [technicalJobs, setTechnicalJobs] = useState([]);
  const [homologations, setHomologations] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLines, setJournalLines] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [periodFilter, setPeriodFilter] = useState("180d");
  const [franchiseFilter, setFranchiseFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      setLoading(true);

      const results = await Promise.allSettled([
        readCollection("Family"),
        readCollection("investors"),
        readCollection("franchises"),
        readCollection("Group"),
        readCollection("Payments"),
        readCollection("WaitlistLeads"),
        readCollection("FamilyContracts"),
        readCollection("FamilyDocuments"),
        readCollection("EngineeringProjects"),
        readCollection("TechnicalJobs"),
        readCollection("TechnicalHomologations"),
        readCollection("journal_entries"),
        readCollection("journal_lines"),
        readCollection("accounts"),
      ]);

      if (!mounted) return;

      setFamilies(safeCollectionResult(results[0]));
      setInvestors(safeCollectionResult(results[1]));
      setFranchises(safeCollectionResult(results[2]));
      setGroups(safeCollectionResult(results[3]));
      setPayments(safeCollectionResult(results[4]));
      setWaitlistLeads(safeCollectionResult(results[5]));
      setContracts(safeCollectionResult(results[6]));
      setDocuments(safeCollectionResult(results[7]));
      setEngineeringProjects(safeCollectionResult(results[8]));
      setTechnicalJobs(safeCollectionResult(results[9]));
      setHomologations(safeCollectionResult(results[10]));
      setJournalEntries(safeCollectionResult(results[11]));
      setJournalLines(safeCollectionResult(results[12]));
      setAccounts(safeCollectionResult(results[13]));
      setLastLoadedAt(new Date());
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const accountMap = useMemo(() => {
    const map = {};
    accounts.forEach((account) => {
      map[account.id] = account;
    });
    return map;
  }, [accounts]);

  const groupMap = useMemo(() => {
    const map = {};
    groups.forEach((group) => {
      map[group.id] = group;
    });
    return map;
  }, [groups]);

  const franchiseMap = useMemo(() => {
    const map = {};
    franchises.forEach((franchise) => {
      map[franchise.id] = franchise;
    });
    return map;
  }, [franchises]);

  const periodInfo = useMemo(() => {
    const found = PERIOD_OPTIONS.find((item) => item.value === periodFilter) || PERIOD_OPTIONS[2];
    const fromDate = found.days ? new Date(Date.now() - found.days * 24 * 60 * 60 * 1000) : null;
    return { ...found, fromDate };
  }, [periodFilter]);

  const franchiseOptions = useMemo(() => {
    return franchises
      .slice()
      .sort((a, b) => String(a?.name || a?.title || a?.id).localeCompare(String(b?.name || b?.title || b?.id)));
  }, [franchises]);

  const filteredGroupOptions = useMemo(() => {
    return groups
      .filter((group) => {
        if (franchiseFilter === "all") return true;
        return getGroupFranchiseId(group) === franchiseFilter;
      })
      .slice()
      .sort((a, b) => String(a?.name || a?.title || a?.id).localeCompare(String(b?.name || b?.title || b?.id)));
  }, [groups, franchiseFilter]);

  useEffect(() => {
    if (groupFilter === "all") return;
    const exists = filteredGroupOptions.some((group) => String(group.id) === String(groupFilter));
    if (!exists) setGroupFilter("all");
  }, [filteredGroupOptions, groupFilter]);

  const latestDocsByFamily = useMemo(() => {
    const map = {};
    documents.forEach((docItem) => {
      const familyId = getEntityFamilyId(docItem) || String(docItem?.id || "").trim();
      if (!familyId) return;
      const currentDate = toDateAny(docItem?.updated_at) || toDateAny(docItem?.created_at) || new Date(0);
      const prev = map[familyId];
      const prevDate = prev ? toDateAny(prev?.updated_at) || toDateAny(prev?.created_at) || new Date(0) : new Date(0);
      if (!prev || currentDate > prevDate) map[familyId] = docItem;
    });
    return map;
  }, [documents]);

  const latestContractsByFamily = useMemo(() => {
    const map = {};
    contracts.forEach((ctr) => {
      const familyId = getEntityFamilyId(ctr);
      if (!familyId) return;
      const currentDate = toDateAny(ctr?.updated_at) || toDateAny(ctr?.generated_at) || new Date(0);
      const prev = map[familyId];
      const prevDate = prev ? toDateAny(prev?.updated_at) || toDateAny(prev?.generated_at) || new Date(0) : new Date(0);
      if (!prev || currentDate > prevDate) map[familyId] = ctr;
    });
    return map;
  }, [contracts]);

  const latestEngineeringByFamily = useMemo(() => {
    const map = {};
    engineeringProjects.forEach((project) => {
      const familyId = getEntityFamilyId(project);
      if (!familyId) return;
      const currentDate = toDateAny(project?.updated_at) || toDateAny(project?.created_at) || new Date(0);
      const prev = map[familyId];
      const prevDate = prev ? toDateAny(prev?.updated_at) || toDateAny(prev?.created_at) || new Date(0) : new Date(0);
      if (!prev || currentDate > prevDate) map[familyId] = project;
    });
    return map;
  }, [engineeringProjects]);

  const latestHomologationByFamily = useMemo(() => {
    const map = {};
    homologations.forEach((item) => {
      const familyId = getEntityFamilyId(item);
      if (!familyId) return;
      const currentDate = toDateAny(item?.updated_at) || toDateAny(item?.created_at) || new Date(0);
      const prev = map[familyId];
      const prevDate = prev ? toDateAny(prev?.updated_at) || toDateAny(prev?.created_at) || new Date(0) : new Date(0);
      if (!prev || currentDate > prevDate) map[familyId] = item;
    });
    return map;
  }, [homologations]);

  const scopedFamilies = useMemo(() => {
    return families.filter((family) => {
      const familyGroupId = getFamilyGroupId(family);
      const familyFranchiseId = getFamilyFranchiseId(family, groupMap);

      if (franchiseFilter !== "all" && familyFranchiseId !== franchiseFilter) return false;
      if (groupFilter !== "all" && familyGroupId !== groupFilter) return false;
      return true;
    });
  }, [families, groupMap, franchiseFilter, groupFilter]);

  const scopedFamilyIds = useMemo(() => {
    return new Set(scopedFamilies.map((family) => String(family.id)));
  }, [scopedFamilies]);

  const scopedGroups = useMemo(() => {
    return groups.filter((group) => {
      const groupId = String(group.id);
      const groupFranchiseId = getGroupFranchiseId(group);
      if (franchiseFilter !== "all" && groupFranchiseId !== franchiseFilter) return false;
      if (groupFilter !== "all" && groupId !== groupFilter) return false;
      return true;
    });
  }, [groups, franchiseFilter, groupFilter]);

  const scopedPayments = useMemo(() => {
    return payments.filter((payment) => {
      const familyId = getEntityFamilyId(payment);
      if (familyId && scopedFamilyIds.has(familyId)) return true;

      const paymentGroupId = getEntityGroupId(payment);
      const paymentFranchiseId = getEntityFranchiseId(payment);

      if (groupFilter !== "all" && paymentGroupId) return paymentGroupId === groupFilter;
      if (franchiseFilter !== "all" && paymentFranchiseId) return paymentFranchiseId === franchiseFilter;

      return familyId ? false : franchiseFilter === "all" && groupFilter === "all";
    });
  }, [payments, scopedFamilyIds, groupFilter, franchiseFilter]);

  const scopedWaitlistLeads = useMemo(() => {
    return waitlistLeads.filter((lead) => {
      const leadGroupId = getEntityGroupId(lead);
      const leadFranchiseId = getEntityFranchiseId(lead);
      if (franchiseFilter !== "all" && leadFranchiseId && leadFranchiseId !== franchiseFilter) return false;
      if (groupFilter !== "all" && leadGroupId && leadGroupId !== groupFilter) return false;
      if (franchiseFilter !== "all" && !leadFranchiseId && groupFilter === "all") return true;
      if (groupFilter !== "all" && !leadGroupId) return false;
      return true;
    });
  }, [waitlistLeads, franchiseFilter, groupFilter]);

  const scopedContracts = useMemo(() => contracts.filter((item) => scopedFamilyIds.has(getEntityFamilyId(item))), [contracts, scopedFamilyIds]);
  const scopedDocuments = useMemo(() => documents.filter((item) => scopedFamilyIds.has(getEntityFamilyId(item) || String(item?.id || ""))), [documents, scopedFamilyIds]);
  const scopedEngineeringProjects = useMemo(() => engineeringProjects.filter((item) => scopedFamilyIds.has(getEntityFamilyId(item))), [engineeringProjects, scopedFamilyIds]);
  const scopedHomologations = useMemo(() => homologations.filter((item) => scopedFamilyIds.has(getEntityFamilyId(item))), [homologations, scopedFamilyIds]);
  const scopedTechnicalJobs = useMemo(() => technicalJobs.filter((item) => scopedFamilyIds.has(getEntityFamilyId(item))), [technicalJobs, scopedFamilyIds]);

  const chartMonths = periodInfo.months || 12;

  const jobsSummary = useMemo(() => {
    const summary = {
      visitsScheduled: 0,
      visitsInProgress: 0,
      visitsCompleted: 0,
      installsScheduled: 0,
      installsInProgress: 0,
      installsCompleted: 0,
    };

    scopedTechnicalJobs.forEach((job) => {
      const type = norm(job?.type);
      const status = norm(job?.status);
      const relevantDate =
        toDateAny(job?.scheduled_at) ||
        toDateAny(job?.updated_at) ||
        toDateAny(job?.created_at) ||
        null;
      if (!inPeriod(relevantDate, periodInfo.fromDate)) return;

      if (type === "visit") {
        if (status === "scheduled") summary.visitsScheduled += 1;
        else if (status === "in_progress") summary.visitsInProgress += 1;
        else if (status === "completed") summary.visitsCompleted += 1;
      }
      if (type === "install") {
        if (status === "scheduled") summary.installsScheduled += 1;
        else if (status === "in_progress") summary.installsInProgress += 1;
        else if (status === "completed") summary.installsCompleted += 1;
      }
    });

    return summary;
  }, [scopedTechnicalJobs, periodInfo.fromDate]);

  const financial = useMemo(() => {
    const today = new Date();
    const currentMonth = getMonthStart(today);
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    let paidTotal = 0;
    let paidCount = 0;
    let receivedThisMonth = 0;
    let receivedPreviousMonth = 0;

    let pendingWallet = 0;
    let overdueWallet = 0;

    scopedPayments.forEach((payment) => {
      const amount = getPaymentAmount(payment);
      const status = getPaymentStatus(payment);
      const dueDate = getPaymentDueDate(payment);
      const paidDate = getPaymentPaidDate(payment);
      const baseDate = paidDate || dueDate;

      if (status === "paid" && inPeriod(baseDate, periodInfo.fromDate)) {
        paidTotal += amount;
        paidCount += 1;

        if (baseDate) {
          const month = getMonthStart(baseDate);
          if (month.getTime() === currentMonth.getTime()) receivedThisMonth += amount;
          if (month.getTime() === getMonthStart(previousMonth).getTime()) receivedPreviousMonth += amount;
        }
      }

      if (status === "paid") return;
      if (dueDate && dueDate < today) overdueWallet += amount;
      else pendingWallet += amount;
    });

    const receivables = pendingWallet + overdueWallet;
    const collectionEfficiency = paidTotal + receivables > 0 ? (paidTotal / (paidTotal + receivables)) * 100 : 0;
    const receivedDeltaPct =
      receivedPreviousMonth > 0
        ? ((receivedThisMonth - receivedPreviousMonth) / receivedPreviousMonth) * 100
        : receivedThisMonth > 0
        ? 100
        : 0;

    return {
      paidTotal,
      pendingWallet,
      overdueWallet,
      receivables,
      paidCount,
      averageTicket: safeAvg(paidTotal, paidCount),
      receivedThisMonth,
      receivedPreviousMonth,
      receivedDeltaPct,
      collectionEfficiency,
    };
  }, [scopedPayments, periodInfo.fromDate]);

  const scopedJournalEntries = useMemo(() => {
    return journalEntries.filter((entry) => {
      const entryDate = toDateAny(entry?.date) || toDateAny(entry?.created_at);
      if (!inPeriod(entryDate, periodInfo.fromDate)) return false;

      const entryGroupId = getEntityGroupId(entry);
      const entryFranchiseId = getEntityFranchiseId(entry);
      if (groupFilter !== "all" && entryGroupId && entryGroupId !== groupFilter) return false;
      if (franchiseFilter !== "all" && entryFranchiseId && entryFranchiseId !== franchiseFilter) return false;
      return true;
    });
  }, [journalEntries, periodInfo.fromDate, franchiseFilter, groupFilter]);

  const accounting = useMemo(() => {
    const entryMap = {};
    scopedJournalEntries.forEach((entry) => {
      entryMap[entry.id] = entry;
    });

    const months = getLastMonths(chartMonths);
    const monthMap = {};
    months.forEach((month) => {
      monthMap[getMonthKey(month)] = {
        month: monthLabel(month),
        receita: 0,
        despesa: 0,
      };
    });

    let totalExpense = 0;

    journalLines.forEach((line) => {
      const entry = entryMap[line?.entryId];
      if (!entry || norm(entry?.status) !== "posted") return;

      const account = accountMap[line?.accountId];
      if (!account) return;

      const entryDate = toDateAny(entry?.date) || toDateAny(entry?.created_at);
      if (!entryDate) return;

      const key = getMonthKey(getMonthStart(entryDate));
      const bucket = monthMap[key];
      if (!bucket) return;

      const amount = num(line?.amount);
      const delta = norm(line?.dc) === norm(normalSide(account?.type)) ? amount : -amount;

      if (account.type === "REVENUE") {
        bucket.receita += delta;
      }
      if (account.type === "EXPENSE") {
        const expenseValue = Math.abs(delta);
        bucket.despesa += expenseValue;
        totalExpense += expenseValue;
      }
    });

    return {
      monthly: months.map((month) => monthMap[getMonthKey(month)]),
      totalExpense,
    };
  }, [scopedJournalEntries, journalLines, accountMap, chartMonths]);

  const stageData = useMemo(() => {
    const counts = {
      cadastro: 0,
      grupo: 0,
      contrato: 0,
      projeto_eletrico: 0,
      instalacao: 0,
      homologacao: 0,
      ativo: 0,
    };

    scopedFamilies.forEach((family) => {
      const stage = normalizeFamilyStage(family);
      counts[stage] = (counts[stage] || 0) + 1;
    });

    return [
      { label: "Cadastro", value: counts.cadastro, to: createNavUrl("AdminFamilies", { pipeline: "cadastro", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { label: "Grupo", value: counts.grupo, to: createNavUrl("AdminFamilies", { pipeline: "grupo", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { label: "Contrato", value: counts.contrato, to: createNavUrl("AdminFamilies", { pipeline: "contrato", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { label: "Engenharia", value: counts.projeto_eletrico, to: createNavUrl("AdminFamilies", { pipeline: "projeto_eletrico", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { label: "Instalação", value: counts.instalacao, to: createNavUrl("AdminFamilies", { pipeline: "instalacao", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { label: "Homologação", value: counts.homologacao, to: createNavUrl("AdminFamilies", { pipeline: "homologacao", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { label: "Ativo", value: counts.ativo, to: createNavUrl("AdminFamilies", { pipeline: "ativo", franchiseId: franchiseFilter, groupId: groupFilter }) },
    ];
  }, [scopedFamilies, franchiseFilter, groupFilter]);

  const groupStatusData = useMemo(() => {
    const counts = {};
    scopedGroups.forEach((group) => {
      const status = norm(group?.status) || "sem_status";
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.keys(counts).map((status, index) => ({
      name: status.replace(/_/g, " "),
      value: counts[status],
      color: GROUP_STATUS_COLORS[index % GROUP_STATUS_COLORS.length],
      to: createNavUrl("AdminGroups", { status, franchiseId: franchiseFilter, groupId: groupFilter }),
    }));
  }, [scopedGroups, franchiseFilter, groupFilter]);

  const billingStatusData = useMemo(() => {
    const counts = { pago: 0, pendente: 0, vencido: 0, outros: 0 };
    const today = new Date();

    scopedPayments.forEach((payment) => {
      const status = getPaymentStatus(payment);
      const dueDate = getPaymentDueDate(payment);

      if (status === "paid") counts.pago += 1;
      else if (status === "overdue") counts.vencido += 1;
      else if ((status === "pending" || !status) && dueDate && dueDate < today) counts.vencido += 1;
      else if (status === "pending" || !status) counts.pendente += 1;
      else counts.outros += 1;
    });

    return [
      { name: "Pago", value: counts.pago, color: BILLING_STATUS_COLORS[0], to: createNavUrl("Reports", { tab: "razao", status: "paid", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { name: "Pendente", value: counts.pendente, color: BILLING_STATUS_COLORS[1], to: createNavUrl("Reports", { tab: "razao", status: "pending", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { name: "Vencido", value: counts.vencido, color: BILLING_STATUS_COLORS[2], to: createNavUrl("Reports", { tab: "razao", status: "overdue", franchiseId: franchiseFilter, groupId: groupFilter }) },
      { name: "Outros", value: counts.outros, color: BILLING_STATUS_COLORS[3], to: createNavUrl("Reports", { tab: "razao", status: "other", franchiseId: franchiseFilter, groupId: groupFilter }) },
    ].filter((item) => item.value > 0);
  }, [scopedPayments, franchiseFilter, groupFilter]);

  const groupCapacity = useMemo(() => {
    const rows = scopedGroups.map((group) => {
      const capacity = getGroupCapacity(group);
      const participants = getGroupParticipants(group);
      const occupation = capacity > 0 ? (participants / capacity) * 100 : 0;
      return {
        id: group.id,
        name: group?.name || group?.title || `Grupo ${group.id}`,
        participants,
        capacity,
        occupation,
        status: norm(group?.status) || "sem_status",
      };
    });

    const occupiedGroups = rows.filter((row) => row.capacity > 0);
    const avgOccupation = safeAvg(
      occupiedGroups.reduce((sum, row) => sum + row.occupation, 0),
      occupiedGroups.length
    );

    return {
      avgOccupation,
      rows: rows.sort((a, b) => b.occupation - a.occupation).slice(0, 6),
    };
  }, [scopedGroups]);

  const contractsKpi = useMemo(() => {
    let pendingSignature = 0;
    let awaitingValidation = 0;
    let rejected = 0;
    let validated = 0;

    scopedFamilies.forEach((family) => {
      const contract = latestContractsByFamily[family.id];
      if (!contract) return;
      const status = norm(contract?.status);
      if (!status || status === "pending_signature") pendingSignature += 1;
      else if (status === "signed_uploaded") awaitingValidation += 1;
      else if (status === "rejected" || status === "refused") rejected += 1;
      else if (status === "validated" || status === "approved") validated += 1;
    });

    return { pendingSignature, awaitingValidation, rejected, validated };
  }, [scopedFamilies, latestContractsByFamily]);

  const docsKpi = useMemo(() => {
    let waiting = 0;
    let sent = 0;
    let approved = 0;
    let rejected = 0;

    scopedFamilies.forEach((family) => {
      const docs = latestDocsByFamily[family.id];
      const status = norm(docs?.status || family?.documents_status);
      if (status === "aprovado") approved += 1;
      else if (status === "enviado") sent += 1;
      else if (status === "reprovado") rejected += 1;
      else waiting += 1;
    });

    return { waiting, sent, approved, rejected };
  }, [scopedFamilies, latestDocsByFamily]);

  const engineeringKpi = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let revision = 0;
    let approved = 0;

    scopedFamilies.forEach((family) => {
      const project = latestEngineeringByFamily[family.id];
      if (!project) return;
      const status = norm(project?.status);
      if (!status || status === "pending" || status === "aguardando") pending += 1;
      else if (status === "in_progress") inProgress += 1;
      else if (status === "revision_requested") revision += 1;
      else if (status === "approved" || status === "completed") approved += 1;
    });

    return { pending, inProgress, revision, approved };
  }, [scopedFamilies, latestEngineeringByFamily]);

  const homologationKpi = useMemo(() => {
    let waiting = 0;
    let pendencia = 0;
    let approved = 0;

    scopedFamilies.forEach((family) => {
      const item = latestHomologationByFamily[family.id];
      if (!item) return;
      const status = norm(item?.status);
      if (!status || status === "pending" || status === "aguardando" || status === "awaiting") waiting += 1;
      else if (status === "pendencia" || status === "pending_docs" || status === "rejected" || status === "refused") pendencia += 1;
      else if (status === "approved" || status === "homologado" || status === "homologated" || status === "completed") approved += 1;
    });

    return { waiting, pendencia, approved };
  }, [scopedFamilies, latestHomologationByFamily]);

  const leadKpi = useMemo(() => {
    const activeLeads = scopedWaitlistLeads.filter((lead) => norm(lead?.status) !== "dropped");
    const qualifiedLeads = activeLeads.filter((lead) => norm(lead?.status) === "qualified" || lead?.preapproved === true);
    const dropped = scopedWaitlistLeads.filter((lead) => norm(lead?.status) === "dropped");
    const conversion = activeLeads.length > 0 ? (scopedFamilies.length / activeLeads.length) * 100 : 0;

    return {
      active: activeLeads.length,
      qualified: qualifiedLeads.length,
      dropped: dropped.length,
      conversion,
    };
  }, [scopedWaitlistLeads, scopedFamilies.length]);

  const executiveCards = useMemo(() => {
    const kitsActive = scopedFamilies.filter((family) => normalizeFamilyStage(family) === "ativo").length;
    const activeFranchises = (franchiseFilter === "all"
      ? franchises
      : franchises.filter((item) => String(item.id) === String(franchiseFilter))
    ).filter((item) => norm(item?.status) === "active").length;
    const capitalInvested = (franchiseFilter === "all"
      ? investors
      : investors.filter((item) => getEntityFranchiseId(item) === franchiseFilter)
    ).reduce((sum, item) => sum + num(item?.total_invested || item?.amount || item?.value), 0);
    const groupsOpen = scopedGroups.filter((group) => norm(group?.status) !== "completed").length;

    return [
      {
        title: "Leads ativas",
        value: intBR(leadKpi.active),
        sub: `${intBR(leadKpi.qualified)} qualificadas • conversão ${pctBR(leadKpi.conversion)}`,
        icon: Users,
        tone: "from-violet-500/10 to-violet-500/0 text-violet-700",
        to: createNavUrl("AdminWaitlist", { franchiseId: franchiseFilter, groupId: groupFilter }),
      },
      {
        title: "Famílias na operação",
        value: intBR(scopedFamilies.length),
        sub: `${intBR(kitsActive)} kits ativos • ${intBR(groupsOpen)} grupos em aberto`,
        icon: Sun,
        tone: "from-amber-500/10 to-amber-500/0 text-amber-700",
        to: createNavUrl("AdminFamilies", { franchiseId: franchiseFilter, groupId: groupFilter }),
      },
      {
        title: "Recebido no período",
        value: moneyBRL(financial.paidTotal),
        sub: `${moneyBRL(financial.receivedThisMonth)} no mês • ticket ${moneyBRL(financial.averageTicket)}`,
        icon: HandCoins,
        tone: "from-emerald-500/10 to-emerald-500/0 text-emerald-700",
        to: createNavUrl("Reports", { tab: "dre", franchiseId: franchiseFilter, groupId: groupFilter }),
      },
      {
        title: "Capital investido",
        value: moneyBRL(capitalInvested),
        sub: `${intBR(investors.length)} investidores • ${intBR(activeFranchises)} franquias ativas`,
        icon: Landmark,
        tone: "from-sky-500/10 to-sky-500/0 text-sky-700",
        to: createNavUrl("Reports", { tab: "balancete", franchiseId: franchiseFilter, groupId: groupFilter }),
      },
    ];
  }, [leadKpi, scopedFamilies, scopedGroups, franchises, investors, franchiseFilter, groupFilter, financial]);

  const alertRows = useMemo(() => {
    const rows = [];

    if (financial.overdueWallet > 0) {
      rows.push({
        title: "Cobrança vencida",
        desc: `${moneyBRL(financial.overdueWallet)} em atraso para ação de cobrança.`,
        tone: "text-rose-700 bg-rose-50 border-rose-200",
        to: createNavUrl("Reports", { tab: "razao", status: "overdue", franchiseId: franchiseFilter, groupId: groupFilter }),
      });
    }

    if (contractsKpi.awaitingValidation > 0) {
      rows.push({
        title: "Contratos aguardando validação",
        desc: `${intBR(contractsKpi.awaitingValidation)} contratos assinados esperando conferência do admin.`,
        tone: "text-amber-700 bg-amber-50 border-amber-200",
        to: createNavUrl("AdminContract", { status: "signed", franchiseId: franchiseFilter, groupId: groupFilter }),
      });
    }

    if (engineeringKpi.revision > 0) {
      rows.push({
        title: "Engenharia com revisão",
        desc: `${intBR(engineeringKpi.revision)} projetos pedindo correção ou ajuste.`,
        tone: "text-orange-700 bg-orange-50 border-orange-200",
        to: createNavUrl("AdminFamilies", { pipeline: "projeto_eletrico", franchiseId: franchiseFilter, groupId: groupFilter }),
      });
    }

    if (homologationKpi.pendencia > 0) {
      rows.push({
        title: "Pendências de homologação",
        desc: `${intBR(homologationKpi.pendencia)} casos com pendência junto à distribuidora.`,
        tone: "text-blue-700 bg-blue-50 border-blue-200",
        to: createNavUrl("AdminFamilies", { pipeline: "homologacao", franchiseId: franchiseFilter, groupId: groupFilter }),
      });
    }

    if (rows.length === 0) {
      rows.push({
        title: "Operação estável",
        desc: "Nenhum alerta crítico identificado nas rotinas principais.",
        tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
        to: createNavUrl("AdminFamilies", { franchiseId: franchiseFilter, groupId: groupFilter }),
      });
    }

    return rows.slice(0, 4);
  }, [financial.overdueWallet, contractsKpi.awaitingValidation, engineeringKpi.revision, homologationKpi.pendencia, franchiseFilter, groupFilter]);

  const cashVsExpenseData = useMemo(() => {
    const months = getLastMonths(chartMonths);
    const paidMap = {};
    months.forEach((month) => {
      paidMap[getMonthKey(month)] = {
        month: monthLabel(month),
        recebido: 0,
        despesa: 0,
      };
    });

    scopedPayments.forEach((payment) => {
      if (getPaymentStatus(payment) !== "paid") return;
      const paidDate = getPaymentPaidDate(payment) || getPaymentDueDate(payment);
      if (!paidDate) return;
      const key = getMonthKey(getMonthStart(paidDate));
      if (!paidMap[key]) return;
      paidMap[key].recebido += getPaymentAmount(payment);
    });

    accounting.monthly.forEach((row, index) => {
      const month = months[index];
      const key = getMonthKey(month);
      if (!paidMap[key]) return;
      paidMap[key].despesa = row.despesa;
    });

    return months.map((month) => paidMap[getMonthKey(month)]);
  }, [scopedPayments, accounting.monthly, chartMonths]);

  const selectedGroupName = useMemo(() => {
    if (groupFilter === "all") return "Todos os grupos";
    const group = groupMap[groupFilter];
    return group?.name || group?.title || `Grupo ${groupFilter}`;
  }, [groupFilter, groupMap]);

  const selectedFranchiseName = useMemo(() => {
    if (franchiseFilter === "all") return "Todas as franquias";
    const franchise = franchiseMap[franchiseFilter];
    return franchise?.name || franchise?.title || `Franquia ${franchiseFilter}`;
  }, [franchiseFilter, franchiseMap]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-3xl border-slate-200">
          <CardContent className="p-8 flex items-center gap-3 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando dashboard executivo...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Executivo</h1>
            <Badge className="bg-emerald-100 text-emerald-700 px-3 py-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 inline-block animate-pulse" />
              Sistema online
            </Badge>
          </div>
          <p className="text-slate-600 mt-1">
            Visão comercial, operacional, financeira e de capacidade do negócio.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-slate-100 text-slate-700 px-3 py-1.5">{selectedFranchiseName}</Badge>
          <Badge className="bg-slate-100 text-slate-700 px-3 py-1.5">{selectedGroupName}</Badge>
          <Badge className="bg-slate-100 text-slate-700 px-3 py-1.5">Período: {periodInfo.label}</Badge>
          <Badge className="bg-slate-100 text-slate-700 px-3 py-1.5">
            Atualizado: {lastLoadedAt ? lastLoadedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
          </Badge>
        </div>
      </div>

      <Card className="rounded-3xl border-slate-200">
        <CardContent className="p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <div className="font-semibold text-slate-900">Filtros executivos</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Período</div>
              <select
                className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Franquia</div>
              <select
                className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                value={franchiseFilter}
                onChange={(e) => setFranchiseFilter(e.target.value)}
              >
                <option value="all">Todas as franquias</option>
                {franchiseOptions.map((franchise) => (
                  <option key={franchise.id} value={franchise.id}>
                    {franchise.name || franchise.title || franchise.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Grupo</div>
              <select
                className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="all">Todos os grupos</option>
                {filteredGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name || group.title || group.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            <div className="text-xs text-slate-500">
              Os filtros recortam a operação por franquia e grupo. O período afeta o financeiro e os eventos datados.
            </div>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                setPeriodFilter("180d");
                setFranchiseFilter("all");
                setGroupFilter("all");
              }}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {executiveCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <Link to={card.to}>
              <Card className="rounded-3xl border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-500">{card.title}</div>
                      <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900 break-words">{card.value}</div>
                      <div className="text-xs text-slate-500 mt-2">{card.sub}</div>
                      <div className="text-xs text-slate-700 mt-3 inline-flex items-center gap-1 font-medium">
                        Abrir módulo <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className={`w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br ${card.tone} flex items-center justify-center`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {alertRows.map((alert) => (
          <Link key={alert.title} to={alert.to}>
            <div className={`rounded-2xl border p-4 ${alert.tone} hover:shadow-sm transition-all h-full`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div>
                  <div className="font-semibold">{alert.title}</div>
                  <div className="text-sm opacity-90 mt-1">{alert.desc}</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-slate-200 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              Recebido x despesas contábeis ({chartMonths} meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <MiniAreaCompareChart
              data={cashVsExpenseData}
              xKey="month"
              valueFormatter={moneyBRL}
              series={[
                { key: "recebido", label: "Recebido", color: "#16a34a", fillOpacity: 0.18 },
                { key: "despesa", label: "Despesa", color: "#dc2626", fillOpacity: 0.12 },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-slate-500" />
              Cobrança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[220px]">
              <MiniDonutChart
                data={billingStatusData}
                labelKey="name"
                valueKey="value"
                centerLabel="Cobranças"
                centerValue={billingStatusData.reduce((sum, item) => sum + num(item.value), 0)}
                valueFormatter={intBR}
                showLegend={false}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <MiniMetric label="Em aberto" value={moneyBRL(financial.receivables)} icon={TrendingDown} tone="text-rose-700" />
              <MiniMetric label="Em atraso" value={moneyBRL(financial.overdueWallet)} icon={AlertTriangle} tone="text-orange-700" />
              <MiniMetric label="Ticket médio" value={moneyBRL(financial.averageTicket)} icon={TrendingUp} tone="text-emerald-700" />
              <MiniMetric label="Eficiência" value={pctBR(financial.collectionEfficiency)} icon={ClipboardCheck} tone="text-sky-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-slate-200 xl:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-slate-500" />
              Funil operacional das famílias
            </CardTitle>
            <Link to={createNavUrl("AdminFamilies", { franchiseId: franchiseFilter, groupId: groupFilter })}>
              <Button variant="outline" className="rounded-2xl">Abrir famílias</Button>
            </Link>
          </CardHeader>
          <CardContent className="h-[320px]">
            <MiniBarChart
              data={stageData}
              labelKey="label"
              valueKey="value"
              color="#0f172a"
              valueFormatter={intBR}
            />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              Status dos grupos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[220px]">
              <MiniDonutChart
                data={groupStatusData}
                labelKey="name"
                valueKey="value"
                centerLabel="Grupos"
                centerValue={groupStatusData.reduce((sum, item) => sum + num(item.value), 0)}
                valueFormatter={intBR}
                showLegend={false}
              />
            </div>
            <div className="space-y-2 text-sm">
              {groupStatusData.length === 0 ? (
                <div className="text-slate-500">Sem grupos cadastrados neste recorte.</div>
              ) : (
                groupStatusData.map((item) => (
                  <Link key={item.name} to={item.to} className="block">
                    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50 transition-all">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                        <span className="truncate text-slate-700 capitalize">{item.name}</span>
                      </div>
                      <span className="font-medium text-slate-900">{intBR(item.value)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle>KPIs operacionais críticos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KpiBlock
              title="Documentação"
              rows={[
                ["Aguardando", docsKpi.waiting, createNavUrl("AdminFamilies", { pipeline: "cadastro", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Enviado", docsKpi.sent, createNavUrl("AdminFamilies", { pipeline: "cadastro", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Aprovado", docsKpi.approved, createNavUrl("AdminFamilies", { pipeline: "grupo", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Reprovado", docsKpi.rejected, createNavUrl("AdminFamilies", { pipeline: "cadastro", franchiseId: franchiseFilter, groupId: groupFilter })],
              ]}
              icon={ShieldCheck}
            />
            <KpiBlock
              title="Contratos"
              rows={[
                ["Pendente assinatura", contractsKpi.pendingSignature, createNavUrl("AdminContract", { status: "pending", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Aguardando validação", contractsKpi.awaitingValidation, createNavUrl("AdminContract", { status: "signed", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Validados", contractsKpi.validated, createNavUrl("AdminContract", { status: "validated", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Recusados", contractsKpi.rejected, createNavUrl("AdminContract", { status: "rejected", franchiseId: franchiseFilter, groupId: groupFilter })],
              ]}
              icon={FileSignature}
            />
            <KpiBlock
              title="Engenharia"
              rows={[
                ["Na fila", engineeringKpi.pending, createNavUrl("AdminFamilies", { pipeline: "projeto_eletrico", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Em andamento", engineeringKpi.inProgress, createNavUrl("AdminFamilies", { pipeline: "projeto_eletrico", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Revisão", engineeringKpi.revision, createNavUrl("AdminFamilies", { pipeline: "projeto_eletrico", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Aprovado", engineeringKpi.approved, createNavUrl("AdminFamilies", { pipeline: "instalacao", franchiseId: franchiseFilter, groupId: groupFilter })],
              ]}
              icon={Wrench}
            />
            <KpiBlock
              title="Instalação e homologação"
              rows={[
                ["Visitas agendadas", jobsSummary.visitsScheduled, createNavUrl("AdminFamilies", { pipeline: "instalacao", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Instalações em andamento", jobsSummary.installsInProgress, createNavUrl("AdminFamilies", { pipeline: "instalacao", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Homologação aguardando", homologationKpi.waiting, createNavUrl("AdminFamilies", { pipeline: "homologacao", franchiseId: franchiseFilter, groupId: groupFilter })],
                ["Homologação com pendência", homologationKpi.pendencia, createNavUrl("AdminFamilies", { pipeline: "homologacao", franchiseId: franchiseFilter, groupId: groupFilter })],
              ]}
              icon={Sun}
            />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle>Capacidade dos grupos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Ocupação média</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{pctBR(groupCapacity.avgOccupation)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Grupos monitorados</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{intBR(scopedGroups.length)}</div>
              </div>
            </div>

            <div className="space-y-3">
              {groupCapacity.rows.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum grupo com capacidade configurada neste recorte.</div>
              ) : (
                groupCapacity.rows.map((row) => (
                  <Link key={row.id} to={createNavUrl("AdminGroups", { groupId: row.id, franchiseId: franchiseFilter })} className="block">
                    <div className="space-y-1 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50 transition-all">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="font-medium text-slate-800 truncate">{row.name}</div>
                        <div className="text-slate-500">
                          {row.participants}/{row.capacity || "—"}
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{ width: `${Math.min(100, row.occupation)}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 capitalize">{pctBR(row.occupation)} • {row.status.replace(/_/g, " ")}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Quick to={createNavUrl("AdminFamilies", { franchiseId: franchiseFilter, groupId: groupFilter })} icon={Users} label="Famílias" desc="Pipeline, documentação e cobrança por família" />
        <Quick to={createNavUrl("AdminGroups", { franchiseId: franchiseFilter, groupId: groupFilter })} icon={Building2} label="Grupos" desc="Captação, capacidade e andamento dos grupos" />
        <Quick to={createNavUrl("AdminContract", { franchiseId: franchiseFilter, groupId: groupFilter })} icon={FileSignature} label="Contratos" desc="Validação, versões e reenvio" />
        <Quick to={createNavUrl("Reports", { franchiseId: franchiseFilter, groupId: groupFilter })} icon={BarChart3} label="Relatórios" desc="Balancete, razão e DRE" />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon, tone = "text-slate-700" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone}`} />
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function KpiBlock({ title, rows, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-700" />
        </div>
        <div className="font-semibold text-slate-900">{title}</div>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value, to]) => (
          <Link key={label} to={to || "#"} className="block">
            <div className="flex items-center justify-between gap-3 text-sm rounded-xl px-2 py-1.5 hover:bg-slate-50 transition-all">
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold text-slate-900">{intBR(value)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Quick({ to, icon: Icon, label, desc }) {
  return (
    <Link to={to}>
      <Card className="rounded-3xl border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

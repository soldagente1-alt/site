import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Calendar,
  Mail,
  MessageCircle,
  Copy,
  MoreVertical,
  Loader2,
  Lock,
  Plus,
  Pencil,
  Trash2,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";

import { toast } from "sonner";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";

const PROJECT_ID = "soldagente-30f00";

function getFunctionsBase() {
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (isLocal) {
    return `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
  }
  return `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;
}

async function callFunction(path, body) {
  const base = getFunctionsBase();
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : "";

  const resp = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.ok === false) {
    const msg = data?.error || data?.message || "Erro ao chamar Function";
    throw new Error(msg);
  }
  return data;
}

function fmtDateAny(v) {
  if (!v) return "—";
  if (v?.seconds) return new Date(v.seconds * 1000).toLocaleString("pt-BR");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
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

function moneyBRL(v) {
  const n = parseMoneyToNumber(v) ?? 0;
  return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPlanMonthlyFromPlanDoc(planDoc) {
  if (!planDoc) return null;
  const candidates = [
    planDoc?.monthly_payment,
    planDoc?.monthly_price,
    planDoc?.monthly_value,
    planDoc?.price_monthly,
    planDoc?.value_monthly,
    planDoc?.amount_monthly,
    planDoc?.price,
    planDoc?.value,
    planDoc?.mensalidade,
  ];
  for (const c of candidates) {
    const n = parseMoneyToNumber(c);
    if (n !== null && n > 0) return n;
  }
  return null;
}

function getPlanLabel(plan) {
  if (!plan) return "—";
  const name = String(plan?.name || plan?.title || plan?.label || "").trim();
  const price = getPlanMonthlyFromPlanDoc(plan);
  const base = name || String(plan?.id || "Plano");
  return price ? `${base} — R$ ${moneyBRL(price)}` : base;
}

const groupStatusConfig = {
  forming: { label: "Formando", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  fundraising: { label: "Captação", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  ready: { label: "Pronto", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  closed: { label: "Ativado", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: AlertCircle },
};
const groupStatusFallback = { label: "—", color: "bg-slate-100 text-slate-700", icon: Clock };
const GROUP_STATUS_VALUES = ["forming", "fundraising", "ready", "closed", "completed", "cancelled"];
const FAMILY_PLANS_COL = "Familyplans";

function getGroupCapacity(g) {
  const raw = Number(g?.max_participants || g?.max_families || g?.capacity || g?.target_families || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 40;
}

function getOverbookPct(g) {
  const raw = Number(g?.overbook_pct ?? 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function computeQueueLimit(capacity, pct) {
  const extra = Math.ceil(capacity * pct);
  return capacity + extra;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getGroupFranchiseId(g) {
  const raw = g?.franchise_id || g?.franchiseId || g?.franchiseID || "";
  const s = String(raw || "").trim();
  return s || null;
}

function getGroupFranchiseLabel(g) {
  const fid = getGroupFranchiseId(g);
  return fid || "Sem franquia";
}

function onlyDigits(v = "") {
  return String(v || "").replace(/\D+/g, "");
}

function normalizePhoneForWhatsApp(raw) {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

function buildWhatsAppLink(phoneRaw, message) {
  const phone = normalizePhoneForWhatsApp(phoneRaw);
  if (!phone) return "";
  const text = encodeURIComponent(message || "");
  return `https://wa.me/${phone}?text=${text}`;
}

function buildMailtoLink(email, subject, body) {
  const to = encodeURIComponent(String(email || ""));
  const s = encodeURIComponent(String(subject || ""));
  const b = encodeURIComponent(String(body || ""));
  return `mailto:${to}?subject=${s}&body=${b}`;
}

function firstName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] || s;
}

function applyTemplate(tpl, vars) {
  let out = String(tpl || "");
  Object.entries(vars || {}).forEach(([k, v]) => {
    const token = `{{${k}}}`;
    out = out.split(token).join(String(v ?? ""));
  });
  return out;
}

const DEFAULT_NOTIFY_SUBJECT = "Sol da Gente — Vaga aberta no grupo {{group_name}}";
const DEFAULT_NOTIFY_MESSAGE_TPL =
  "Olá {{first_name}}!\n\n" +
  "Abrimos um novo grupo ({{group_name}}) e você estava na nossa fila de espera.\n\n" +
  "✅ Para continuar sua inscrição, acesse seu link: {{preapprove_link}}\n\n" +
  'Se preferir, responda esta mensagem com "QUERO" e nós seguimos por aqui.\n\n' +
  "Equipe Sol da Gente";

export default function AdminGroups() {
  const [searchParams] = useSearchParams();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [franchiseFilter, setFranchiseFilter] = useState("all");
  const [groupIdFilter, setGroupIdFilter] = useState("");

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [closing, setClosing] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queuePctStr, setQueuePctStr] = useState("0.1");
  const [savingQueue, setSavingQueue] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("create");
  const [savingEditor, setSavingEditor] = useState(false);
  const [editorForm, setEditorForm] = useState({
    name: "",
    city: "",
    state: "BA",
    status: "forming",
    plan_id: "",
    max_participants: 40,
    overbook_pct: 0.1,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");

  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagGroup, setDiagGroup] = useState(null);
  const [diagFamilies, setDiagFamilies] = useState([]);
  const [diagOrphanLeads, setDiagOrphanLeads] = useState([]);
  const [diagSummary, setDiagSummary] = useState(null);

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyGroup, setNotifyGroup] = useState(null);
  const [notifyLeads, setNotifyLeads] = useState([]);
  const [notifySubject, setNotifySubject] = useState(DEFAULT_NOTIFY_SUBJECT);
  const [notifyMessageTpl, setNotifyMessageTpl] = useState(DEFAULT_NOTIFY_MESSAGE_TPL);
  const [markingNotified, setMarkingNotified] = useState(false);

  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    let nextSearch = String(searchParams.get("q") || searchParams.get("search") || "").trim();
    const nextStatusRaw = String(
      searchParams.get("status") ||
        searchParams.get("groupStatus") ||
        searchParams.get("group_status") ||
        ""
    )
      .trim()
      .toLowerCase();

    const nextGroupId = String(
      searchParams.get("groupId") || searchParams.get("group") || searchParams.get("gid") || ""
    ).trim();

    const nextFranchiseId = String(
      searchParams.get("franchiseId") || searchParams.get("franchise") || searchParams.get("fid") || ""
    ).trim();

    if (!nextSearch && nextGroupId) nextSearch = nextGroupId;

    setSearch(nextSearch);
    setStatusFilter(GROUP_STATUS_VALUES.includes(nextStatusRaw) ? nextStatusRaw : "all");
    setFranchiseFilter(nextFranchiseId || "all");
    setGroupIdFilter(nextGroupId || "");
  }, [searchParamsKey]);

  useEffect(() => {
    const qy = query(collection(db, "Group"), orderBy("created_date", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGroups(data);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao carregar grupos:", err);
        toast.error("Erro ao carregar grupos");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const qy = query(collection(db, FAMILY_PLANS_COL), limit(200));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPlans(list);
        setPlansLoading(false);
      },
      async (err) => {
        console.warn("Erro ao carregar planos (fallback getDocs):", err);
        try {
          const snap = await getDocs(query(collection(db, FAMILY_PLANS_COL), limit(200)));
          setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.warn("Fallback planos falhou:", e);
          setPlans([]);
        } finally {
          setPlansLoading(false);
        }
      }
    );

    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, []);

  const franchiseOptions = useMemo(() => {
    const map = new Map();
    (groups || []).forEach((g) => {
      const fid = getGroupFranchiseId(g);
      if (!fid) return;
      if (!map.has(fid)) {
        map.set(fid, { value: fid, label: fid });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [groups]);

  const focusedGroup = useMemo(() => {
    if (!groupIdFilter) return null;
    return groups.find((g) => String(g.id) === String(groupIdFilter)) || null;
  }, [groups, groupIdFilter]);

  const filteredGroups = useMemo(() => {
    const s = (search || "").trim().toLowerCase();

    return (groups || []).filter((g) => {
      const matchesStatus = statusFilter === "all" || String(g.status || "") === statusFilter;
      const franchiseId = getGroupFranchiseId(g);
      const matchesFranchise = franchiseFilter === "all" || String(franchiseId || "") === String(franchiseFilter);
      const matchesGroupId = !groupIdFilter || String(g.id) === String(groupIdFilter);

      const hay = [
        g.name,
        g.city,
        g.state,
        g.franchise_id,
        g.franchiseId,
        g.id,
        g.plan_name,
        g.plan_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !s || hay.includes(s);
      return matchesStatus && matchesSearch && matchesFranchise && matchesGroupId;
    });
  }, [groups, search, statusFilter, franchiseFilter, groupIdFilter]);

  const stats = useMemo(() => {
    const total = groups.length;
    const forming = groups.filter((g) => String(g.status || "") === "forming").length;
    const closed = groups.filter((g) => ["closed", "completed"].includes(String(g.status || ""))).length;
    const full = groups.filter((g) => {
      const cap = getGroupCapacity(g);
      const cur = num(g.current_participants, 0);
      return cap > 0 && cur >= cap;
    }).length;
    return { total, forming, closed, full };
  }, [groups]);

  function patchGroupInState(groupId, patch) {
    setGroups((prev) =>
      (prev || []).map((g) => (String(g.id) === String(groupId) ? { ...g, ...patch } : g))
    );
    setSelectedGroup((prev) =>
      prev && String(prev.id) === String(groupId) ? { ...prev, ...patch } : prev
    );
  }

  function canActivateGroup(g) {
    const statusOk = String(g?.status || "") === "forming";
    const locked = g?.waitlist_locked === true;
    const cap = getGroupCapacity(g);
    const cur = num(g?.current_participants, 0);
    return statusOk && !locked && cap > 0 && cur >= cap;
  }

  async function reconcileCurrentParticipants(g, { silent = false } = {}) {
    try {
      const groupId = g?.id ? String(g.id) : null;
      if (!groupId) return null;

      const data = await callFunction("adminGroupRecountParticipants", { groupId });
      patchGroupInState(groupId, {
        current_participants: Number(data?.approvedCount || 0),
        current_participants_source: "docs_approved",
      });

      if (!silent) {
        toast.message(
          `Recontagem: ${Number(data?.approvedCount || 0)}/${Number(data?.capacity || getGroupCapacity(g))} titulares com documentação aprovada.`
        );
      }

      return Number(data?.approvedCount || 0);
    } catch (e) {
      console.error(e);
      if (!silent) toast.error(e?.message || "Não consegui recontar titulares.");
      return null;
    }
  }

  async function openCloseModal(g) {
    setSelectedGroup(g);
    setCloseModalOpen(true);
    try {
      await reconcileCurrentParticipants(g, { silent: true });
    } catch (_) {}
  }

  async function diagnoseTitulares(g) {
    if (!g?.id) return;

    setDiagGroup(g);
    setDiagOpen(true);
    setDiagLoading(true);
    setDiagFamilies([]);
    setDiagOrphanLeads([]);
    setDiagSummary(null);

    try {
      const data = await callFunction("adminGroupDiagnoseTitulares", { groupId: String(g.id) });
      setDiagGroup(data?.group || g);
      setDiagFamilies(Array.isArray(data?.families) ? data.families : []);
      setDiagOrphanLeads(Array.isArray(data?.orphanLeads) ? data.orphanLeads : []);
      setDiagSummary(data?.summary || null);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar diagnóstico.");
      setDiagFamilies([]);
      setDiagOrphanLeads([]);
      setDiagSummary(null);
    } finally {
      setDiagLoading(false);
    }
  }

  function openQueueModal(g) {
    setSelectedGroup(g);
    setQueuePctStr(String(getOverbookPct(g)));
    setQueueModalOpen(true);
  }

  function openCreateModal() {
    setEditorMode("create");
    setSelectedGroup(null);
    setEditorForm({
      name: "",
      city: "",
      state: "BA",
      status: "forming",
      plan_id: plans && plans.length ? String(plans[0].id) : "",
      max_participants: 40,
      overbook_pct: 0.1,
    });
    setEditorOpen(true);
  }

  function openEditModal(g) {
    setEditorMode("edit");
    setSelectedGroup(g);
    setEditorForm({
      name: String(g?.name || ""),
      city: String(g?.city || ""),
      state: String(g?.state || "BA"),
      status: String(g?.status || "forming"),
      plan_id: String(g?.plan_id || g?.planId || ""),
      max_participants: getGroupCapacity(g),
      overbook_pct: getOverbookPct(g),
    });
    setEditorOpen(true);
  }

  function openDeleteModal(g) {
    setSelectedGroup(g);
    setDeletePhrase("");
    setDeleteOpen(true);
  }

  async function handleActivateGroup() {
    if (!selectedGroup?.id) return;
    setClosing(true);

    try {
      const data = await callFunction("adminGroupActivate", { groupId: String(selectedGroup.id) });
      patchGroupInState(selectedGroup.id, {
        status: "closed",
        admin_locked: true,
        waitlist_locked: false,
        current_participants: Number(data?.titulares || selectedGroup?.current_participants || 0),
      });
      toast.success(data?.message || "Grupo ativado com sucesso.");
      setCloseModalOpen(false);
      setSelectedGroup(null);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Falha ao ativar grupo");
    } finally {
      setClosing(false);
    }
  }

  async function handleSaveEditor() {
    const name = String(editorForm.name || "").trim();
    const city = String(editorForm.city || "").trim();
    const state = String(editorForm.state || "").trim().toUpperCase();
    const cap = Math.max(1, Math.floor(Number(editorForm.max_participants || 40)));
    const pct = Number(editorForm.overbook_pct || 0);
    const overbook_pct = Number.isFinite(pct) && pct >= 0 ? pct : 0;
    const status = String(editorForm.status || "forming");
    const plan_id = String(editorForm.plan_id || "").trim();

    if (name.length < 3) return toast.error("Informe um nome de grupo.");
    if (!plan_id) return toast.error("Selecione um plano de pagamento.");

    setSavingEditor(true);
    try {
      const data = await callFunction("adminGroupSave", {
        mode: editorMode,
        groupId: selectedGroup?.id || null,
        name,
        city,
        state,
        status,
        plan_id,
        max_participants: cap,
        overbook_pct,
      });

      if (editorMode === "create") {
        toast.success("Grupo criado.");
        const notifyCandidates = Array.isArray(data?.notifyCandidates) ? data.notifyCandidates : [];
        if (notifyCandidates.length > 0) {
          toast.success(`Fila preenchida: ${Number(data?.seeded || notifyCandidates.length)}/${Number(data?.queueLimit || 0)}.`);
          setNotifyGroup({ id: data?.id, name, city: city || "", state: state || "" });
          setNotifyLeads(notifyCandidates);
          setNotifySubject(DEFAULT_NOTIFY_SUBJECT);
          setNotifyMessageTpl(DEFAULT_NOTIFY_MESSAGE_TPL);
          setNotifyOpen(true);
        } else if (Number(data?.seeded || 0) === 0) {
          toast.message("Nenhuma pessoa na fila geral para puxar (por enquanto). Grupo liberado para inscrições.");
        }
      } else {
        toast.success("Grupo atualizado.");
      }

      setEditorOpen(false);
      setSelectedGroup(null);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível salvar o grupo.");
    } finally {
      setSavingEditor(false);
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup?.id) return;
    const phraseOk = String(deletePhrase || "").trim().toUpperCase() === "EXCLUIR";
    if (!phraseOk) return toast.error('Digite "EXCLUIR" para confirmar.');

    setDeleting(true);
    try {
      await callFunction("adminGroupDelete", {
        groupId: String(selectedGroup.id),
        confirmPhrase: deletePhrase,
      });
      toast.success("Grupo excluído.");
      setDeleteOpen(false);
      setSelectedGroup(null);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível excluir o grupo.");
    } finally {
      setDeleting(false);
    }
  }

  async function copyToClipboard(text, okMsg = "Copiado!") {
    const str = String(text || "");
    if (!str) return toast.message("Nada para copiar.");
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(str);
        toast.success(okMsg);
        return;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = str;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success(okMsg);
    } catch {
      toast.message("Não consegui copiar automaticamente.");
    }
  }

  function leadVars(lead) {
    return {
      first_name: firstName(lead?.full_name || lead?.name || ""),
      full_name: String(lead?.full_name || lead?.name || "").trim(),
      group_name: String(notifyGroup?.name || "").trim(),
      group_city: String(notifyGroup?.city || "").trim(),
      group_state: String(notifyGroup?.state || "").trim(),
      preapprove_link: String(lead?.preapprove_link || "").trim() || `${window.location.origin}/waitlist`,
    };
  }

  function buildLeadMessage(lead) {
    return applyTemplate(notifyMessageTpl, leadVars(lead));
  }

  function buildLeadSubject(lead) {
    return applyTemplate(notifySubject, leadVars(lead));
  }

  async function markAllAsNotified() {
    if (!notifyGroup?.id || !notifyLeads?.length) return;
    setMarkingNotified(true);
    try {
      const data = await callFunction("adminGroupMarkLeadsNotified", {
        groupId: notifyGroup.id,
        leadIds: notifyLeads.map((l) => l.id).filter(Boolean),
        template: String(notifyMessageTpl || "").slice(0, 2000),
      });
      toast.success(`Marcados como notificados${data?.updated ? ` (${data.updated})` : ""}.`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não consegui marcar como notificados.");
    } finally {
      setMarkingNotified(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-600 flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando grupos…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grupos</h1>
          <p className="text-slate-600">
            Administre grupos, overbooking (+%) e ativação (janela 48h para contrato/pagamento).
          </p>
        </div>

        <Button className="bg-amber-500 hover:bg-amber-600" onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Criar grupo
        </Button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Total</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-500" />
            <div>
              <div className="text-sm text-yellow-600">Formando</div>
              <div className="text-2xl font-bold text-yellow-700">{stats.forming}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-sm text-green-600">Ativados/Concluídos</div>
              <div className="text-2xl font-bold text-green-700">{stats.closed}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-slate-600" />
            <div>
              <div className="text-sm text-slate-600">Fila ≥ Capacidade</div>
              <div className="text-2xl font-bold text-slate-900">{stats.full}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, cidade, UF, franquia, plano ou ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-56">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="forming">Formando</SelectItem>
                <SelectItem value="fundraising">Captação</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="closed">Ativado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={franchiseFilter} onValueChange={setFranchiseFilter}>
              <SelectTrigger className="w-full lg:w-64">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar franquia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as franquias</SelectItem>
                {franchiseOptions.map((fr) => (
                  <SelectItem key={fr.value} value={fr.value}>
                    {fr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(groupIdFilter || franchiseFilter !== "all" || statusFilter !== "all") ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {groupIdFilter ? (
                <Badge className="bg-amber-100 text-amber-800">
                  Contexto grupo: {focusedGroup?.name || groupIdFilter}
                </Badge>
              ) : null}
              {franchiseFilter !== "all" ? (
                <Badge className="bg-slate-100 text-slate-700">Franquia: {franchiseFilter}</Badge>
              ) : null}
              {statusFilter !== "all" ? (
                <Badge className="bg-slate-100 text-slate-700">
                  Status: {groupStatusConfig[statusFilter]?.label || statusFilter}
                </Badge>
              ) : null}

              {(groupIdFilter || franchiseFilter !== "all" || statusFilter !== "all" || search) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setFranchiseFilter("all");
                    setGroupIdFilter("");
                  }}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Limpar filtros locais
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="text-xs text-slate-500">
            Exibindo <span className="font-medium">{filteredGroups.length}</span> de{" "}
            <span className="font-medium">{groups.length}</span> grupos
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Grupo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Local</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Capacidade</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Fila (cap+%)</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Criado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Ativado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
                </tr>
              </thead>

              <tbody>
                {filteredGroups.map((g) => {
                  const cap = getGroupCapacity(g);
                  const pct = getOverbookPct(g);
                  const queueLimit = computeQueueLimit(cap, pct);
                  const qCount = Math.max(0, num(g.waitlist_count, 0));

                  const cur = Math.max(0, num(g.current_participants, 0));
                  const max = Math.max(0, num(g.max_participants, cap));

                  const queueFull = queueLimit > 0 && qCount >= queueLimit;
                  const primaryFull = cap > 0 && qCount >= cap;

                  const s = groupStatusConfig[String(g.status || "")] || groupStatusFallback;
                  const Icon = s.icon;

                  const actionsLocked = ["closed", "completed"].includes(String(g.status || "")) || g?.admin_locked === true;
                  const isFocusedRow = groupIdFilter && String(g.id) === String(groupIdFilter);

                  return (
                    <tr key={g.id} className={`border-b hover:bg-slate-50 ${isFocusedRow ? "bg-amber-50" : ""}`}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{g.name || "—"}</div>
                        <div className="text-xs text-slate-500 font-mono">{g.id}</div>
                        <div className="text-xs text-slate-500">
                          Franquia: <span className="font-medium">{getGroupFranchiseLabel(g)}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Plano: <span className="font-medium">{g.plan_name || g.plan_title || g.plan_id || "—"}</span>
                          {g.plan_monthly_price ? ` • R$ ${moneyBRL(g.plan_monthly_price)}` : ""}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span>
                            {g.city || "—"} {g.state ? `• ${g.state}` : ""}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-800">{cur}/{max || cap}</span>
                        </div>
                        <div className="text-xs text-slate-500">Titulares: {cap}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={queueFull ? "bg-red-100 text-red-700" : primaryFull ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}>
                            {qCount}/{queueLimit}
                          </Badge>
                          <Badge className="bg-slate-100 text-slate-700">+{Math.round(pct * 100)}%</Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {primaryFull ? "Titulares completos" : `Faltam ${Math.max(0, cap - qCount)} p/ titulares`}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <Badge className={s.color}>
                          <Icon className="w-3 h-3 mr-1" />
                          {s.label}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          {fmtDateAny(g.created_date)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-sm text-slate-600">
                        {g.activated_at ? fmtDateAny(g.activated_at) : "—"}
                      </td>

                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={actionsLocked}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openQueueModal(g)}>
                              <SlidersHorizontal className="w-4 h-4 mr-2" />
                              Configurar fila (+%)
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => openEditModal(g)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar grupo
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={async () => { await diagnoseTitulares(g); }}>
                              <Users className="w-4 h-4 mr-2" />
                              Diagnosticar titulares (aprovados x não)
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={async () => { await reconcileCurrentParticipants(g); }}>
                              <Users className="w-4 h-4 mr-2" />
                              Recontar titulares (atualiza número)
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => openCloseModal(g)}>
                              <Lock className="w-4 h-4 mr-2" />
                              Ativar grupo (48h)
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => openDeleteModal(g)} className="text-red-700 focus:text-red-700">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>

                            {!canActivateGroup(g) ? (
                              <div className="px-3 py-2 text-xs text-slate-500">
                                Ativa quando a fila atingir a capacidade de titulares.
                              </div>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}

                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      Nenhum grupo encontrado
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={queueModalOpen} onOpenChange={setQueueModalOpen}>
        <DialogContent className="max-w-xl w-[96vw]">
          <DialogHeader>
            <DialogTitle>Configurar fila do grupo</DialogTitle>
          </DialogHeader>

          {!selectedGroup ? (
            <div className="text-sm text-slate-600">Selecione um grupo.</div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border rounded-xl">
                <p className="font-semibold text-slate-900">{selectedGroup.name || "Grupo"}</p>
                <p className="text-sm text-slate-600 mt-1">
                  Capacidade (titulares): <strong>{getGroupCapacity(selectedGroup)}</strong>
                </p>
                <p className="text-sm text-slate-600">
                  Inscritas na fila: <strong>{num(selectedGroup.waitlist_count, 0)}</strong>
                </p>
              </div>

              <div>
                <Label>Lista de espera (+%)</Label>
                <Select value={queuePctStr} onValueChange={(v) => setQueuePctStr(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="0.05">5%</SelectItem>
                    <SelectItem value="0.1">10%</SelectItem>
                    <SelectItem value="0.2">20%</SelectItem>
                    <SelectItem value="0.25">25%</SelectItem>
                    <SelectItem value="0.3">30%</SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-xs text-slate-500 mt-2">
                  Limite total da fila: {computeQueueLimit(getGroupCapacity(selectedGroup), Number(queuePctStr || 0))} pessoas.
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setQueueModalOpen(false)} disabled={savingQueue}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              disabled={!selectedGroup || savingQueue}
              onClick={async () => {
                if (!selectedGroup?.id) return;
                setSavingQueue(true);
                try {
                  const pct = Number(queuePctStr || 0);
                  await callFunction("adminGroupUpdateQueue", {
                    groupId: String(selectedGroup.id),
                    overbook_pct: Number.isFinite(pct) && pct >= 0 ? pct : 0,
                  });
                  patchGroupInState(selectedGroup.id, {
                    overbook_pct: Number.isFinite(pct) && pct >= 0 ? pct : 0,
                  });
                  toast.success("Fila atualizada.");
                  setQueueModalOpen(false);
                } catch (e) {
                  console.error(e);
                  toast.error(e?.message || "Não foi possível atualizar a fila.");
                } finally {
                  setSavingQueue(false);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl w-[96vw]">
          <DialogHeader>
            <DialogTitle>{editorMode === "create" ? "Criar grupo" : "Editar grupo"}</DialogTitle>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome do grupo</Label>
              <Input
                value={editorForm.name}
                onChange={(e) => setEditorForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Grupo Feira 01"
              />
            </div>

            <div>
              <Label>Cidade</Label>
              <Input
                value={editorForm.city}
                onChange={(e) => setEditorForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="Ex.: Feira de Santana"
              />
            </div>

            <div>
              <Label>UF</Label>
              <Input
                value={editorForm.state}
                onChange={(e) => setEditorForm((p) => ({ ...p, state: e.target.value }))}
                placeholder="BA"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={String(editorForm.status)} onValueChange={(v) => setEditorForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forming">Formando</SelectItem>
                  <SelectItem value="fundraising">Captação</SelectItem>
                  <SelectItem value="ready">Pronto</SelectItem>
                  <SelectItem value="closed">Ativado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label>Plano de pagamento</Label>
              <Select value={String(editorForm.plan_id || "")} onValueChange={(v) => setEditorForm((p) => ({ ...p, plan_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={plansLoading ? "Carregando planos..." : "Selecione um plano"} />
                </SelectTrigger>
                <SelectContent>
                  {(plans || []).map((pl) => (
                    <SelectItem key={pl.id} value={String(pl.id)}>
                      {getPlanLabel(pl)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-slate-500 mt-2">
                Este plano define a <b>mensalidade</b> e deve ser preenchido para o grupo.
              </div>
            </div>

            <div>
              <Label>Capacidade (titulares)</Label>
              <Input
                type="number"
                value={String(editorForm.max_participants)}
                onChange={(e) => setEditorForm((p) => ({ ...p, max_participants: e.target.value }))}
                placeholder="40"
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Lista de espera (+%)</Label>
              <Select value={String(editorForm.overbook_pct)} onValueChange={(v) => setEditorForm((p) => ({ ...p, overbook_pct: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="0.1">10%</SelectItem>
                  <SelectItem value="0.2">20%</SelectItem>
                  <SelectItem value="0.25">25%</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-xs text-slate-500 mt-2">
                Limite total de inscrições na fila do grupo: {computeQueueLimit(Math.max(1, Math.floor(Number(editorForm.max_participants || 40))), Number(editorForm.overbook_pct || 0))}.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={savingEditor}>
              Cancelar
            </Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleSaveEditor} disabled={savingEditor}>
              {savingEditor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
        <DialogContent className="max-w-xl w-[96vw]">
          <DialogHeader>
            <DialogTitle>Ativar grupo (janela 48h)</DialogTitle>
          </DialogHeader>

          {selectedGroup ? (
            <div className="space-y-3">
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">{selectedGroup.name || "—"}</div>
                <div className="text-xs text-slate-500 font-mono">{selectedGroup.id}</div>

                <div className="mt-2 text-sm text-slate-700">
                  Capacidade (titulares): <span className="font-semibold">{getGroupCapacity(selectedGroup)}</span>
                  <div className="mt-1 text-sm text-slate-700">
                    Titulares aprovados:{" "}
                    <span className="font-semibold">
                      {Math.max(0, num(selectedGroup.current_participants, 0))}/{getGroupCapacity(selectedGroup)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Plano do grupo:{" "}
                    <span className="font-semibold">{selectedGroup.plan_name || selectedGroup.plan_id || "—"}</span>
                    {selectedGroup.plan_monthly_price ? ` • R$ ${moneyBRL(selectedGroup.plan_monthly_price)}` : ""}
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Inscritos na fila: <span className="font-semibold">{num(selectedGroup.waitlist_count, 0)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Limite total (cap+%): <span className="font-semibold">{computeQueueLimit(getGroupCapacity(selectedGroup), getOverbookPct(selectedGroup))}</span>
                </div>
              </div>

              <div className="text-sm text-slate-600">
                Ao ativar, o sistema irá:
                <ul className="list-disc ml-5 mt-2">
                  <li>Marcar o grupo como <b>closed</b> (ativado)</li>
                  <li>Iniciar a janela de <b>48h</b> para titulares assinarem e pagarem</li>
                  <li>(Opcional) Garantir parcelas via <b>ensurePaymentsForGroup</b></li>
                </ul>
              </div>

              {!canActivateGroup(selectedGroup) ? (
                <div className="rounded-lg border bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Atenção: só é possível ativar quando a fila tiver pelo menos a capacidade de titulares.
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModalOpen(false)} disabled={closing}>
              Cancelar
            </Button>

            <Button variant="outline" onClick={() => selectedGroup && diagnoseTitulares(selectedGroup)} disabled={!selectedGroup || diagLoading} title="Apenas leitura (não altera nada)">
              {diagLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
              Diagnosticar titulares
            </Button>
            <Button className="bg-slate-900 hover:bg-slate-800" onClick={handleActivateGroup} disabled={!selectedGroup || !canActivateGroup(selectedGroup) || closing}>
              {closing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Ativar grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
        <DialogContent className="max-w-5xl w-[96vw]">
          <DialogHeader>
            <DialogTitle>Diagnóstico: titulares aprovados</DialogTitle>
          </DialogHeader>

          {!diagGroup ? (
            <div className="text-sm text-slate-600">Selecione um grupo.</div>
          ) : diagLoading ? (
            <div className="text-sm text-slate-600 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Calculando…
            </div>
          ) : !diagSummary ? (
            <div className="text-sm text-slate-600">Sem dados para exibir.</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">{diagGroup.name || "Grupo"}</div>
                <div className="text-xs text-slate-600 font-mono">{diagGroup.id}</div>
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">Capacidade (titulares)</div>
                  <div className="text-lg font-semibold text-slate-900">{diagSummary.cap}</div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">Titulares aprovados (por docs)</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {diagSummary.docsApprovedCount}/{diagSummary.cap}
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">Pré-aprovados titulares (por lead)</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {diagSummary.leadPrimaryApproved}/{diagSummary.cap}
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">Pendências</div>
                  <div className="text-lg font-semibold text-slate-900">{diagSummary.withIssuesCount}</div>
                  <div className="text-[11px] text-slate-500">
                    Famílias sem lead: {diagSummary.missingLeadCount} • Leads sem Family: {diagSummary.orphanLeadsCount}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                <b>Como a contagem do grupo funciona:</b> para <b>current_participants</b> (titulares aprovados), o critério é <b>Documentação aprovada</b> nas famílias do grupo. O bloco “por lead” serve para identificar inconsistências na <b>WaitlistLeads</b>.
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b px-3 py-2 text-xs font-medium text-slate-600">
                  Famílias do grupo ({diagSummary.totalFamilies})
                </div>

                {diagFamilies.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600">Nenhuma família encontrada para este grupo.</div>
                ) : (
                  <div className="max-h-[45vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Família</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Docs</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Lead</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">O que falta / Observações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diagFamilies.map((r) => {
                          const docsBadge = r.docsApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800";
                          const leadOk = r.lead?.preapproved === true && String(r.lead?.status || "") !== "dropped";
                          const leadBadge = !r.lead
                            ? { t: "Sem lead", cn: "bg-slate-100 text-slate-700" }
                            : leadOk
                            ? { t: "Pré-aprovado", cn: "bg-blue-100 text-blue-700" }
                            : { t: "Não pré-aprovado", cn: "bg-rose-100 text-rose-700" };

                          return (
                            <tr key={r.familyId} className="border-b last:border-b-0">
                              <td className="px-3 py-2">
                                <div className="font-semibold text-slate-900 truncate max-w-[260px]">{r.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{r.familyId}</div>
                              </td>

                              <td className="px-3 py-2">
                                <Badge className={docsBadge}>{r.docsApproved ? "Aprovado" : r.docsStatus || "—"}</Badge>
                              </td>

                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  <Badge className={leadBadge.cn}>{leadBadge.t}</Badge>
                                  {r.lead ? (
                                    <div className="text-[11px] text-slate-500">
                                      role: <b>{r.lead?.role || "—"}</b>
                                      {r.lead?.position ? ` • pos: ${r.lead.position}` : ""}
                                      {r.lead?.status ? ` • status: ${r.lead.status}` : ""}
                                    </div>
                                  ) : null}
                                </div>
                              </td>

                              <td className="px-3 py-2">
                                {r.issues?.length ? (
                                  <ul className="list-disc ml-4 text-xs text-slate-700 space-y-1">
                                    {r.issues.map((it, i) => <li key={i}>{it}</li>)}
                                  </ul>
                                ) : (
                                  <div className="text-xs text-slate-500">OK</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {diagOrphanLeads?.length ? (
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-slate-50 border-b px-3 py-2 text-xs font-medium text-slate-600">
                    Leads na fila do grupo sem Family correspondente ({diagOrphanLeads.length})
                  </div>

                  <div className="max-h-[25vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Lead</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Status</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">O que falta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diagOrphanLeads.map((l) => (
                          <tr key={l.leadId} className="border-b last:border-b-0">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900 truncate max-w-[260px]">{l.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{l.leadId}</div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {l.email || "—"} {l.phone ? `• ${l.phone}` : ""}
                              </div>
                            </td>

                            <td className="px-3 py-2">
                              <Badge className={l.preapproved ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}>
                                {l.preapproved ? "Pré-aprovado" : "Aguardando"}
                              </Badge>
                              <div className="text-[11px] text-slate-500">
                                role: <b>{l.role || "—"}</b>
                                {l.position ? ` • pos: ${l.position}` : ""}
                                {l.status ? ` • ${l.status}` : ""}
                              </div>
                            </td>

                            <td className="px-3 py-2">
                              <ul className="list-disc ml-4 text-xs text-slate-700 space-y-1">
                                {(l.issues || []).map((it, i) => <li key={i}>{it}</li>)}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiagOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-4xl w-[96vw]">
          <DialogHeader>
            <DialogTitle>Notificar fila do novo grupo</DialogTitle>
          </DialogHeader>

          {!notifyGroup ? (
            <div className="text-sm text-slate-600">Nenhum grupo selecionado.</div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border rounded-xl">
                <div className="font-semibold text-slate-900">{notifyGroup.name}</div>
                <div className="text-sm text-slate-600">
                  {notifyGroup.city ? `${notifyGroup.city}${notifyGroup.state ? ` • ${notifyGroup.state}` : ""}` : "—"} • Pessoas puxadas da fila: <b>{notifyLeads?.length || 0}</b>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Aqui não há disparo automático (para não gerar custo). Você avisa manualmente via WhatsApp ou e-mail.
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assunto (e-mail)</Label>
                  <Input value={notifySubject} onChange={(e) => setNotifySubject(e.target.value)} />
                  <div className="text-xs text-slate-500">Tokens: {"{{first_name}}"} {"{{group_name}}"} {"{{preapprove_link}}"}</div>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem (template)</Label>
                  <Textarea className="min-h-[120px]" value={notifyMessageTpl} onChange={(e) => setNotifyMessageTpl(e.target.value)} />
                  <div className="text-xs text-slate-500">Tokens: {"{{first_name}}"} {"{{group_name}}"} {"{{preapprove_link}}"}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => copyToClipboard(notifyMessageTpl, "Template copiado.")}> 
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar template
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const emails = (notifyLeads || []).map((l) => String(l?.email || "").trim()).filter(Boolean).join(", ");
                    copyToClipboard(emails, "E-mails copiados.");
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Copiar e-mails (lista)
                </Button>

                <Button variant="outline" onClick={() => markAllAsNotified()} disabled={!notifyLeads?.length || markingNotified}>
                  {markingNotified ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Marcar como notificados
                </Button>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 border-b text-xs font-medium text-slate-600">
                  <div className="col-span-4 px-3 py-2">Pessoa</div>
                  <div className="col-span-3 px-3 py-2">Contato</div>
                  <div className="col-span-5 px-3 py-2 text-right">Ações</div>
                </div>

                <div className="max-h-[320px] overflow-y-auto">
                  {(notifyLeads || []).length === 0 ? (
                    <div className="p-4 text-sm text-slate-600">Não há pessoas para notificar.</div>
                  ) : (
                    (notifyLeads || []).map((lead) => {
                      const msg = buildLeadMessage(lead);
                      const subj = buildLeadSubject(lead);
                      const wa = buildWhatsAppLink(lead?.phone || lead?.phone_formatted || "", msg);
                      const mail = buildMailtoLink(lead?.email || "", subj, msg);

                      return (
                        <div key={lead.id} className="grid grid-cols-12 items-center border-b last:border-b-0">
                          <div className="col-span-4 px-3 py-2">
                            <div className="text-sm font-semibold text-slate-900 truncate">{lead.full_name || lead.name || "—"}</div>
                            <div className="text-[11px] text-slate-500">
                              {lead.group_queue_position ? `Fila: #${lead.group_queue_position}` : ""}
                              {lead.waitlist_position ? ` • Geral: #${lead.waitlist_position}` : ""}
                            </div>
                          </div>

                          <div className="col-span-3 px-3 py-2 text-xs text-slate-700">
                            <div className="truncate">{lead.email || "—"}</div>
                            <div className="truncate">{lead.phone_formatted || lead.phone || "—"}</div>
                          </div>

                          <div className="col-span-5 px-3 py-2 flex justify-end gap-2 flex-wrap">
                            <Button variant="outline" className="h-9" onClick={() => copyToClipboard(msg, "Mensagem copiada.")}> 
                              <Copy className="w-4 h-4 mr-2" />
                              Copiar msg
                            </Button>

                            <Button variant="outline" className="h-9" disabled={!wa} onClick={() => window.open(wa, "_blank")}> 
                              <MessageCircle className="w-4 h-4 mr-2" />
                              WhatsApp
                            </Button>

                            <Button variant="outline" className="h-9" disabled={!lead?.email} onClick={() => (window.location.href = mail)}>
                              <Mail className="w-4 h-4 mr-2" />
                              E-mail
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-xl w-[96vw]">
          <DialogHeader>
            <DialogTitle>Excluir grupo</DialogTitle>
          </DialogHeader>

          {!selectedGroup ? (
            <div className="text-sm text-slate-600">Selecione um grupo.</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border bg-red-50 p-3">
                <div className="font-semibold text-red-900">Atenção: ação irreversível</div>
                <div className="text-sm text-red-800 mt-1">Grupo: <b>{selectedGroup.name || "—"}</b></div>
                <div className="text-xs text-red-800 font-mono mt-1">{selectedGroup.id}</div>
              </div>

              <div className="text-sm text-slate-700">Para confirmar, digite <b>EXCLUIR</b>.</div>

              <Input value={deletePhrase} onChange={(e) => setDeletePhrase(e.target.value)} placeholder="EXCLUIR" />

              <div className="text-xs text-slate-500">Dica: prefira cancelar o grupo em vez de excluir, se já houver famílias vinculadas.</div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={!selectedGroup || deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

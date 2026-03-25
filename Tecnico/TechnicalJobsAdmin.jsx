//TechnicalJobsAdmin1.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  getDocs,
  getDoc,
  where,
  limit,
  startAt,
  endAt,
} from "firebase/firestore";

import {
  CheckCircle2,
  Clock,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  XCircle,
  User,
  Wrench,
  Users,
  BadgeCheck,
} from "lucide-react";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

// Firestore
const COL_JOBS = "TechnicalJobs";

// Coleções do modal
const COL_FAMILIES = "Family";
const COL_TECHS = "users";

// status
const STATUS = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELED: "canceled",
};

// type
const TYPE = {
  VISIT: "visit",
  INSTALL: "install",
};

function safeToDate(ts) {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function toDatetimeLocalValue(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function normalizeCPF(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 11);
}

function formatCpfBR(digits11) {
  const d = normalizeCPF(digits11);
  if (d.length !== 11) return "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function statusConfig(s) {
  const map = {
    [STATUS.SCHEDULED]: { label: "Agendado", className: "bg-sky-50 text-sky-700 border border-sky-200" },
    [STATUS.IN_PROGRESS]: { label: "Em execução", className: "bg-amber-50 text-amber-700 border border-amber-200" },
    [STATUS.COMPLETED]: { label: "Concluído", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    [STATUS.CANCELED]: { label: "Cancelado", className: "bg-rose-50 text-rose-700 border border-rose-200" },
  };
  return map[s] || { label: s || "—", className: "bg-slate-100 text-slate-700 border border-slate-200" };
}

function typeConfig(t) {
  const map = {
    [TYPE.VISIT]: { label: "Visita técnica", className: "bg-amber-50 text-amber-700 border border-amber-200" },
    [TYPE.INSTALL]: { label: "Instalação", className: "bg-violet-50 text-violet-700 border border-violet-200" },
  };
  return map[t] || { label: t || "—", className: "bg-slate-50 text-slate-700 border border-slate-200" };
}

const EMPTY = {
  family_name: "",
  family_uid: "",
  family_doc_id: "",
  family_cpf: "",

  technician_name: "",
  technician_uid: "",
  technician_id: "",

  type: TYPE.VISIT,

  // ✅ status não é mais editável no dialog; ainda guardamos internamente
  status: STATUS.SCHEDULED,

  scheduled_at: "",
  notes: "",
  canceled_reason: "",
};


async function callTechnicalFunction(path, body) {
  const projectId = db.app?.options?.projectId || auth?.app?.options?.projectId || "soldagente-30f00";
  const user = auth.currentUser;
  const token = user && typeof user.getIdToken === "function" ? await user.getIdToken() : null;
  if (!token) throw new Error("Usuário não autenticado.");

  const url = `https://us-central1-${projectId}.cloudfunctions.net/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!res.ok) {
    throw Object.assign(new Error(data?.error || data?.message || "Falha na operação."), {
      status: res.status,
      data,
    });
  }

  return data;
}

// ordem do pipeline (pra evitar “regredir” estágio sem querer)
const PIPELINE_ORDER = [
  "cadastro",
  "plano",
  "visita",
  "grupo",
  "contrato",
  "projeto_eletrico",
  "instalacao",
  "homologacao",
  "ativo",
];

function stageRank(stage) {
  const s = String(stage || "").trim().toLowerCase();
  const idx = PIPELINE_ORDER.indexOf(s);
  return idx >= 0 ? idx : 0;
}

function pipelinePatchForJob({ type, status, cancelReason }) {
  const reason = String(cancelReason || "").trim();

  if (type === TYPE.VISIT) {
    if (status === STATUS.SCHEDULED) return { pipeline_stage: "visita", pipeline_substatus: "agendada", pipeline_reason: "" };
    if (status === STATUS.IN_PROGRESS) return { pipeline_stage: "visita", pipeline_substatus: "em_andamento", pipeline_reason: "" };
    if (status === STATUS.COMPLETED) return { pipeline_stage: "grupo", pipeline_substatus: "aguardando", pipeline_reason: "" };
    if (status === STATUS.CANCELED) return { pipeline_stage: "visita", pipeline_substatus: "cancelada", pipeline_reason: reason || "Agendamento cancelado" };
    return { pipeline_stage: "visita", pipeline_substatus: "aguardando", pipeline_reason: "" };
  }

  // INSTALL
  if (status === STATUS.SCHEDULED) return { pipeline_stage: "instalacao", pipeline_substatus: "agendada", pipeline_reason: "" };
  if (status === STATUS.IN_PROGRESS) return { pipeline_stage: "instalacao", pipeline_substatus: "em_andamento", pipeline_reason: "" };
  if (status === STATUS.COMPLETED) return { pipeline_stage: "homologacao", pipeline_substatus: "aguardando", pipeline_reason: "" };
  if (status === STATUS.CANCELED) return { pipeline_stage: "instalacao", pipeline_substatus: "cancelada", pipeline_reason: reason || "Agendamento cancelado" };
  return { pipeline_stage: "instalacao", pipeline_substatus: "aguardando", pipeline_reason: "" };
}

async function applyFamilyPipelineUpdate({ familyDocId, jobType, jobStatus, cancelReason }) {
  if (!familyDocId) return;

  const patch = pipelinePatchForJob({ type: jobType, status: jobStatus, cancelReason });

  try {
    const famRef = doc(db, COL_FAMILIES, familyDocId);
    const famSnap = await getDoc(famRef);

    if (!famSnap.exists()) return;

    const fam = famSnap.data() || {};
    const curStage = String(fam.pipeline_stage || "cadastro");
    const curRank = stageRank(curStage);
    const nextRank = stageRank(patch.pipeline_stage);

    const isCancel = jobStatus === STATUS.CANCELED;

    // evita regredir estágio (exceto cancelamento, que pode marcar substatus/razão)
    const shouldUpdateStage = nextRank >= curRank || isCancel;

    const updatePayload = {
      ...(shouldUpdateStage ? { pipeline_stage: patch.pipeline_stage } : {}),
      pipeline_substatus: patch.pipeline_substatus || "",
      pipeline_reason: patch.pipeline_reason || "",
      pipeline_updated_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    await updateDoc(famRef, updatePayload);
  } catch {
    // silencioso (não travar a operação do job)
  }
}

export default function TechnicalJobsAdmin() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);

  // filtros
  const [qFamily, setQFamily] = useState("");
  const [qCpf, setQCpf] = useState("");
  const [qTech, setQTech] = useState("");
  const [qNotes, setQNotes] = useState("");
  const [quickStatus, setQuickStatus] = useState(STATUS.SCHEDULED);
  const [typeFilter, setTypeFilter] = useState("all");

  // dialogs
  const [openUpsert, setOpenUpsert] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  // modal: família
  const [familySelectOpen, setFamilySelectOpen] = useState(false);
  const [familyTerm, setFamilyTerm] = useState("");
  const [familyOptions, setFamilyOptions] = useState([]);
  const [familyLookupLoading, setFamilyLookupLoading] = useState(false);

  // modal: técnico
  const [techSelectOpen, setTechSelectOpen] = useState(false);
  const [techTerm, setTechTerm] = useState("");
  const [techOptions, setTechOptions] = useState([]);
  const [techLookupLoading, setTechLookupLoading] = useState(false);

  const familyDebounceRef = useRef(null);
  const techDebounceRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, COL_JOBS), orderBy("scheduled_at", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Erro ao carregar agendamentos.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const counters = useMemo(() => {
    const c = (s) => jobs.filter((j) => (j.status || STATUS.SCHEDULED) === s).length;
    return {
      scheduled: c(STATUS.SCHEDULED),
      inProgress: c(STATUS.IN_PROGRESS),
      completed: c(STATUS.COMPLETED),
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    const familyText = qFamily.trim().toLowerCase();
    const cpfText = normalizeCPF(qCpf);
    const techText = qTech.trim().toLowerCase();
    const notesText = qNotes.trim().toLowerCase();

    return jobs
      .filter((j) => (quickStatus ? (j.status || STATUS.SCHEDULED) === quickStatus : true))
      .filter((j) => (typeFilter === "all" ? true : (j.type || "") === typeFilter))
      .filter((j) => {
        if (!familyText) return true;
        const bag = [j.family_name].filter(Boolean).join(" ").toLowerCase();
        return bag.includes(familyText);
      })
      .filter((j) => {
        if (!cpfText) return true;
        const jobCpfDigits = normalizeCPF(j.family_cpf);
        return jobCpfDigits && jobCpfDigits.includes(cpfText);
      })
      .filter((j) => {
        if (!techText) return true;
        const bag = [j.technician_name].filter(Boolean).join(" ").toLowerCase();
        return bag.includes(techText);
      })
      .filter((j) => {
        if (!notesText) return true;
        return String(j.notes || "").toLowerCase().includes(notesText);
      });
  }, [jobs, qFamily, qCpf, qTech, qNotes, typeFilter, quickStatus]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);

    setFamilyTerm("");
    setFamilyOptions([]);
    setFamilySelectOpen(false);

    setTechTerm("");
    setTechOptions([]);
    setTechSelectOpen(false);
  }

  function openCreate() {
    resetForm();
    setOpenUpsert(true);
  }

  function openEdit(job) {
    setEditingId(job.id);
    const d = safeToDate(job.scheduled_at);

    setForm({
      family_name: job.family_name || "",
      family_uid: job.family_uid || "",
      family_doc_id: job.family_doc_id || "",
      family_cpf: job.family_cpf || "",

      technician_name: job.technician_name || "",
      technician_uid: job.technician_uid || "",
      technician_id: job.technician_id || "",

      type: job.type || TYPE.VISIT,

      // ✅ mantém internamente (mas não mostra no dialog)
      status: job.status || STATUS.SCHEDULED,

      scheduled_at: toDatetimeLocalValue(d),
      notes: job.notes || "",
      canceled_reason: job.canceled_reason || "",
    });

    setOpenUpsert(true);
  }

  
async function saveUpsert() {
  try {
    if (!form.family_name.trim()) return toast.error("Selecione uma família.");
    if (!form.technician_name.trim()) return toast.error("Selecione um instalador.");
    if (!form.scheduled_at) return toast.error("Informe a data/hora do agendamento.");

    const dt = new Date(form.scheduled_at);
    if (Number.isNaN(dt.getTime())) return toast.error("Data/hora inválida.");

    await callTechnicalFunction("upsertTechnicalJob", {
      id: editingId || null,
      family_name: form.family_name.trim(),
      family_uid: form.family_uid.trim(),
      family_doc_id: form.family_doc_id.trim(),
      family_cpf: form.family_cpf || "",
      technician_name: form.technician_name.trim(),
      technician_uid: form.technician_uid.trim(),
      technician_id: form.technician_id.trim(),
      type: form.type,
      status: editingId ? (form.status || STATUS.SCHEDULED) : STATUS.SCHEDULED,
      scheduled_at: dt.toISOString(),
      notes: form.notes?.trim() || "",
      canceled_reason: form.canceled_reason?.trim() || "",
    });

    toast.success(editingId ? "Agendamento atualizado." : "Agendamento criado.");
    setOpenUpsert(false);
    resetForm();
  } catch (e) {
    console.error(e);
    toast.error(e?.message || "Não foi possível salvar.");
  }
}


  
async function setStatus(job, status) {
  try {
    await callTechnicalFunction("setTechnicalJobStatus", {
      id: job.id,
      status,
    });
    toast.success("Status atualizado.");
  } catch (e) {
    console.error(e);
    toast.error(e?.message || "Falha ao atualizar status.");
  }
}


  function askCancel(job) {
    setCancelTarget(job);
    setCancelReason(job.canceled_reason || "");
    setOpenCancel(true);
  }

  
async function confirmCancel() {
  if (!cancelTarget) return;
  try {
    await callTechnicalFunction("cancelTechnicalJob", {
      id: cancelTarget.id,
      canceled_reason: cancelReason.trim(),
    });
    toast.success("Agendamento cancelado.");
    setOpenCancel(false);
    setCancelTarget(null);
    setCancelReason("");
  } catch (e) {
    console.error(e);
    toast.error(e?.message || "Falha ao cancelar.");
  }
}


  // ===== Busca família =====
  async function fetchFamilyOptions(term) {
    const raw = String(term || "").trim();
    if (!raw) {
      setFamilyOptions([]);
      return;
    }

    const lower = raw.toLowerCase();
    const cpfDigits = normalizeCPF(raw);

    setFamilyLookupLoading(true);
    try {
      const found = new Map();

      if (cpfDigits.length >= 6) {
        const cpfFmt = formatCpfBR(cpfDigits);

        const tryQueries = [];
        if (cpfFmt) {
          tryQueries.push(query(collection(db, COL_FAMILIES), where("cpf", "==", cpfFmt), limit(10)));
        }
        tryQueries.push(query(collection(db, COL_FAMILIES), where("cpf", "==", cpfDigits), limit(10)));
        tryQueries.push(query(collection(db, COL_FAMILIES), where("cpf_digits", "==", cpfDigits), limit(10)));

        for (let i = 0; i < tryQueries.length; i += 1) {
          try {
            const snap = await getDocs(tryQueries[i]);
            snap.forEach((d) => found.set(d.id, { id: d.id, ...d.data() }));
          } catch {
            // ignora
          }
        }
      }

      try {
        const qPrefix = query(
          collection(db, COL_FAMILIES),
          orderBy("full_name"),
          startAt(raw),
          endAt(`${raw}\uf8ff`),
          limit(10)
        );
        const snap2 = await getDocs(qPrefix);
        snap2.forEach((d) => found.set(d.id, { id: d.id, ...d.data() }));
      } catch {
        // ignora
      }

      if (found.size < 5) {
        try {
          const qRecent = query(collection(db, COL_FAMILIES), orderBy("created_at", "desc"), limit(60));
          const snap3 = await getDocs(qRecent);
          const arr = [];
          snap3.forEach((d) => arr.push({ id: d.id, ...d.data() }));

          const filteredRecent = arr.filter((f) => {
            const name = String(f.full_name || "").toLowerCase();
            const cpf = String(f.cpf || "");
            const cpfD = normalizeCPF(cpf);
            const okName = name.includes(lower);
            const okCpf = cpfDigits ? cpfD.includes(cpfDigits) : false;
            return okName || okCpf;
          });

          filteredRecent.slice(0, 10).forEach((f) => found.set(f.id, f));
        } catch {
          // ignora
        }
      }

      setFamilyOptions(Array.from(found.values()).slice(0, 10));
    } finally {
      setFamilyLookupLoading(false);
    }
  }

  function pickFamily(f) {
    const uid = f.uid || f.user_uid || f.userId || "";
    const docId = f.id || "";
    const cpfVal = f.cpf || "";

    setForm((p) => ({
      ...p,
      family_name: f.full_name || p.family_name,
      family_uid: uid || p.family_uid,
      family_doc_id: docId || p.family_doc_id,
      family_cpf: cpfVal || p.family_cpf,
    }));

    setFamilySelectOpen(false);
    toast.success("Família selecionada.");
  }

  // ===== Busca técnico =====
  async function fetchTechOptions(term) {
    const raw = String(term || "").trim();
    if (!raw) {
      setTechOptions([]);
      return;
    }

    const lower = raw.toLowerCase();
    setTechLookupLoading(true);
    try {
      const found = new Map();

      try {
        const qPrefix = query(
          collection(db, COL_TECHS),
          where("role", "==", "installer"),
          orderBy("full_name"),
          startAt(raw),
          endAt(`${raw}\uf8ff`),
          limit(10)
        );
        const snap = await getDocs(qPrefix);
        snap.forEach((d) => found.set(d.id, { id: d.id, ...d.data() }));
      } catch {
        // ignora
      }

      if (found.size === 0) {
        try {
          const qSome = query(collection(db, COL_TECHS), where("role", "==", "installer"), limit(80));
          const snap2 = await getDocs(qSome);
          const arr = [];
          snap2.forEach((d) => arr.push({ id: d.id, ...d.data() }));

          arr
            .filter((u) => String(u.full_name || "").toLowerCase().includes(lower))
            .slice(0, 10)
            .forEach((u) => found.set(u.id, u));
        } catch {
          // ignora
        }
      }

      setTechOptions(Array.from(found.values()).slice(0, 10));
    } finally {
      setTechLookupLoading(false);
    }
  }

  function pickTech(t) {
    const uid = t.uid || t.user_uid || t.userId || t.id || "";
    setForm((p) => ({
      ...p,
      technician_name: t.full_name || p.technician_name,
      technician_uid: uid || p.technician_uid,
      technician_id: t.technician_id || t.id_number || p.technician_id,
    }));

    setTechSelectOpen(false);
    toast.success("Instalador selecionado.");
  }

  useEffect(() => {
    if (!familySelectOpen) return;

    if (familyDebounceRef.current) clearTimeout(familyDebounceRef.current);

    familyDebounceRef.current = setTimeout(() => {
      fetchFamilyOptions(familyTerm);
    }, 250);

    return () => {
      if (familyDebounceRef.current) clearTimeout(familyDebounceRef.current);
    };
  }, [familyTerm, familySelectOpen]);

  useEffect(() => {
    if (!techSelectOpen) return;

    if (techDebounceRef.current) clearTimeout(techDebounceRef.current);

    techDebounceRef.current = setTimeout(() => {
      fetchTechOptions(techTerm);
    }, 250);

    return () => {
      if (techDebounceRef.current) clearTimeout(techDebounceRef.current);
    };
  }, [techTerm, techSelectOpen]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Agendamentos Técnicos</h1>
          <p className="text-sm text-slate-500">
            Admin agenda aqui (TechnicalJobs). A execução é iniciada pelo técnico no painel de execução.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
            <RefreshCcw className="h-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={openCreate} className="rounded-xl">
            <Plus className="h-4 h-4 mr-2" />
            Novo agendamento
          </Button>
        </div>
      </div>

      {/* filtros */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Users className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9 rounded-xl" placeholder="Família (nome)" value={qFamily} onChange={(e) => setQFamily(e.target.value)} />
            </div>

            <div className="relative">
              <BadgeCheck className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9 rounded-xl" placeholder="CPF da família" value={qCpf} onChange={(e) => setQCpf(e.target.value)} />
            </div>

            <div className="relative">
              <Wrench className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9 rounded-xl" placeholder="Instalador (nome)" value={qTech} onChange={(e) => setQTech(e.target.value)} />
            </div>

            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9 rounded-xl" placeholder="Observações" value={qNotes} onChange={(e) => setQNotes(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[220px] rounded-xl">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value={TYPE.VISIT}>Visita técnica</SelectItem>
                  <SelectItem value={TYPE.INSTALL}>Instalação</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setQFamily("");
                  setQCpf("");
                  setQTech("");
                  setQNotes("");
                  setTypeFilter("all");
                  setQuickStatus(STATUS.SCHEDULED);
                }}
              >
                Limpar filtros
              </Button>
            </div>

            {/* botões status */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button className="rounded-xl" variant={quickStatus === STATUS.SCHEDULED ? "default" : "outline"} onClick={() => setQuickStatus(STATUS.SCHEDULED)}>
                <Clock className="h-4 w-4 mr-2" />
                Agendados <span className="ml-2 text-xs opacity-80">({counters.scheduled})</span>
              </Button>

              <Button className="rounded-xl" variant={quickStatus === STATUS.IN_PROGRESS ? "default" : "outline"} onClick={() => setQuickStatus(STATUS.IN_PROGRESS)}>
                <Wrench className="h-4 w-4 mr-2" />
                Em execução <span className="ml-2 text-xs opacity-80">({counters.inProgress})</span>
              </Button>

              <Button className="rounded-xl" variant={quickStatus === STATUS.COMPLETED ? "default" : "outline"} onClick={() => setQuickStatus(STATUS.COMPLETED)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Concluídos <span className="ml-2 text-xs opacity-80">({counters.completed})</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* lista */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {loading ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-sm text-slate-500">Carregando…</CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-sm text-slate-500">Nenhum resultado.</CardContent>
          </Card>
        ) : (
          filtered.map((job) => {
            const s = statusConfig(job.status);
            const t = typeConfig(job.type);
            const when = fmtDateTime(safeToDate(job.scheduled_at));

            return (
              <Card key={job.id} className="rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        {job.family_name || "—"}
                      </CardTitle>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${s.className} rounded-xl`}>{s.label}</Badge>
                        <Badge className={`${t.className} rounded-xl`}>{t.label}</Badge>
                        {job.family_cpf ? (
                          <Badge className="bg-slate-50 text-slate-700 border border-slate-200 rounded-xl">
                            CPF: {job.family_cpf}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="rounded-xl">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(job)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar / Reagendar
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => setStatus(job, STATUS.SCHEDULED)}>
                          <Clock className="h-4 w-4 mr-2" />
                          Marcar como agendado
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => setStatus(job, STATUS.IN_PROGRESS)}>
                          <Wrench className="h-4 w-4 mr-2" />
                          Marcar como em execução
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => setStatus(job, STATUS.COMPLETED)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Marcar como concluído
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => askCancel(job)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="text-sm text-slate-600 space-y-1">
                    <div>
                      <span className="font-medium">Agendado para:</span> {when}
                    </div>
                    <div>
                      <span className="font-medium">Instalador:</span> {job.technician_name || "—"}
                    </div>
                    {job.notes ? (
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <span className="font-medium">Observações:</span> {job.notes}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* dialog upsert */}
      <Dialog
        open={openUpsert}
        onOpenChange={(v) => {
          setOpenUpsert(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="w-[98vw] max-w-5xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Família */}
            <div className="space-y-2 md:col-span-2">
              <Label>Família</Label>

              <Select
                open={familySelectOpen}
                onOpenChange={(v) => {
                  setFamilySelectOpen(v);
                  if (v) {
                    setFamilyOptions([]);
                    setFamilyTerm(form.family_name || "");
                  }
                }}
                value={form.family_doc_id || "none"}
                onValueChange={(val) => {
                  const picked = familyOptions.find((x) => x.id === val);
                  if (picked) pickFamily(picked);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Clique para buscar (nome ou CPF)" />
                </SelectTrigger>

                <SelectContent>
                  <div className="p-2 border-b border-slate-100">
                    <Input className="rounded-xl" value={familyTerm} onChange={(e) => setFamilyTerm(e.target.value)} placeholder="Digite nome ou CPF…" />
                    {familyLookupLoading ? <div className="text-xs text-slate-500 mt-2">Buscando…</div> : null}
                  </div>

                  {familyOptions.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">Nenhuma família encontrada.</div>
                  ) : (
                    familyOptions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{f.full_name || "—"}</span>
                          <span className="text-xs text-slate-500">CPF: {String(f.cpf || "—")}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {form.family_name ? (
                <div className="text-sm text-slate-600">
                  Selecionado: <span className="font-medium">{form.family_name}</span>
                  {form.family_cpf ? <span className="text-slate-500"> • CPF: {form.family_cpf}</span> : null}
                </div>
              ) : null}
            </div>

            {/* Instalador */}
            <div className="space-y-2 md:col-span-2">
              <Label>Instalador</Label>

              <Select
                open={techSelectOpen}
                onOpenChange={(v) => {
                  setTechSelectOpen(v);
                  if (v) {
                    setTechOptions([]);
                    setTechTerm(form.technician_name || "");
                  }
                }}
                value={form.technician_uid || "none"}
                onValueChange={(val) => {
                  const picked = techOptions.find((x) => {
                    const uid = x.uid || x.user_uid || x.userId || x.id || "";
                    return uid === val;
                  });
                  if (picked) pickTech(picked);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Clique para buscar instalador" />
                </SelectTrigger>

                <SelectContent>
                  <div className="p-2 border-b border-slate-100">
                    <Input className="rounded-xl" value={techTerm} onChange={(e) => setTechTerm(e.target.value)} placeholder="Digite o nome…" />
                    {techLookupLoading ? <div className="text-xs text-slate-500 mt-2">Buscando…</div> : null}
                  </div>

                  {techOptions.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">Nenhum instalador encontrado.</div>
                  ) : (
                    techOptions.map((t) => {
                      const uid = t.uid || t.user_uid || t.userId || t.id || "";
                      return (
                        <SelectItem key={uid} value={uid}>
                          <div className="flex flex-col">
                            <span className="font-medium">{t.full_name || "—"}</span>
                            <span className="text-xs text-slate-500">role: {t.role || "—"}</span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>

              {form.technician_name ? (
                <div className="text-sm text-slate-600">
                  Selecionado: <span className="font-medium">{form.technician_name}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Tipo de serviço</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TYPE.VISIT}>Visita técnica</SelectItem>
                  <SelectItem value={TYPE.INSTALL}>Instalação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ✅ REMOVIDO: Select de status no dialog */}

            <div className="space-y-2">
              <Label>Data e hora</Label>
              <Input
                className="rounded-xl"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Input
                className="rounded-xl"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ex.: cliente estará em casa, ponto de referência, etc."
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpenUpsert(false)}>
                Fechar
              </Button>
              <Button className="rounded-xl" onClick={saveUpsert}>
                {editingId ? "Salvar alterações" : "Criar agendamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* dialog cancel */}
      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent className="w-[96vw] max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cancelar agendamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Motivo do cancelamento</Label>
            <Input
              className="rounded-xl"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex.: cliente remarcou, instalador indisponível, etc."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpenCancel(false)}>
              Voltar
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={confirmCancel}>
              Cancelar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

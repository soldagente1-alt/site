//TechnicalHomologationsAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs,
  limit,
  startAt,
  endAt,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  CheckCircle2,
  Clock,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  User,
  AlertTriangle,
  XCircle,
  Upload,
  Link as LinkIcon,
  ShieldCheck,
  Search,
} from "lucide-react";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

// =========================
// Firestore
// =========================
const COL_HOMO = "TechnicalHomologations";
const COL_FAMILIES = "Family";

// Uploads
const MAX_FILES = 10;
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const FUNCTION_REGION = "us-central1";

function getFunctionsBase() {
  const projectId =
    db?.app?.options?.projectId ||
    auth?.app?.options?.projectId ||
    process.env.REACT_APP_FIREBASE_PROJECT_ID ||
    "soldagente-30f00";

  return `https://${FUNCTION_REGION}-${projectId}.cloudfunctions.net`;
}

async function callTechnicalFunction(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão não carregada. Faça login novamente.");

  const token = await user.getIdToken();
  const res = await fetch(`${getFunctionsBase()}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { raw: text } : null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Falha ao chamar ${path}.`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data || { ok: true };
}

// =========================
// STATUS homologação
// =========================
const HOMO_STATUS = {
  AWAITING: "awaiting",
  REQUEST_SUBMITTED: "request_submitted",
  UNDER_REVIEW: "under_review",
  PENDING_DOCS: "pending_docs",
  APPROVED: "approved",
  METER_EXCHANGE_SCHEDULED: "meter_exchange_scheduled",
  METER_EXCHANGED: "meter_exchanged",
  HOMOLOGATED: "homologated",
  CANCELED: "canceled",
};

function normStr(v) {
  return String(v || "").trim().toLowerCase();
}

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

function toDateInputValue(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeAttachments(att) {
  if (!att) return [];
  if (Array.isArray(att)) return att;
  return [att];
}

function prettyBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let u = 0;
  let v = n;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

function statusConfig(s) {
  const map = {
    [HOMO_STATUS.AWAITING]: {
      label: "Aguardando",
      className: "bg-slate-50 text-slate-700 border border-slate-200",
      pill: "bg-slate-100 text-slate-700",
    },
    [HOMO_STATUS.REQUEST_SUBMITTED]: {
      label: "Pedido enviado",
      className: "bg-blue-50 text-blue-700 border border-blue-200",
      pill: "bg-blue-100 text-blue-700",
    },
    [HOMO_STATUS.UNDER_REVIEW]: {
      label: "Em análise",
      className: "bg-amber-50 text-amber-700 border border-amber-200",
      pill: "bg-amber-100 text-amber-800",
    },
    [HOMO_STATUS.PENDING_DOCS]: {
      label: "Pendências",
      className: "bg-rose-50 text-rose-700 border border-rose-200",
      pill: "bg-rose-100 text-rose-700",
    },
    [HOMO_STATUS.APPROVED]: {
      label: "Aprovado",
      className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      pill: "bg-emerald-100 text-emerald-700",
    },
    [HOMO_STATUS.METER_EXCHANGE_SCHEDULED]: {
      label: "Troca medidor agendada",
      className: "bg-violet-50 text-violet-700 border border-violet-200",
      pill: "bg-violet-100 text-violet-700",
    },
    [HOMO_STATUS.METER_EXCHANGED]: {
      label: "Medidor trocado",
      className: "bg-violet-50 text-violet-700 border border-violet-200",
      pill: "bg-violet-100 text-violet-700",
    },
    [HOMO_STATUS.HOMOLOGATED]: {
      label: "Homologado",
      className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      pill: "bg-emerald-100 text-emerald-700",
    },
    [HOMO_STATUS.CANCELED]: {
      label: "Cancelado",
      className: "bg-slate-50 text-slate-500 border border-slate-200",
      pill: "bg-slate-200 text-slate-600",
    },
  };

  return (
    map[s] || {
      label: s || "—",
      className: "bg-slate-50 text-slate-700 border border-slate-200",
      pill: "bg-slate-100 text-slate-700",
    }
  );
}

// =========================
// FORM
// =========================
const EMPTY = {
  family_id: "",
  family_name: "",

  utility: "neoenergia",
  protocol_number: "",

  request_submitted_date: "",
  under_review_date: "",
  pending_docs_date: "",
  approved_date: "",
  meter_exchange_scheduled_date: "",
  meter_exchanged_date: "",
  homologated_date: "",

  status: HOMO_STATUS.AWAITING,

  notes: "",
  pending_reason: "",

  portal_url: "",
  docs_url: "",

  attachments: null,
};

export default function TechnicalHomologationsAdmin() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);

  // filtros
  const [qFamily, setQFamily] = useState("");
  const [qProtocol, setQProtocol] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // dialog upsert
  const [openUpsert, setOpenUpsert] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  // família lookup
  const [familySelectOpen, setFamilySelectOpen] = useState(false);
  const [familyTerm, setFamilyTerm] = useState("");
  const [familyOptions, setFamilyOptions] = useState([]);
  const [familyLookupLoading, setFamilyLookupLoading] = useState(false);
  const familyDebounceRef = useRef(null);

  // upload
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ dialog “Troca medidor agendada”
  const [openScheduleMeter, setOpenScheduleMeter] = useState(false);
  const [meterScheduleDate, setMeterScheduleDate] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, COL_HOMO), orderBy("updated_at", "desc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Erro ao carregar homologações.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    const fresh = rows.find((r) => r.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [rows, selected?.id]);

  const counters = useMemo(() => {
    const c = (s) => rows.filter((r) => (r.status || "") === s).length;
    return {
      awaiting: c(HOMO_STATUS.AWAITING),
      submitted: c(HOMO_STATUS.REQUEST_SUBMITTED),
      review: c(HOMO_STATUS.UNDER_REVIEW),
      pending: c(HOMO_STATUS.PENDING_DOCS),
      homologated: c(HOMO_STATUS.HOMOLOGATED),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const fam = qFamily.trim().toLowerCase();
    const prot = qProtocol.trim().toLowerCase();

    return rows
      .filter((r) => (statusFilter === "all" ? true : (r.status || "") === statusFilter))
      .filter((r) => {
        if (!fam) return true;
        return String(r.family_name || r.family_id || "").toLowerCase().includes(fam);
      })
      .filter((r) => {
        if (!prot) return true;
        return String(r.protocol_number || "").toLowerCase().includes(prot);
      });
  }, [rows, qFamily, qProtocol, statusFilter]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setFamilyTerm("");
    setFamilyOptions([]);
    setFamilySelectOpen(false);
    setNewFiles([]);
  }

  function openCreate() {
    resetForm();
    setOpenUpsert(true);
  }

  function openEdit(r) {
    setEditingId(r.id);
    setSelected(r);
    setForm({
      family_id: r.family_id || "",
      family_name: r.family_name || "",
      utility: r.utility || "neoenergia",
      protocol_number: r.protocol_number || "",

      request_submitted_date: r.request_submitted_date || "",
      under_review_date: r.under_review_date || "",
      pending_docs_date: r.pending_docs_date || "",
      approved_date: r.approved_date || "",
      meter_exchange_scheduled_date: r.meter_exchange_scheduled_date || "",
      meter_exchanged_date: r.meter_exchanged_date || "",
      homologated_date: r.homologated_date || "",

      status: r.status || HOMO_STATUS.AWAITING,

      notes: r.notes || "",
      pending_reason: r.pending_reason || "",

      portal_url: r.portal_url || "",
      docs_url: r.docs_url || "",

      attachments: r.attachments || null,
    });
    setNewFiles([]);
    setOpenUpsert(true);
  }

  function pickRow(r) {
    setSelected(r);
  }

  // =========================
  // família search (robusto simples)
  // =========================
  async function fetchFamilyOptions(term) {
    const raw = String(term || "").trim();
    if (!raw) {
      setFamilyOptions([]);
      return;
    }

    setFamilyLookupLoading(true);
    try {
      const found = new Map();

      try {
        const qPrefix = query(
          collection(db, COL_FAMILIES),
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

      if (found.size < 7) {
        try {
          const qRecent = query(collection(db, COL_FAMILIES), orderBy("created_at", "desc"), limit(60));
          const snap2 = await getDocs(qRecent);
          const arr = [];
          snap2.forEach((d) => arr.push({ id: d.id, ...d.data() }));
          arr
            .filter((f) => String(f.full_name || "").toLowerCase().includes(raw.toLowerCase()))
            .slice(0, 10)
            .forEach((f) => found.set(f.id, f));
        } catch {
          // ignora
        }
      }

      setFamilyOptions(Array.from(found.values()).slice(0, 10));
    } finally {
      setFamilyLookupLoading(false);
    }
  }

  useEffect(() => {
    if (!familySelectOpen) return;
    if (familyDebounceRef.current) clearTimeout(familyDebounceRef.current);

    familyDebounceRef.current = setTimeout(() => fetchFamilyOptions(familyTerm), 250);
    return () => {
      if (familyDebounceRef.current) clearTimeout(familyDebounceRef.current);
    };
  }, [familyTerm, familySelectOpen]);

  function pickFamily(f) {
    setForm((p) => ({
      ...p,
      family_id: f.id,
      family_name: f.full_name || p.family_name,
    }));
    setFamilySelectOpen(false);
    toast.success("Família selecionada.");
  }

  // =========================
  // Upload
  // =========================
  function onPickFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;

    const tooBig = picked.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error(`Arquivo acima de ${MAX_MB}MB: ${tooBig.name}`);
      return;
    }

    const existingCount = normalizeAttachments(form.attachments).length;
    const nextCount = existingCount + newFiles.length + picked.length;

    if (nextCount > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} arquivos (já existem ${existingCount}).`);
      return;
    }

    setNewFiles((prev) => [...prev, ...picked]);
  }

  async function uploadSelectedFiles(homoId) {
    if (!newFiles.length) return [];
    setUploading(true);

    try {
      const uploaded = [];
      for (const file of newFiles) {
        const safeName = String(file.name || "arquivo").replace(/[^\w.\-]+/g, "_");
        const path = `technicalHomologations/${homoId}/${Date.now()}_${safeName}`;
        const r = storageRef(storage, path);

        await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
        const url = await getDownloadURL(r);

        uploaded.push({
          name: file.name,
          url,
          size: file.size,
          contentType: file.type || "",
          uploaded_at: new Date().toISOString(),
        });
      }
      return uploaded;
    } finally {
      setUploading(false);
    }
  }

  function autoDateForStatus(nextStatus) {
    const today = toDateInputValue(new Date());
    const cur = { ...form };

    const setIfEmpty = (k) => {
      if (!cur[k]) cur[k] = today;
    };

    if (nextStatus === HOMO_STATUS.REQUEST_SUBMITTED) setIfEmpty("request_submitted_date");
    if (nextStatus === HOMO_STATUS.UNDER_REVIEW) setIfEmpty("under_review_date");
    if (nextStatus === HOMO_STATUS.PENDING_DOCS) setIfEmpty("pending_docs_date");
    if (nextStatus === HOMO_STATUS.APPROVED) setIfEmpty("approved_date");
    if (nextStatus === HOMO_STATUS.METER_EXCHANGE_SCHEDULED) setIfEmpty("meter_exchange_scheduled_date");
    if (nextStatus === HOMO_STATUS.METER_EXCHANGED) setIfEmpty("meter_exchanged_date");
    if (nextStatus === HOMO_STATUS.HOMOLOGATED) setIfEmpty("homologated_date");

    return cur;
  }

  async function saveUpsert() {
    try {
      if (!form.family_id) return toast.error("Selecione uma família.");
      if (!form.status) return toast.error("Selecione um status.");

      if (form.status !== HOMO_STATUS.AWAITING && !form.protocol_number.trim()) {
        return toast.error("Informe o número de protocolo.");
      }

      setSaving(true);

      const dated = autoDateForStatus(form.status);
      const uploadBucket = editingId || `temp_${dated.family_id || "family"}_${Date.now()}`;
      const uploaded = await uploadSelectedFiles(uploadBucket);

      const result = await callTechnicalFunction("upsertTechnicalHomologation", {
        id: editingId || "",
        family_id: dated.family_id,
        family_name: dated.family_name || "",
        utility: dated.utility || "neoenergia",
        protocol_number: dated.protocol_number || "",
        request_submitted_date: dated.request_submitted_date || "",
        under_review_date: dated.under_review_date || "",
        pending_docs_date: dated.pending_docs_date || "",
        approved_date: dated.approved_date || "",
        meter_exchange_scheduled_date: dated.meter_exchange_scheduled_date || "",
        meter_exchanged_date: dated.meter_exchanged_date || "",
        homologated_date: dated.homologated_date || "",
        status: dated.status,
        notes: dated.notes || "",
        pending_reason: dated.pending_reason || "",
        portal_url: dated.portal_url || "",
        docs_url: dated.docs_url || "",
        attachments: normalizeAttachments(dated.attachments),
        newAttachments: uploaded,
      });

      toast.success(editingId ? "Homologação atualizada." : "Homologação criada.");
      if (result?.familyActivated) {
        toast.success("Família movida para Ativo.");
      }

      setOpenUpsert(false);
      resetForm();
      setNewFiles([]);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function quickSetStatus(rowId, nextStatus) {
    try {
      const result = await callTechnicalFunction("setTechnicalHomologationStatus", {
        id: rowId,
        status: nextStatus,
      });

      if (result?.familyActivated) {
        toast.success("Status atualizado e família movida para Ativo.");
      } else {
        toast.success("Status atualizado.");
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Falha ao atualizar status.");
    }
  }

  // ✅ abre dialog de data e prepara valor (se já tiver)
  function openMeterScheduleDialog() {
    if (!selected) return;
    setMeterScheduleDate(selected?.meter_exchange_scheduled_date || "");
    setOpenScheduleMeter(true);
  }

  async function saveMeterSchedule() {
    if (!selected) return;
    const dt = String(meterScheduleDate || "").trim();
    if (!dt) {
      toast.error("Informe a data do agendamento.");
      return;
    }

    setSavingSchedule(true);
    try {
      await callTechnicalFunction("setTechnicalHomologationStatus", {
        id: selected.id,
        status: HOMO_STATUS.METER_EXCHANGE_SCHEDULED,
        meter_exchange_scheduled_date: dt,
      });
      toast.success("Troca do medidor agendada.");
      setOpenScheduleMeter(false);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível salvar a data.");
    } finally {
      setSavingSchedule(false);
    }
  }

  const leftBadges = useMemo(() => {
    const make = (key, label, count, cn) => ({
      key,
      label,
      count,
      className: cn,
    });

    return [
      make("all", "Todos", rows.length, "bg-slate-50 text-slate-700 border border-slate-200"),
      make(HOMO_STATUS.AWAITING, "Aguardando", counters.awaiting, "bg-slate-50 text-slate-700 border border-slate-200"),
      make(HOMO_STATUS.REQUEST_SUBMITTED, "Pedido enviado", counters.submitted, "bg-blue-50 text-blue-700 border border-blue-200"),
      make(HOMO_STATUS.UNDER_REVIEW, "Em análise", counters.review, "bg-amber-50 text-amber-700 border border-amber-200"),
      make(HOMO_STATUS.PENDING_DOCS, "Pendências", counters.pending, "bg-rose-50 text-rose-700 border border-rose-200"),
      make(HOMO_STATUS.HOMOLOGATED, "Homologado", counters.homologated, "bg-emerald-50 text-emerald-700 border border-emerald-200"),
    ];
  }, [rows.length, counters]);

  /* =========================
     UI
  ========================= */
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Homologações (Neoenergia)</h1>
          <p className="text-sm text-slate-500">
            Gestão técnica do processo com protocolo, datas, pendências e anexos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="rounded-xl"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={openCreate} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Nova homologação
          </Button>
        </div>
      </div>

      {/* filtros */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="relative">
              <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9 rounded-xl"
                placeholder="Família (nome)"
                value={qFamily}
                onChange={(e) => setQFamily(e.target.value)}
              />
            </div>

            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9 rounded-xl"
                placeholder="Protocolo"
                value={qProtocol}
                onChange={(e) => setQProtocol(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {leftBadges.map((b) => {
                const active = statusFilter === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setStatusFilter(b.key)}
                    className={[
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition",
                      active ? "bg-amber-500 text-white border-amber-600" : b.className,
                    ].join(" ")}
                    title={`Filtrar: ${b.label}`}
                  >
                    <span className="font-medium">{b.label}</span>
                    <span className={active ? "opacity-90" : "text-xs opacity-70"}>{b.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* layout 1/3 e 2/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* LEFT */}
        <Card className="rounded-2xl lg:col-span-1 h-[calc(100vh-150px)] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Processos
            </CardTitle>
            <div className="text-xs text-slate-500">
              Total: <b>{filtered.length}</b>
            </div>
          </CardHeader>

          <CardContent className="pt-0 overflow-y-auto flex-1 pr-1">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Nenhuma homologação encontrada.</div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => {
                  const active = selected?.id === r.id;
                  const s = statusConfig(r.status);
                  const updated = fmtDateTime(safeToDate(r.updated_at || r.created_at));

                  return (
                    <button
                      key={r.id}
                      onClick={() => pickRow(r)}
                      className={[
                        "w-full text-left rounded-2xl border p-3 transition",
                        active ? "bg-amber-50 border-amber-300" : "border-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {r.family_name || r.family_id || "—"}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            Protocolo: {r.protocol_number || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Atualizado: {updated}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] px-2 py-1 rounded-full ${s.pill}`}>
                            {s.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  Dados da homologação
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Atualize o status e preencha protocolo/datas. Anexe documentos e registros do processo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selected?.status ? (
                  <Badge className={`${statusConfig(selected.status).className} rounded-xl`}>
                    {statusConfig(selected.status).label}
                  </Badge>
                ) : null}

                {selected ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="rounded-xl">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(selected)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => quickSetStatus(selected.id, HOMO_STATUS.REQUEST_SUBMITTED)}>
                        <Clock className="h-4 w-4 mr-2" />
                        Marcar: Pedido enviado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => quickSetStatus(selected.id, HOMO_STATUS.UNDER_REVIEW)}>
                        <Clock className="h-4 w-4 mr-2" />
                        Marcar: Em análise
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => quickSetStatus(selected.id, HOMO_STATUS.PENDING_DOCS)}>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Marcar: Pendências
                      </DropdownMenuItem>

                      {/* ✅ AQUI: abre dialog com data */}
                      <DropdownMenuItem onClick={openMeterScheduleDialog}>
                        <Clock className="h-4 w-4 mr-2" />
                        Marcar: Troca do medidor agendada
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => quickSetStatus(selected.id, HOMO_STATUS.METER_EXCHANGED)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Marcar: Medidor trocado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => quickSetStatus(selected.id, HOMO_STATUS.HOMOLOGATED)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Marcar: Homologado
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-600"
                        onClick={() => quickSetStatus(selected.id, HOMO_STATUS.CANCELED)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Marcar: Cancelado
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {/* ❌ REMOVIDO: botão "Novo" aqui (você pediu para tirar) */}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {!selected ? (
              <div className="p-6 text-sm text-slate-500">
                Selecione um processo à esquerda para visualizar/editar.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Família:</span>{" "}
                    {selected.family_name || selected.family_id || "—"}
                  </div>
                  <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Protocolo:</span>{" "}
                    {selected.protocol_number || "—"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selected.portal_url ? (
                    <a
                      href={selected.portal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Portal
                    </a>
                  ) : null}

                  {selected.docs_url ? (
                    <a
                      href={selected.docs_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Pasta Docs
                    </a>
                  ) : null}
                </div>

                {/* Datas principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Pedido enviado:</span>{" "}
                    {selected.request_submitted_date || "—"}
                  </div>
                  <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Em análise:</span>{" "}
                    {selected.under_review_date || "—"}
                  </div>
                  <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Pendências:</span>{" "}
                    {selected.pending_docs_date || "—"}
                  </div>
                  <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Troca medidor agendada:</span>{" "}
                    {selected.meter_exchange_scheduled_date || "—"}
                  </div>
                  <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Medidor trocado:</span>{" "}
                    {selected.meter_exchanged_date || "—"}
                  </div>
                  <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-3">
                    <span className="font-medium">Homologado:</span>{" "}
                    {selected.homologated_date || "—"}
                  </div>
                </div>

                {selected.pending_reason ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
                    <div className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Pendências
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{selected.pending_reason}</div>
                  </div>
                ) : null}

                {selected.notes ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-700">
                    <div className="font-medium">Observações</div>
                    <div className="mt-1 whitespace-pre-wrap">{selected.notes}</div>
                  </div>
                ) : null}

                {/* Anexos */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <FileText className="h-4 w-4" />
                    Arquivos (até {MAX_FILES} • {MAX_MB}MB)
                  </div>

                  {normalizeAttachments(selected.attachments).length ? (
                    <div className="border border-slate-200 bg-white rounded-xl p-3">
                      <p className="text-sm font-medium text-slate-800">Arquivos anexados:</p>
                      <div className="mt-2 space-y-2">
                        {normalizeAttachments(selected.attachments).map((a, idx) => {
                          const name = a?.name || `Arquivo ${idx + 1}`;
                          const url = a?.url || null;
                          const size = a?.size ? prettyBytes(a.size) : null;

                          return (
                            <div key={`${name}_${idx}`} className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-800">{name}</div>
                                <div className="text-xs text-slate-500">{size ? `Tamanho: ${size}` : "—"}</div>
                              </div>
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Abrir
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">Sem link</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600">Nenhum arquivo anexado ainda.</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
            <DialogTitle>{editingId ? "Editar homologação" : "Nova homologação"}</DialogTitle>
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
                value={form.family_id || "none"}
                onValueChange={(val) => {
                  const picked = familyOptions.find((x) => x.id === val);
                  if (picked) pickFamily(picked);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Clique para buscar (nome)..." />
                </SelectTrigger>

                <SelectContent>
                  <div className="p-2 border-b border-slate-100">
                    <Input
                      className="rounded-xl"
                      value={familyTerm}
                      onChange={(e) => setFamilyTerm(e.target.value)}
                      placeholder="Digite o nome…"
                    />
                    {familyLookupLoading ? (
                      <div className="text-xs text-slate-500 mt-2">Buscando…</div>
                    ) : null}
                  </div>

                  {familyOptions.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">Nenhuma família encontrada.</div>
                  ) : (
                    familyOptions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{f.full_name || "—"}</span>
                          <span className="text-xs text-slate-500">ID: {f.id}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {form.family_name ? (
                <div className="text-sm text-slate-600">
                  Selecionado: <span className="font-medium">{form.family_name}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Concessionária</Label>
              <Select
                value={form.utility}
                onValueChange={(v) => setForm((p) => ({ ...p, utility: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neoenergia">Neoenergia</SelectItem>
                  <SelectItem value="outra">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HOMO_STATUS.AWAITING}>Aguardando</SelectItem>
                  <SelectItem value={HOMO_STATUS.REQUEST_SUBMITTED}>Pedido enviado</SelectItem>
                  <SelectItem value={HOMO_STATUS.UNDER_REVIEW}>Em análise</SelectItem>
                  <SelectItem value={HOMO_STATUS.PENDING_DOCS}>Pendências</SelectItem>
                  <SelectItem value={HOMO_STATUS.APPROVED}>Aprovado</SelectItem>
                  <SelectItem value={HOMO_STATUS.METER_EXCHANGE_SCHEDULED}>Troca medidor agendada</SelectItem>
                  <SelectItem value={HOMO_STATUS.METER_EXCHANGED}>Medidor trocado</SelectItem>
                  <SelectItem value={HOMO_STATUS.HOMOLOGATED}>Homologado</SelectItem>
                  <SelectItem value={HOMO_STATUS.CANCELED}>Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Número do protocolo</Label>
              <Input
                className="rounded-xl"
                value={form.protocol_number}
                onChange={(e) => setForm((p) => ({ ...p, protocol_number: e.target.value }))}
                placeholder="Ex.: 2026.00012345"
              />
            </div>

            <div className="space-y-2">
              <Label>Data do pedido</Label>
              <Input
                className="rounded-xl"
                type="date"
                value={form.request_submitted_date}
                onChange={(e) => setForm((p) => ({ ...p, request_submitted_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Data em análise</Label>
              <Input
                className="rounded-xl"
                type="date"
                value={form.under_review_date}
                onChange={(e) => setForm((p) => ({ ...p, under_review_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Pendências (se houver)</Label>
              <Input
                className="rounded-xl"
                value={form.pending_reason}
                onChange={(e) => setForm((p) => ({ ...p, pending_reason: e.target.value }))}
                placeholder="Ex.: enviar ART, corrigir diagrama, adequação do padrão..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Input
                className="rounded-xl"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ex.: data prevista, contato, histórico do chamado..."
              />
            </div>

            <div className="space-y-2">
              <Label>Link do portal</Label>
              <Input
                className="rounded-xl"
                value={form.portal_url}
                onChange={(e) => setForm((p) => ({ ...p, portal_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Link da pasta docs</Label>
              <Input
                className="rounded-xl"
                value={form.docs_url}
                onChange={(e) => setForm((p) => ({ ...p, docs_url: e.target.value }))}
                placeholder="https://drive..."
              />
            </div>

            {/* Upload */}
            <div className="space-y-2 md:col-span-2">
              <Label>Anexos</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  multiple
                  onChange={onPickFiles}
                  className="hidden"
                  id="homo-files"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => document.getElementById("homo-files")?.click()}
                  disabled={saving || uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar arquivos
                </Button>

                <div className="text-sm text-slate-600">
                  {newFiles.length ? `${newFiles.length} arquivo(s) selecionado(s)` : "Nenhum arquivo novo selecionado."}
                </div>
              </div>

              {newFiles.length ? (
                <div className="border border-slate-200 bg-white rounded-xl p-3">
                  <p className="text-sm font-medium text-slate-800">Novos arquivos:</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {newFiles.map((f, idx) => (
                      <li key={`${f.name}-${idx}`} className="flex items-center justify-between gap-3">
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-slate-500">{prettyBytes(f.size)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {normalizeAttachments(form.attachments).length ? (
                <div className="text-xs text-slate-500">
                  Já existentes: {normalizeAttachments(form.attachments).length}/{MAX_FILES}
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpenUpsert(false)}
              >
                Fechar
              </Button>
              <Button className="rounded-xl" onClick={saveUpsert} disabled={saving || uploading}>
                {saving ? "Salvando..." : uploading ? "Enviando arquivos..." : editingId ? "Salvar alterações" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ Dialog: data de agendamento troca do medidor */}
      <Dialog open={openScheduleMeter} onOpenChange={setOpenScheduleMeter}>
        <DialogContent className="w-[96vw] max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Informe a data de agendamento para troca do medidor</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                className="rounded-xl"
                type="date"
                value={meterScheduleDate}
                onChange={(e) => setMeterScheduleDate(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Essa data aparecerá no passo “Homologação” no painel da família.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpenScheduleMeter(false)}>
                Cancelar
              </Button>
              <Button className="rounded-xl" onClick={saveMeterSchedule} disabled={savingSchedule}>
                {savingSchedule ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

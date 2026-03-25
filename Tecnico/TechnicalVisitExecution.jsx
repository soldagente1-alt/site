
//TechnicalVisitExecution.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useLocation } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  PlayCircle,
  RefreshCcw,
  Save,
  Upload,
  User,
  Wrench,
} from "lucide-react";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const COL_JOBS = "TechnicalJobs";
const STATUS = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELED: "canceled",
};
const TYPE = { VISIT: "visit", INSTALL: "install" };
const RESULT = { APPROVED: "aprovada", PENDING: "pendencias", REJECTED: "recusada" };
const MAX_FILES = 6;
const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const EMPTY = {
  visit_date: "",
  grid_voltage: "",
  roof_type: "",
  shading: "",
  panel_area: "",
  meter_location: "",
  inverter_location: "",
  notes: "",
  visit_result: "",
};

function safeToDate(ts) {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}
function tsToMillis(ts) { const d = safeToDate(ts); return d ? d.getTime() : 0; }
function fmtDateTime(d) { return d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d) : "—"; }
function maskDateBR(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0,2), mm = digits.slice(2,4), yyyy = digits.slice(4,8);
  let out = dd; if (mm.length) out += `/${mm}`; if (yyyy.length) out += `/${yyyy}`; return out;
}
function normalizeAttachments(att) { if (!att) return []; return Array.isArray(att) ? att : [att]; }
function prettyBytes(bytes) {
  const n = Number(bytes || 0); if (!n) return "0 B";
  const units=["B","KB","MB","GB"]; let u=0, v=n;
  while (v>=1024 && u<units.length-1){v/=1024;u+=1;} return `${v.toFixed(u===0?0:1)} ${units[u]}`;
}
function useQueryParams() { const { search } = useLocation(); return useMemo(() => new URLSearchParams(search), [search]); }
function statusConfig(sRaw) {
  const s = String(sRaw || "").toLowerCase();
  const map = {
    [STATUS.COMPLETED]: { label: "Concluída", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    [STATUS.IN_PROGRESS]: { label: "Em execução", className: "bg-amber-50 text-amber-700 border border-amber-200" },
    [STATUS.SCHEDULED]: { label: "Agendada", className: "bg-blue-50 text-blue-700 border border-blue-200" },
    [STATUS.PENDING]: { label: "Pendências", className: "bg-orange-50 text-orange-700 border border-orange-200" },
    [STATUS.CANCELED]: { label: "Cancelada", className: "bg-rose-50 text-rose-700 border border-rose-200" },
  };
  return map[s] || { label: sRaw || "—", className: "bg-slate-100 text-slate-700 border border-slate-200" };
}
function typePill(tRaw) {
  const t = String(tRaw || "").toLowerCase();
  const map = {
    [TYPE.VISIT]: { label: "Visita", className: "bg-amber-50 text-amber-700 border border-amber-200" },
    [TYPE.INSTALL]: { label: "Instalação", className: "bg-violet-50 text-violet-700 border border-violet-200" },
  };
  return map[t] || { label: tRaw || "—", className: "bg-slate-50 text-slate-700 border border-slate-200" };
}
async function callTechnicalFunction(path, body) {
  const projectId = db.app?.options?.projectId || auth?.app?.options?.projectId || "soldagente-30f00";
  const user = auth.currentUser;
  const token = user && typeof user.getIdToken === "function" ? await user.getIdToken() : null;
  if (!token) throw new Error("Usuário não autenticado.");
  const url = `https://us-central1-${projectId}.cloudfunctions.net/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!res.ok) throw Object.assign(new Error(data?.error || data?.message || "Falha na operação."), { status: res.status, data });
  return data;
}

export default function TechnicalVisitsExecution() {
  const qp = useQueryParams();
  const deepJobId = qp.get("job") || "";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const qAll = query(collection(db, COL_JOBS), orderBy("scheduled_at", "desc"));
    const unsub = onSnapshot(qAll, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a,b) => (tsToMillis(b.scheduled_at) || tsToMillis(b.created_at)) - (tsToMillis(a.scheduled_at) || tsToMillis(a.created_at)));
      setJobs(rows);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error("Erro ao carregar execuções.");
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !deepJobId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, COL_JOBS, deepJobId));
        if (snap.exists()) pickJob({ id: snap.id, ...snap.data() });
      } catch (e) { console.error(e); }
    })();
  }, [user, deepJobId]);

  const filteredJobs = useMemo(() => jobs
    .filter((j) => statusFilter === "all" ? true : String(j.status || STATUS.SCHEDULED).toLowerCase() === statusFilter)
    .filter((j) => typeFilter === "all" ? true : String(j.type || "").toLowerCase() === typeFilter), [jobs, statusFilter, typeFilter]);

  function pickJob(j) {
    setSelected(j);
    setNewFiles([]);
    const exec = j.execution || j.exec || {};
    setForm({
      visit_date: exec.visit_date || "",
      grid_voltage: exec.grid_voltage || "",
      roof_type: exec.roof_type || "",
      shading: exec.shading || "",
      panel_area: exec.panel_area || "",
      meter_location: exec.meter_location || "",
      inverter_location: exec.inverter_location || "",
      notes: exec.notes || j.notes || "",
      visit_result: exec.visit_result || "",
    });
  }

  const isLocked = useMemo(() => !!selected && String(selected?.status || STATUS.SCHEDULED).toLowerCase() === STATUS.SCHEDULED, [selected]);

  function onPickFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    const tooBig = picked.find((f) => f.size > MAX_BYTES);
    if (tooBig) return toast.error(`Arquivo acima de ${MAX_MB}MB: ${tooBig.name}`);
    const existingCount = normalizeAttachments(selected?.attachments).length;
    const nextCount = existingCount + newFiles.length + picked.length;
    if (nextCount > MAX_FILES) return toast.error(`Você pode anexar no máximo ${MAX_FILES} arquivos.`);
    setNewFiles((prev) => [...prev, ...picked]);
  }

  async function uploadSelectedFiles(jobId) {
    if (!newFiles.length) return [];
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of newFiles) {
        const safeName = String(file.name || "arquivo").replace(/[^\w.\-]+/g, "_");
        const path = `technicalJobs/${jobId}/${Date.now()}_${safeName}`;
        const r = storageRef(storage, path);
        await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
        const url = await getDownloadURL(r);
        uploaded.push({ name: file.name, url, size: file.size, contentType: file.type || "", uploaded_at: new Date().toISOString() });
      }
      return uploaded;
    } finally { setUploading(false); }
  }

  async function startExecution() {
    if (!selected) return;
    try {
      setStarting(true);
      await callTechnicalFunction("startTechnicalJobExecution", { id: selected.id });
      toast.success("Execução iniciada.");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Falha ao iniciar execução.");
    } finally { setStarting(false); }
  }

  async function save() {
    if (!selected) return;
    if (isLocked) return toast.error("Clique em “Iniciar” antes de preencher/salvar.");
    if (!form.visit_date) return toast.error("Informe a data (DD/MM/AAAA).");
    try {
      setSaving(true);
      const existing = normalizeAttachments(selected?.attachments);
      if (existing.length + newFiles.length > MAX_FILES) return toast.error(`Limite de anexos: ${MAX_FILES} arquivos.`);
      const uploaded = await uploadSelectedFiles(selected.id);
      const attachments = [...existing, ...uploaded].slice(0, MAX_FILES);
      await callTechnicalFunction("saveTechnicalJobExecution", {
        id: selected.id,
        visit_date: form.visit_date,
        grid_voltage: form.grid_voltage,
        roof_type: form.roof_type,
        shading: form.shading,
        panel_area: form.panel_area,
        meter_location: form.meter_location,
        inverter_location: form.inverter_location,
        notes: form.notes,
        visit_result: form.visit_result || "",
        attachments,
      });
      setNewFiles([]);
      toast.success("Execução salva com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Falha ao salvar.");
    } finally { setSaving(false); }
  }

  const existingAttachments = normalizeAttachments(selected?.attachments);
  const selectedBadge = statusConfig(String(selected?.status || STATUS.SCHEDULED).toLowerCase());

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Execução Técnica</h1>
          <p className="text-sm text-slate-500">Inicie a execução, preencha os dados da visita/instalação e salve.</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
          <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="rounded-2xl lg:col-span-1">
          <CardHeader className="space-y-3">
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-slate-500" /> Execuções disponíveis</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge className={`cursor-pointer border ${typeFilter==='all'?'bg-amber-500 text-white border-amber-500':'bg-white text-slate-700 border-slate-200'}`} onClick={() => setTypeFilter('all')}>Todos</Badge>
              <Badge className={`cursor-pointer border ${typeFilter===TYPE.VISIT?'bg-amber-500 text-white border-amber-500':'bg-white text-slate-700 border-slate-200'}`} onClick={() => setTypeFilter(TYPE.VISIT)}>Visita</Badge>
              <Badge className={`cursor-pointer border ${typeFilter===TYPE.INSTALL?'bg-amber-500 text-white border-amber-500':'bg-white text-slate-700 border-slate-200'}`} onClick={() => setTypeFilter(TYPE.INSTALL)}>Instalação</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {[['all','Todos'],[STATUS.SCHEDULED,'Agendadas'],[STATUS.IN_PROGRESS,'Em execução'],[STATUS.PENDING,'Pendências'],[STATUS.COMPLETED,'Concluídas'],[STATUS.CANCELED,'Canceladas']].map(([key,label]) => (
                <Badge key={key} className={`cursor-pointer border ${statusFilter===key?'bg-amber-500 text-white border-amber-500':'bg-white text-slate-700 border-slate-200'}`} onClick={() => setStatusFilter(key)}>{label}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[75vh] overflow-auto">
            {loading ? <div className="text-sm text-slate-500">Carregando...</div> : null}
            {!loading && filteredJobs.length === 0 ? <div className="text-sm text-slate-500">Nenhuma execução encontrada.</div> : null}
            {filteredJobs.map((job) => {
              const active = selected?.id === job.id;
              const st = statusConfig(String(job.status || STATUS.SCHEDULED).toLowerCase());
              const tp = typePill(String(job.type || '').toLowerCase());
              return (
                <button key={job.id} type="button" onClick={() => pickJob(job)} className={`w-full text-left border rounded-xl p-3 transition ${active?'bg-amber-50 border-amber-300':'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{job.family_name || 'Família'}</div>
                      <div className="text-xs text-slate-500 truncate">{job.technician_name || '—'} • {fmtDateTime(safeToDate(job.scheduled_at))}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={tp.className}>{tp.label}</Badge>
                      <Badge className={st.className}>{st.label}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-500" /> {selected ? 'Detalhes da execução' : 'Selecione uma execução'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? <div className="text-sm text-slate-500">Escolha uma execução na lista para iniciar ou salvar.</div> : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-white p-3">
                    <div className="text-xs text-slate-500">Família</div>
                    <div className="font-medium">{selected.family_name || '—'}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-3">
                    <div className="text-xs text-slate-500">Instalador</div>
                    <div className="font-medium">{selected.technician_name || '—'}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-3">
                    <div className="text-xs text-slate-500">Agendamento</div>
                    <div className="font-medium">{fmtDateTime(safeToDate(selected.scheduled_at))}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-3">
                    <div className="text-xs text-slate-500">Status</div>
                    <Badge className={selectedBadge.className}>{selectedBadge.label}</Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={startExecution} disabled={starting || String(selected.status || STATUS.SCHEDULED).toLowerCase() !== STATUS.SCHEDULED}>
                    <PlayCircle className="h-4 w-4 mr-2" /> {starting ? 'Iniciando...' : 'Iniciar execução'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data da visita</Label>
                    <Input value={form.visit_date} onChange={(e) => setForm((p) => ({ ...p, visit_date: maskDateBR(e.target.value) }))} placeholder="DD/MM/AAAA" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tensão da rede</Label>
                    <Input value={form.grid_voltage} onChange={(e) => setForm((p) => ({ ...p, grid_voltage: e.target.value }))} placeholder="Ex.: 220V" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de telhado</Label>
                    <Input value={form.roof_type} onChange={(e) => setForm((p) => ({ ...p, roof_type: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sombreamento</Label>
                    <Input value={form.shading} onChange={(e) => setForm((p) => ({ ...p, shading: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Área para painéis</Label>
                    <Input value={form.panel_area} onChange={(e) => setForm((p) => ({ ...p, panel_area: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Local do medidor</Label>
                    <Input value={form.meter_location} onChange={(e) => setForm((p) => ({ ...p, meter_location: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Local do inversor</Label>
                    <Input value={form.inverter_location} onChange={(e) => setForm((p) => ({ ...p, inverter_location: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Resultado</Label>
                    <Select value={form.visit_result || "none"} onValueChange={(v) => setForm((p) => ({ ...p, visit_result: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione</SelectItem>
                        <SelectItem value={RESULT.APPROVED}>Aprovada</SelectItem>
                        <SelectItem value={RESULT.PENDING}>Pendências</SelectItem>
                        <SelectItem value={RESULT.REJECTED}>Recusada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <textarea className="min-h-[120px] w-full rounded-xl border bg-white px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Anexos</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input type="file" multiple onChange={onPickFiles} />
                    {uploading ? <div className="text-xs text-slate-500">Enviando anexos...</div> : null}
                  </div>
                  {newFiles.length ? <div className="space-y-1">{newFiles.map((f, idx) => <div key={`${f.name}-${idx}`} className="text-xs text-slate-600">{f.name} • {prettyBytes(f.size)}</div>)}</div> : null}
                  {existingAttachments.length ? <div className="space-y-1">{existingAttachments.map((a, idx) => <a key={`${a.url || a.name || idx}-${idx}`} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-700 underline">{a.name || `Anexo ${idx+1}`}</a>)}</div> : null}
                </div>

                <div className="flex gap-2">
                  <Button onClick={save} disabled={saving || uploading}>
                    <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar execução'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

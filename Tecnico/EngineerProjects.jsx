//EngineerProjects.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";
import { useAuth } from "../../context/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
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
import { toast } from "sonner";

/**
 * ✅ Collections (atual)
 * - Visitas/instalações agora vivem em TechnicalJobs (com execution dentro)
 */
const COL_FAMILY = "Family";
const COL_JOBS = "TechnicalJobs";
const COL_ENGINEERING = "EngineeringProjects";

/**
 * ✅ Status do fluxo da engenharia
 * - "completed" = concluído/finalizado
 */
const ENGINEERING_STATUS = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em andamento" },
  { value: "submitted", label: "Enviado" },
  { value: "approved", label: "Aprovado" },
  { value: "revision_requested", label: "Revisão solicitada" },
  { value: "completed", label: "Concluído" },
];

const STATUS_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "in_progress", label: "Em andamento" },
  { key: "submitted", label: "Enviados" },
  { key: "revision_requested", label: "Revisões" },
  { key: "approved", label: "Aprovados" },
  { key: "completed", label: "Concluídos" },
];

async function uploadFile(file, path) {
  const r = storageRef(storage, path);
  const task = uploadBytesResumable(r, file);

  await new Promise((resolve, reject) => {
    task.on("state_changed", null, reject, resolve);
  });

  return await getDownloadURL(task.snapshot.ref);
}


async function callTechnicalFunction(path, body, currentUser) {
  const projectId =
    db.app?.options?.projectId ||
    currentUser?.auth?.app?.options?.projectId ||
    "soldagente-30f00";

  const token = typeof currentUser?.getIdToken === "function" ? await currentUser.getIdToken() : null;
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

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw Object.assign(new Error(data?.error || data?.message || "Falha na operação."), {
      status: res.status,
      data,
    });
  }

  return data;
}

function normalizeStatus(s) {
  return String(s || "pending").trim().toLowerCase();
}

function statusLabel(v) {
  const s = normalizeStatus(v);
  return ENGINEERING_STATUS.find((x) => x.value === s)?.label || s || "Pendente";
}

function statusPillClass(v) {
  const s = normalizeStatus(v);
  if (s === "completed" || s === "approved") return "bg-emerald-100 text-emerald-700";
  if (s === "submitted") return "bg-blue-100 text-blue-700";
  if (s === "in_progress") return "bg-amber-100 text-amber-700";
  if (s === "revision_requested") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

/**
 * ✅ overall_status: considera "completed" como aprovado (pra fechar o fluxo)
 */
function computeOverallStatus(famData = {}, next = {}) {
  const visit_status = next.visit_status ?? famData.visit_status ?? "pending";
  const installation_status =
    next.installation_status ?? famData.installation_status ?? "pending";
  const engineering_status =
    next.engineering_status ?? famData.engineering_status ?? "pending";

  const engOk = engineering_status === "approved" || engineering_status === "completed";

  if (visit_status !== "completed") return "awaiting_visit";
  if (installation_status !== "completed") return "awaiting_installation";
  if (!engOk) return "awaiting_engineering";
  return "completed";
}

/**
 * ✅ PIPELINE (PLANO B + avanço automático)
 *
 * Dashboard reconhece etapas:
 * ... "projeto_eletrico" ... "instalacao" ...
 *
 * Regras:
 * - enquanto engenharia NÃO terminou: pipeline_stage = "projeto_eletrico"
 * - quando engenharia terminou (completed) => pipeline_stage = "instalacao"
 *
 * Obs: se você quiser avançar também em "approved", basta manter engDone como abaixo.
 */
function pipelineUpdateForEngineering({ engineeringStatus, notes }) {
  const s = normalizeStatus(engineeringStatus);

  // ✅ quando terminar, avança etapa do pipeline
  const engDone = s === "completed" || s === "approved";
  const nextStage = engDone ? "instalacao" : "projeto_eletrico";

  const base = {
    pipeline_stage: nextStage,
    pipeline_substatus: s,
    pipeline_updated_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    pipeline_reason: "",
  };

  if (s === "revision_requested") {
    return {
      ...base,
      pipeline_stage: "projeto_eletrico", // revisão é engenharia ainda
      pipeline_reason: notes
        ? String(notes).trim().slice(0, 180)
        : "Revisão solicitada pela engenharia",
    };
  }

  // opcional: se quiser explicar a mudança quando concluir
  // if (s === "completed") {
  //   return { ...base, pipeline_reason: "Projeto elétrico concluído. Aguardando agendamento da instalação." };
  // }

  return base;
}

/**
 * ✅ resolve fotos: aceita URL direto ou storage_path
 */
async function resolvePhotoSrc(p) {
  if (!p) return null;
  const str = String(p);
  if (str.startsWith("http://") || str.startsWith("https://")) return str;
  try {
    const url = await getDownloadURL(storageRef(storage, str));
    return url;
  } catch {
    return null;
  }
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function pickMostRecentByKey(items, getKeyMillis) {
  if (!items?.length) return null;
  return items
    .slice()
    .sort((a, b) => (getKeyMillis(b) || 0) - (getKeyMillis(a) || 0))[0];
}

export default function EngineerProjects() {
  const { user } = useAuth();

  // lista / demanda
  const [loadingList, setLoadingList] = useState(false);
  const [families, setFamilies] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // seleção
  const [selected, setSelected] = useState(null); // { id, data }

  // contexto (visita + fotos)
  const [visitSummary, setVisitSummary] = useState(null);
  const [visitPhotos, setVisitPhotos] = useState([]); // [{src, name}]
  const [loadingVisit, setLoadingVisit] = useState(false);

  // edição do projeto
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  // último envio do projeto
  const [lastSentAt, setLastSentAt] = useState(null);

  // ✅ lightbox (modal) da galeria
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const selectedLabel = useMemo(() => {
    if (!selected) return "";
    const d = selected.data || {};
    return `${d.full_name || "Sem nome"} • ${d.cpf || "Sem CPF"}`;
  }, [selected]);

  // ✅ contadores por status
  const groupedCounts = useMemo(() => {
    const count = (st) =>
      families.filter((f) => normalizeStatus(f.data?.engineering_status) === st).length;

    return {
      all: families.length,
      pending: count("pending"),
      in_progress: count("in_progress"),
      submitted: count("submitted"),
      revision_requested: count("revision_requested"),
      approved: count("approved"),
      completed: count("completed"),
    };
  }, [families]);

  // ✅ aplica filtro + busca no client
  const filteredFamilies = useMemo(() => {
    const s = search.trim().toLowerCase();

    return families
      .filter((f) => {
        if (statusFilter === "all") return true;
        return normalizeStatus(f.data?.engineering_status) === statusFilter;
      })
      .filter((f) => {
        if (!s) return true;
        const d = f.data || {};
        const name = String(d.full_name || "").toLowerCase();
        const cpf = String(d.cpf || "");
        const phone = String(d.phone || "");
        const id = String(f.id || "").toLowerCase();
        return (
          name.includes(s) ||
          cpf.includes(search.trim()) ||
          phone.includes(search.trim()) ||
          id.includes(s)
        );
      });
  }, [families, search, statusFilter]);

  function openLightbox(idx) {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  function goPrev() {
    setLightboxIndex((i) => (i <= 0 ? 0 : i - 1));
  }

  function goNext() {
    setLightboxIndex((i) => (i >= visitPhotos.length - 1 ? i : i + 1));
  }

  async function loadFamilies() {
    setLoadingList(true);
    try {
      const famRef = collection(db, COL_FAMILY);

      const statusList = [
        "pending",
        "revision_requested",
        "in_progress",
        "submitted",
        "approved",
        "completed",
      ];

      const qy = query(famRef, where("engineering_status", "in", statusList), limit(500));
      const snap = await getDocs(qy);

      const list = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
      setFamilies(list);

      if (selected?.id && !list.some((x) => x.id === selected.id)) {
        setSelected(null);
        setVisitSummary(null);
        setVisitPhotos([]);
        setLastSentAt(null);
        setLightboxOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar demandas do engenheiro.");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadLatestProjectMeta(familyId) {
    try {
      const pRef = collection(db, COL_ENGINEERING);
      const pQ = query(pRef, where("family_id", "==", familyId), limit(50));
      const snap = await getDocs(pQ);

      if (snap.empty) {
        setLastSentAt(null);
        return;
      }

      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => {
        const ma = tsToMillis(a.sent_at) || tsToMillis(a.created_at) || tsToMillis(a.updated_at);
        const mb = tsToMillis(b.sent_at) || tsToMillis(b.created_at) || tsToMillis(b.updated_at);
        return mb - ma;
      });

      const d0 = all[0] || null;
      setLastSentAt(d0?.sent_at || d0?.created_at || null);
    } catch (err) {
      console.error(err);
      setLastSentAt(null);
    }
  }

  /**
   * ✅ BUSCA A ÚLTIMA VISITA EM TechnicalJobs (type=visit)
   */
  async function loadLatestVisit(familyId) {
    setLoadingVisit(true);
    try {
      const jRef = collection(db, COL_JOBS);

      const q1 = query(
        jRef,
        where("family_doc_id", "==", familyId),
        where("type", "==", "visit"),
        limit(50)
      );

      const q2 = query(
        jRef,
        where("family_id", "==", familyId),
        where("type", "==", "visit"),
        limit(50)
      );

      const q3 = query(
        jRef,
        where("family_uid", "==", familyId),
        where("type", "==", "visit"),
        limit(50)
      );

      const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);

      const map = new Map();
      s1.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
      s2.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
      s3.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));

      const all = Array.from(map.values());

      if (!all.length) {
        setVisitSummary(null);
        setVisitPhotos([]);
        return;
      }

      const latest = pickMostRecentByKey(all, (job) => {
        const exec = job?.execution || job?.exec || {};
        return (
          tsToMillis(exec?.updated_at) ||
          tsToMillis(job?.updated_at) ||
          tsToMillis(job?.scheduled_at) ||
          tsToMillis(job?.created_at)
        );
      });

      if (!latest) {
        setVisitSummary(null);
        setVisitPhotos([]);
        return;
      }

      const exec = latest.execution || latest.exec || {};

      const summary = {
        status: latest.status || exec.status || "scheduled",
        created_at: latest.created_at || latest.scheduled_at || null,
        updated_at: latest.updated_at || exec.updated_at || null,

        grid_voltage: exec.grid_voltage || "",
        roof_type: exec.roof_type || "",
        panel_area: exec.panel_area || "",
        meter_location: exec.meter_location || "",
        inverter_location: exec.inverter_location || "",
        notes: exec.notes || latest.notes || "",
        visit_result: exec.visit_result || "",
        visit_date: exec.visit_date || "",

        _raw_job: latest,
      };

      setVisitSummary(summary);

      const rawPhotos =
        (Array.isArray(exec?.photos) && exec.photos) ||
        (Array.isArray(exec?.images) && exec.images) ||
        (Array.isArray(exec?.photos_urls) && exec.photos_urls) ||
        (Array.isArray(latest?.photos) && latest.photos) ||
        (Array.isArray(latest?.images) && latest.images) ||
        [];

      const resolved = await Promise.all(
        rawPhotos.map(async (p, idx) => {
          const src = await resolvePhotoSrc(p);
          if (!src) return null;
          return { src, name: `Foto ${idx + 1}` };
        })
      );

      const finalPhotos = resolved.filter(Boolean);
      setVisitPhotos(finalPhotos);

      if (lightboxOpen) {
        setLightboxIndex((i) => Math.min(i, Math.max(finalPhotos.length - 1, 0)));
      }
    } catch (err) {
      console.error(err);
      setVisitSummary(null);
      setVisitPhotos([]);
    } finally {
      setLoadingVisit(false);
    }
  }

  async function selectFamily(item) {
    setSelected(item);
    setStatus(item.data?.engineering_status || "pending");
    setNotes("");
    setFiles([]);
    setVisitSummary(null);
    setVisitPhotos([]);
    setLastSentAt(null);
    setLightboxOpen(false);

    await Promise.all([loadLatestProjectMeta(item.id), loadLatestVisit(item.id)]);
  }

  
async function uploadSelectedFiles() {
  if (!selected?.id) {
    toast.error("Selecione uma família.");
    return;
  }
  if (!files?.length) {
    toast.error("Selecione ao menos 1 arquivo.");
    return;
  }

  setUploadingFiles(true);
  try {
    const uploaded = [];
    for (const f of files) {
      const safeName = String(f?.name || "arquivo");
      const url = await uploadFile(f, `engineering/${selected.id}/${Date.now()}_${safeName}`);
      uploaded.push({ name: safeName, url });
    }

    await callTechnicalFunction(
      "upsertEngineeringProject",
      {
        familyId: selected.id,
        status,
        notes: notes || "",
        files: uploaded,
        entryType: "project_upload",
      },
      user
    );

    toast.success("Arquivos enviados e registro criado!");
    setFiles([]);
    await Promise.all([loadLatestProjectMeta(selected.id), loadFamilies()]);
  } catch (err) {
    console.error(err);
    toast.error(err?.message || "Erro ao enviar arquivos do projeto.");
  } finally {
    setUploadingFiles(false);
  }
}

  
async function saveEngineeringMeta(nextStatus) {
  if (!selected?.id) {
    toast.error("Selecione uma família.");
    return;
  }

  const finalStatus = nextStatus || status;

  setSavingMeta(true);
  try {
    await callTechnicalFunction(
      "upsertEngineeringProject",
      {
        familyId: selected.id,
        status: finalStatus,
        notes: notes || "",
        files: [],
        entryType: "meta_update",
      },
      user
    );

    toast.success("Status/notas atualizados.");
    setStatus(finalStatus);
    await loadFamilies();
  } catch (err) {
    console.error(err);
    toast.error(err?.message || "Erro ao salvar status/notas.");
  } finally {
    setSavingMeta(false);
  }
}

  async function markCompleted() {
    await saveEngineeringMeta("completed");
  }

  useEffect(() => {
    loadFamilies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT */}
        <Card className="lg:col-span-1 h-[calc(100vh-120px)] flex flex-col">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>Demandas</CardTitle>
              <Button
                onClick={() => loadFamilies()}
                disabled={loadingList}
                size="sm"
                variant="outline"
              >
                {loadingList ? "..." : "Atualizar"}
              </Button>
            </div>

            {/* ✅ filtros com contadores */}
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => {
                const key = f.key;
                const total = key === "all" ? groupedCounts.all : groupedCounts[key] || 0;

                return (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={statusFilter === f.key ? "default" : "outline"}
                    onClick={() => setStatusFilter(f.key)}
                  >
                    {f.label}: {total}
                  </Button>
                );
              })}
            </div>

            <div className="space-y-1">
              <Label>Buscar</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, CPF, telefone..."
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Total filtrado: <b>{filteredFamilies.length}</b>
            </div>
          </CardHeader>

          <CardContent className="space-y-2 overflow-y-auto flex-1">
            {filteredFamilies.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma demanda encontrada.</div>
            ) : (
              <div className="space-y-2">
                {filteredFamilies.map((f) => {
                  const d = f.data || {};
                  const isActive = selected?.id === f.id;
                  const eng = normalizeStatus(d.engineering_status);

                  return (
                    <button
                      key={f.id}
                      onClick={() => selectFamily(f)}
                      className={[
                        "w-full text-left border rounded-lg p-3 transition",
                        isActive ? "bg-muted border-slate-300" : "hover:bg-muted",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{d.full_name || "Sem nome"}</div>
                        <span className={`text-[11px] px-2 py-1 rounded-full ${statusPillClass(eng)}`}>
                          {statusLabel(eng)}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground mt-1">
                        CPF: {d.cpf || "—"} • Tel: {d.phone || "—"}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary">visit: {d.visit_status || "—"}</Badge>
                        <Badge variant="secondary">overall: {d.overall_status || "—"}</Badge>
                        {d.pipeline_stage ? (
                          <Badge variant="secondary">
                            pipeline: {d.pipeline_stage}/{d.pipeline_substatus || "—"}
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT */}
        <div className="lg:col-span-2 space-y-4">
          {!selected?.id ? (
            <Card className="h-[calc(100vh-120px)]">
              <CardContent className="p-6">
                <div className="text-sm text-muted-foreground">
                  Selecione uma demanda no card à esquerda.
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Projeto • {selectedLabel}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="secondary">Família ID: {selected.id}</Badge>
                    <Badge>overall: {selected.data?.overall_status || "—"}</Badge>
                    <Badge className={statusPillClass(selected.data?.engineering_status)}>
                      eng: {statusLabel(selected.data?.engineering_status)}
                    </Badge>

                    <Badge variant="secondary">
                      último envio:{" "}
                      {lastSentAt?.toDate
                        ? lastSentAt.toDate().toLocaleString("pt-BR")
                        : selected.data?.engineering_last_sent_at?.toDate
                        ? selected.data.engineering_last_sent_at.toDate().toLocaleString("pt-BR")
                        : "—"}
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 items-start">
                    <div className="space-y-2">
                      <Label>Status da Engenharia</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENGINEERING_STATUS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingMeta || uploadingFiles}
                          onClick={() => saveEngineeringMeta(status)}
                        >
                          Salvar status/notas
                        </Button>

                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={savingMeta || uploadingFiles}
                          onClick={markCompleted}
                        >
                          Concluir
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        “Concluir” marca <b>engineering_status = completed</b> e avança o pipeline para{" "}
                        <b>instalacao</b>.
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Upload do Projeto (PDF/DWG/ART)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          multiple
                          onChange={(e) => setFiles(Array.from(e.target.files || []))}
                        />
                        <Button
                          type="button"
                          onClick={uploadSelectedFiles}
                          disabled={uploadingFiles || !files.length}
                        >
                          {uploadingFiles ? "Enviando..." : "Enviar"}
                        </Button>
                      </div>

                      {files.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {files.length} arquivo(s) selecionado(s)
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Dica: antes de enviar, deixe o status como <b>Enviado</b>.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Notas do engenheiro</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="requisitos, revisões, observações técnicas..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Última visita */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Última Visita Técnica</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadLatestVisit(selected.id)}
                    disabled={loadingVisit}
                  >
                    {loadingVisit ? "Carregando..." : "Recarregar"}
                  </Button>
                </CardHeader>

                <CardContent className="space-y-4">
                  {!visitSummary ? (
                    <div className="text-sm text-muted-foreground">
                      Nenhuma visita registrada para esta família.
                    </div>
                  ) : (
                    <>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="border rounded-lg p-3 space-y-1 text-sm">
                          <div>
                            Status: <b>{visitSummary.status || "—"}</b>
                          </div>
                          <div>Tensão: {visitSummary.grid_voltage || "—"}</div>
                          <div>Telhado: {visitSummary.roof_type || "—"}</div>
                          <div>Área (m²): {visitSummary.panel_area || "—"}</div>
                          <div>Medidor: {visitSummary.meter_location || "—"}</div>
                          <div>Inversor: {visitSummary.inverter_location || "—"}</div>
                          {visitSummary.visit_date ? (
                            <div>Data (execução): {visitSummary.visit_date}</div>
                          ) : null}
                          {visitSummary.visit_result ? (
                            <div>Resultado: {visitSummary.visit_result}</div>
                          ) : null}
                        </div>

                        <div className="border rounded-lg p-3 space-y-2">
                          <div className="text-sm font-medium">Observações</div>
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {visitSummary.notes || "—"}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Criado em:{" "}
                            {visitSummary.created_at?.toDate
                              ? visitSummary.created_at.toDate().toLocaleString("pt-BR")
                              : visitSummary.created_at
                              ? new Date(visitSummary.created_at).toLocaleString("pt-BR")
                              : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Fotos da visita</div>

                        {visitPhotos.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Nenhuma foto encontrada na visita.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {visitPhotos.map((p, idx) => (
                              <button
                                key={`${p.src}_${idx}`}
                                className="border rounded-lg overflow-hidden hover:opacity-90 transition"
                                onClick={() => openLightbox(idx)}
                                title="Ver em tela cheia"
                                type="button"
                              >
                                <img
                                  src={p.src}
                                  alt={p.name || `Foto ${idx + 1}`}
                                  className="w-full h-28 object-cover"
                                />
                                <div className="p-2 text-[11px] text-slate-600 truncate">
                                  {p.name || `Foto ${idx + 1}`}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ✅ LIGHTBOX MODAL */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Foto {visitPhotos.length ? lightboxIndex + 1 : 0} / {visitPhotos.length}
            </DialogTitle>
          </DialogHeader>

          {visitPhotos.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem imagem para exibir.</div>
          ) : (
            <div className="space-y-3">
              <div className="w-full border rounded-lg overflow-hidden bg-black">
                <img
                  src={visitPhotos[lightboxIndex]?.src}
                  alt={visitPhotos[lightboxIndex]?.name || "Foto"}
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={goPrev} disabled={lightboxIndex <= 0}>
                  Anterior
                </Button>

                <div className="text-sm text-muted-foreground truncate">
                  {visitPhotos[lightboxIndex]?.name || `Foto ${lightboxIndex + 1}`}
                </div>

                <Button
                  variant="outline"
                  onClick={goNext}
                  disabled={lightboxIndex >= visitPhotos.length - 1}
                >
                  Próxima
                </Button>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={closeLightbox}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

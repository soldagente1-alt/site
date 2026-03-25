import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Info,
  Home,
  X,
  Calendar,
  Loader2,
} from "lucide-react";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../../components/ui/tooltip";

const COL_FAMILY = "Family";
const COL_DOCS = "FamilyDocuments";
const PROJECT_ID = "soldagente-30f00";

const LGPD_PUBLIC_PATH = "/privacy-lgpd";
const BILLING_DUE_DAY_OPTIONS = [5, 10, 15, 20, 25];

const DOC_STATUS = {
  AGUARDANDO: "aguardando",
  INICIADO: "iniciado",
  ENVIADO: "enviado",
  APROVADO: "aprovado",
  REPROVADO: "reprovado",
};

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const MAX_FILES_TOTAL = 20;

const ENERGY_BILL_KEY = "conta_energia";
const ENERGY_BILL_REQUIRED_COUNT = 3;
const INCOME_PROOF_KEY = "comprovante_renda";
const PHOTO_FACADE_KEY = "foto_fachada";
const PHOTO_METER_KEY = "foto_medidor";

const TECH_DEFAULT = {
  meter_location: "externo",
  grid_voltage: "",
  roof_type: "",
  inverter_location: "",
};

const DECLARATIONS_DEFAULT = {
  confirmOwner: false,
  confirmTruth: false,
  confirmLGPD: false,
};

const METER_LOCATION_OPTIONS = [
  { value: "externo", label: "Externo (padrão)" },
  { value: "interno", label: "Interno" },
];

const GRID_VOLTAGE_OPTIONS = [
  { value: "110", label: "110V" },
  { value: "220", label: "220V" },
];

const ROOF_TYPE_OPTIONS = [
  { value: "ceramica", label: "Cerâmica" },
  { value: "fibrocimento", label: "Fibrocimento" },
  { value: "metalico", label: "Metálico" },
  { value: "laje", label: "Laje" },
  { value: "outro", label: "Outro" },
  { value: "nao_sei", label: "Não sei" },
];

const INVERTER_LOCATION_OPTIONS = [
  { value: "interno", label: "Interno" },
  { value: "garagem", label: "Garagem" },
  { value: "area_servico", label: "Área de serviço" },
  { value: "externo_coberto", label: "Externo coberto" },
  { value: "nao_sei", label: "Não sei" },
];

const DOC_TYPES = [
  { key: PHOTO_FACADE_KEY, label: "Foto da fachada da casa", required: true, minFiles: 1, kind: "photo" },
  { key: PHOTO_METER_KEY, label: "Foto do medidor/padrão", required: true, minFiles: 1, kind: "photo" },
  { key: "id_frente_verso", label: "Documento com foto (RG/CNH) — frente e verso", required: true, minFiles: 1, kind: "doc" },
  { key: "cpf", label: "CPF (se não estiver no RG)", required: false, minFiles: 1, kind: "doc" },
  { key: "comprovante_residencia", label: "Comprovante de residência (últimos 90 dias)", required: true, minFiles: 1, kind: "doc" },
  { key: INCOME_PROOF_KEY, label: "Comprovante de renda (obrigatório) — ex.: holerite, extrato, declaração", required: true, minFiles: 1, kind: "doc" },
  { key: ENERGY_BILL_KEY, label: "Conta de energia do imóvel (últimas 3 faturas)", required: true, minFiles: ENERGY_BILL_REQUIRED_COUNT, kind: "doc" },
  { key: "comprovante_posse", label: "Comprovação de posse do imóvel (ex.: escritura/registro/IPTU) — apenas proprietário", required: true, minFiles: 1, kind: "doc" },
];

function getFunctionsBase() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal
    ? `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`
    : `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;
}

async function callFunction(path, body) {
  const base = getFunctionsBase();
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  const resp = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error || data?.message || "Erro ao chamar Function";
    throw new Error(msg);
  }
  return data;
}

function normStr(v) {
  return String(v || "").trim().toLowerCase();
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

function statusBadge(status) {
  const s = normStr(status);
  if (s === DOC_STATUS.APROVADO) return { text: "Aprovado", cn: "bg-green-100 text-green-700" };
  if (s === DOC_STATUS.ENVIADO) return { text: "Enviado", cn: "bg-blue-100 text-blue-700" };
  if (s === DOC_STATUS.INICIADO) return { text: "Em andamento", cn: "bg-amber-100 text-amber-700" };
  if (s === DOC_STATUS.REPROVADO) return { text: "Reprovado", cn: "bg-rose-100 text-rose-700" };
  return { text: "Aguardando", cn: "bg-slate-100 text-slate-700" };
}

function formatDateTime(v) {
  if (!v) return "";
  try {
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : typeof v?.seconds === "number"
          ? new Date(v.seconds * 1000)
          : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR");
  } catch {
    return "";
  }
}

function getBillingDueDayFromFamily(family) {
  const d =
    (Number.isFinite(Number(family?.billing_due_day)) && Number(family?.billing_due_day)) ||
    (Number.isFinite(Number(family?.due_day)) && Number(family?.due_day)) ||
    null;

  if (!d) return null;
  if (d < 1 || d > 31) return null;
  return d;
}

function mergeItems(oldItems = [], patchItems = []) {
  const map = new Map();
  oldItems.forEach((it) => map.set(it.type, { ...it, files: Array.isArray(it.files) ? it.files : [] }));
  patchItems.forEach((it) => {
    const cur = map.get(it.type) || { type: it.type, files: [] };
    const nextFiles = [...(cur.files || []), ...(it.files || [])];
    map.set(it.type, { ...cur, files: nextFiles });
  });
  return Array.from(map.values());
}

function countAllFiles(items = []) {
  return items.reduce((acc, it) => acc + (Array.isArray(it.files) ? it.files.length : 0), 0);
}

function countTypeFiles(items = [], typeKey) {
  const it = (items || []).find((x) => x?.type === typeKey);
  return Array.isArray(it?.files) ? it.files.length : 0;
}

function acceptByType(typeKey) {
  if (typeKey === PHOTO_FACADE_KEY || typeKey === PHOTO_METER_KEY) return "image/*";
  return "application/pdf,image/*";
}

function technicalOk(t) {
  const tech = t || {};
  const meterOk = !!normStr(tech.meter_location);
  const voltageOk = tech.grid_voltage === "110" || tech.grid_voltage === "220";
  const roofOk = !!normStr(tech.roof_type);
  const inverterOk = !!normStr(tech.inverter_location);
  return meterOk && voltageOk && roofOk && inverterOk;
}

function missingTechnicalLabels(t) {
  const tech = t || {};
  const missing = [];
  if (!normStr(tech.meter_location)) missing.push("Local do medidor");
  if (!(tech.grid_voltage === "110" || tech.grid_voltage === "220")) missing.push("Voltagem");
  if (!normStr(tech.roof_type)) missing.push("Tipo do telhado");
  if (!normStr(tech.inverter_location)) missing.push("Local do inversor");
  return missing;
}

function isImageContentType(contentType = "", name = "") {
  const ct = String(contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return true;
  const n = String(name || "").toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp");
}

export default function FamilyDocuments() {
  const [user, setUser] = useState(null);
  const [family, setFamily] = useState(null);

  const [docRow, setDocRow] = useState(null);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [technical, setTechnical] = useState({ ...TECH_DEFAULT });
  const [declarations, setDeclarations] = useState({ ...DECLARATIONS_DEFAULT });

  const [billingDueDay, setBillingDueDay] = useState("10");
  const [savingDueDay, setSavingDueDay] = useState(false);

  const fileInputsRef = useRef({});
  const [picked, setPicked] = useState({});
  const [uploadProgress, setUploadProgress] = useState({ total: 0, done: 0, current: "" });
  const loadRunRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (u) => {
      const myRun = ++loadRunRef.current;

      if (!u) {
        setUser(null);
        setFamily(null);
        setDocRow(null);
        setTechnical({ ...TECH_DEFAULT });
        setDeclarations({ ...DECLARATIONS_DEFAULT });
        setLoading(false);
        return;
      }

      setUser(u);
      setLoading(true);

      try {
        await loadAll(u.uid, myRun, () => cancelled);
      } finally {
        if (!cancelled && myRun === loadRunRef.current) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  async function loadAll(uid, runId, isCancelled) {
    try {
      const famSnap = await getDoc(doc(db, COL_FAMILY, uid));
      if (isCancelled?.() || runId !== loadRunRef.current) return;

      if (!famSnap.exists()) {
        setFamily(null);
        setDocRow(null);
        setTechnical({ ...TECH_DEFAULT });
        setDeclarations({ ...DECLARATIONS_DEFAULT });
        return;
      }

      const fam = { id: famSnap.id, ...famSnap.data() };
      setFamily(fam);

      const due = getBillingDueDayFromFamily(fam);
      setBillingDueDay(due && due >= 1 && due <= 28 ? String(due) : "10");

      let docs = null;

      try {
        const direct = await getDoc(doc(db, COL_DOCS, uid));
        if (direct.exists()) docs = { id: direct.id, ...direct.data() };
      } catch {}

      if (!docs) {
        try {
          const qy = query(collection(db, COL_DOCS), where("family_id", "==", uid), limit(5));
          const snap = await getDocs(qy);
          if (!snap.empty) {
            const d = snap.docs[0];
            docs = { id: d.id, ...d.data() };
          }
        } catch {}
      }

      setDocRow(docs);
      setTechnical(docs?.technical ? { ...TECH_DEFAULT, ...(docs.technical || {}) } : { ...TECH_DEFAULT });
      setDeclarations(docs?.declarations ? { ...DECLARATIONS_DEFAULT, ...(docs.declarations || {}) } : { ...DECLARATIONS_DEFAULT });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar documentos.");
    }
  }

  async function refreshCurrent() {
    const uid = user?.uid || family?.id;
    if (!uid) return;
    await loadAll(uid, loadRunRef.current, () => false);
  }

  const badge = useMemo(() => statusBadge(docRow?.status), [docRow?.status]);
  const totalFiles = useMemo(() => countAllFiles(docRow?.items || []), [docRow?.items]);

  const lgpdAccepted = !!family?.lgpd_accepted || !!declarations?.confirmLGPD;
  const currentDueDay = getBillingDueDayFromFamily(family);
  const dueDayIsSaved = !!currentDueDay && currentDueDay >= 1 && currentDueDay <= 28;
  const techIsOk = useMemo(() => technicalOk(technical), [technical]);
  const techMissing = useMemo(() => missingTechnicalLabels(technical), [technical]);

  const anyPickedCount = useMemo(() => {
    return Object.values(picked || {}).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
  }, [picked]);

  function pickFiles(typeKey, filesArr) {
    const files = Array.from(filesArr || []);
    if (!files.length) return;

    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error(`Arquivo acima de ${MAX_MB}MB: ${tooBig.name}`);
      return;
    }

    if (typeKey === ENERGY_BILL_KEY) {
      const alreadyUploaded = countTypeFiles(docRow?.items || [], ENERGY_BILL_KEY);
      const alreadyPicked = (picked[ENERGY_BILL_KEY] || []).length;
      const remaining = ENERGY_BILL_REQUIRED_COUNT - alreadyUploaded - alreadyPicked;

      if (remaining <= 0) {
        toast.error("Limite atingido: já temos as 3 últimas contas de energia.");
        return;
      }

      const sliced = files.slice(0, remaining);
      if (sliced.length < files.length) {
        toast.message(`Você pode adicionar no máximo ${remaining} arquivo(s) para completar as 3 contas.`);
      }

      setPicked((prev) => {
        const cur = prev[typeKey] || [];
        return { ...prev, [typeKey]: [...cur, ...sliced] };
      });

      return;
    }

    setPicked((prev) => {
      const cur = prev[typeKey] || [];
      return { ...prev, [typeKey]: [...cur, ...files] };
    });
  }

  function clearPicked(typeKey) {
    setPicked((prev) => ({ ...prev, [typeKey]: [] }));
  }

  function clearAllPicked() {
    setPicked({});
  }

  function removePickedFile(typeKey, idx) {
    setPicked((prev) => {
      const cur = Array.isArray(prev?.[typeKey]) ? [...prev[typeKey]] : [];
      cur.splice(idx, 1);
      return { ...prev, [typeKey]: cur };
    });
  }

  function currentItemsMap(items = []) {
    const map = new Map();
    (items || []).forEach((it) => map.set(it.type, it));
    return map;
  }

  async function saveDueDay() {
    if (!family?.id) return toast.error("Família não encontrada.");

    const d = Number(billingDueDay);
    if (!BILLING_DUE_DAY_OPTIONS.includes(d)) {
      toast.error("Selecione um dia de vencimento válido (5, 10, 15, 20 ou 25).");
      return;
    }

    try {
      setSavingDueDay(true);
      await callFunction("familySaveDocumentsForm", { billingDueDay: d });
      await refreshCurrent();
      toast.success("Dia de vencimento salvo.");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível salvar o vencimento.");
    } finally {
      setSavingDueDay(false);
    }
  }

  async function saveTechnicalOnly() {
    try {
      if (!family?.id) return toast.error("Família não encontrada.");
      setSaving(true);
      await callFunction("familySaveDocumentsForm", { technical: { ...TECH_DEFAULT, ...(technical || {}) } });
      await refreshCurrent();
      toast.success("Informações do imóvel salvas.");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível salvar as informações do imóvel.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDeclaration(key) {
    try {
      if (!family?.id) return;
      const prev = { ...declarations };
      const next = { ...prev, [key]: !prev[key] };

      setDeclarations(next);
      setSaving(true);

      await callFunction("familySaveDocumentsForm", {
        declarations: next,
      });

      await refreshCurrent();
    } catch (e) {
      console.error(e);
      setDeclarations((prev) => ({ ...prev, [key]: !prev[key] }));
      toast.error(e?.message || "Não foi possível atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAllPicked() {
    try {
      if (!family?.id) return toast.error("Família não encontrada.");
      if (!dueDayIsSaved) return toast.error("Primeiro selecione e salve o dia de vencimento.");
      if (!technicalOk(technical)) {
        return toast.error(`Complete as informações do imóvel: ${missingTechnicalLabels(technical).join(", ")}.`);
      }
      if (!declarations.confirmOwner || !declarations.confirmTruth || !declarations.confirmLGPD) {
        return toast.error("Marque todas as declarações obrigatórias antes de enviar.");
      }
      if (!anyPickedCount) return toast.message("Nenhum arquivo selecionado.");

      setSaving(true);
      setUploading(true);

      const familyId = family.id;
      const baseItems = Array.isArray(docRow?.items) ? docRow.items : [];

      const currentTotal = countAllFiles(baseItems);
      const nextTotal = currentTotal + anyPickedCount;
      if (nextTotal > MAX_FILES_TOTAL) {
        toast.error(`Limite de ${MAX_FILES_TOTAL} arquivos no total.`);
        return;
      }

      const energyUploaded = countTypeFiles(baseItems, ENERGY_BILL_KEY);
      const energyPicked = (picked?.[ENERGY_BILL_KEY] || []).length;
      if (energyUploaded + energyPicked > ENERGY_BILL_REQUIRED_COUNT) {
        toast.error("Conta de energia: envie somente as 3 últimas faturas.");
        return;
      }

      const patchItems = [];
      const keys = Object.keys(picked || {}).filter((k) => (picked[k] || []).length);

      const total = anyPickedCount;
      let done = 0;
      setUploadProgress({ total, done: 0, current: "" });

      for (const typeKey of keys) {
        const files = picked[typeKey] || [];
        const uploadedFiles = [];

        for (const file of files) {
          setUploadProgress({ total, done, current: file?.name || "" });

          const safeName = String(file.name || "arquivo").replace(/[^\w.\-]+/g, "_");
          const path = `familyDocuments/${familyId}/${typeKey}/${Date.now()}_${safeName}`;
          const r = storageRef(storage, path);

          await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
          const url = await getDownloadURL(r);

          uploadedFiles.push({
            name: file.name,
            url,
            size: file.size,
            contentType: file.type || "",
            uploaded_at: new Date().toISOString(),
            path,
          });

          done += 1;
          setUploadProgress({ total, done, current: file?.name || "" });
        }

        if (uploadedFiles.length) patchItems.push({ type: typeKey, files: uploadedFiles });
      }

      await callFunction("familySubmitDocumentsBatch", {
        uploadedItems: patchItems,
        technical: { ...TECH_DEFAULT, ...(technical || {}) },
        declarations: { ...DECLARATIONS_DEFAULT, ...(declarations || {}) },
      });

      clearAllPicked();
      await refreshCurrent();
      toast.success("Documentação enviada para análise ✅");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Falha ao enviar arquivos.");
    } finally {
      setUploadProgress({ total: 0, done: 0, current: "" });
      setUploading(false);
      setSaving(false);
    }
  }

  async function deleteUploadedFile(typeKey, idx) {
    try {
      if (!family?.id) return;

      const items = Array.isArray(docRow?.items) ? docRow.items : [];
      const map = currentItemsMap(items);
      const it = map.get(typeKey);
      const files = Array.isArray(it?.files) ? [...it.files] : [];
      const target = files[idx];
      if (!target?.path) return;

      setSaving(true);

      await callFunction("familyDeleteDocumentFile", {
        typeKey,
        path: target.path,
      });

      await refreshCurrent();
      toast.success("Arquivo removido.");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível excluir o arquivo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Carregando...</h2>
        <p className="text-slate-500">Buscando informações de documentação.</p>
      </div>
    );
  }

  if (!user || !family) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Acesso restrito</h2>
        <p className="text-slate-500">Faça login para enviar sua documentação.</p>
      </div>
    );
  }

  const itemsByType = new Map();
  (docRow?.items || []).forEach((it) => itemsByType.set(it.type, it));

  function renderUploadedFileRow(typeKey, f, idx) {
    const isImg = isImageContentType(f?.contentType, f?.name);

    return (
      <div key={`${f.url || f.name}_${idx}`} className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center overflow-hidden shrink-0">
            {isImg && f?.url ? (
              <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
            ) : (
              <FileText className="h-4 w-4 text-slate-500" />
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate font-medium text-slate-800">{f?.name || "Arquivo"}</div>
            <div className="text-xs text-slate-500">{prettyBytes(f?.size)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {f?.url ? (
            <a className="text-xs text-blue-600 hover:underline" href={f.url} target="_blank" rel="noreferrer">
              Abrir
            </a>
          ) : (
            <span className="text-xs text-slate-400">Sem link</span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 rounded-xl text-rose-700 hover:text-rose-800 hover:bg-rose-50"
            onClick={() => deleteUploadedFile(typeKey, idx)}
            disabled={saving || uploading || savingDueDay}
            title="Excluir arquivo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  function renderPickedChips(typeKey) {
    const files = picked?.[typeKey] || [];
    if (!files.length) return null;

    return (
      <div className="flex flex-wrap gap-2 pt-2">
        {files.map((f, idx) => (
          <div key={`${f.name}_${idx}`} className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-xs bg-slate-50">
            <span className="max-w-[220px] truncate">{f.name}</span>
            <span className="text-slate-400">{prettyBytes(f.size)}</span>
            <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => removePickedFile(typeKey, idx)} title="Remover da seleção">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderDocTypeCard(d) {
    const it = itemsByType.get(d.key);
    const files = it?.files || [];
    const need = d.minFiles || 1;
    const ok = files.length >= need;
    const selectedCount = (picked?.[d.key] || []).length;

    return (
      <div key={d.key} className="border rounded-2xl p-4 bg-white space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="font-medium text-slate-800">
              {d.label} {d.required ? <span className="text-rose-600">*</span> : null}
            </div>
            <div className="text-xs text-slate-500">
              {files.length ? `${files.length} enviado(s)` : "Nenhum enviado"}
              {d.key === ENERGY_BILL_KEY ? <span className="text-slate-400"> • necessário: {ENERGY_BILL_REQUIRED_COUNT}</span> : null}
              {selectedCount ? <span className="text-slate-400"> • selecionado: {selectedCount}</span> : null}
            </div>
          </div>

          {ok ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          ) : d.required ? (
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          ) : (
            <div className="h-5 w-5" />
          )}
        </div>

        {files.length ? (
          <div className="border bg-slate-50 rounded-xl p-3 space-y-2">
            {files.map((f, idx) => renderUploadedFileRow(d.key, f, idx))}
          </div>
        ) : null}

        <div className="pt-1">
          <Label className="text-xs text-slate-500">
            Adicionar arquivo(s)
            {d.key === ENERGY_BILL_KEY ? <span className="text-slate-400"> (máx. {ENERGY_BILL_REQUIRED_COUNT})</span> : null}
            {d.kind === "photo" ? <span className="text-slate-400"> (foto)</span> : null}
          </Label>

          <input
            ref={(el) => (fileInputsRef.current[d.key] = el)}
            type="file"
            multiple
            accept={acceptByType(d.key)}
            className="hidden"
            onChange={(e) => {
              pickFiles(d.key, e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => fileInputsRef.current[d.key]?.click()} disabled={saving || uploading || savingDueDay || !dueDayIsSaved}>
              <Upload className="h-4 w-4 mr-2" />
              Selecionar
            </Button>

            {selectedCount ? (
              <Button type="button" variant="ghost" className="rounded-xl" onClick={() => clearPicked(d.key)} disabled={saving || uploading || savingDueDay}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar seleção
              </Button>
            ) : null}
          </div>

          {renderPickedChips(d.key)}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={140}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Documentação</h1>
            <p className="text-sm text-slate-500">
              Selecione tudo que precisar e envie <b>de uma vez</b>.
            </p>

            {uploading && uploadProgress.total ? (
              <div className="mt-2 text-xs text-slate-600">
                Enviando: <b>{uploadProgress.done}</b> / <b>{uploadProgress.total}</b>{" "}
                {uploadProgress.current ? <span className="text-slate-400">• {uploadProgress.current}</span> : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={badge.cn}>{badge.text}</Badge>

            <Button
              className="rounded-xl"
              onClick={uploadAllPicked}
              disabled={saving || uploading || savingDueDay || !dueDayIsSaved || !anyPickedCount}
              title={!dueDayIsSaved ? "Primeiro salve o dia de vencimento" : ""}
            >
              <Upload className="h-4 w-4 mr-2" />
              Enviar arquivos selecionados ({anyPickedCount || 0})
            </Button>

            {anyPickedCount ? (
              <Button variant="ghost" className="rounded-xl" onClick={clearAllPicked} disabled={saving || uploading || savingDueDay}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar tudo
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              Dia de vencimento (obrigatório)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">
                  Escolha o dia do mês <span className="text-rose-600">*</span>
                </Label>
                <Select value={String(billingDueDay || "")} onValueChange={(v) => setBillingDueDay(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_DUE_DAY_OPTIONS.map((d) => (
                      <SelectItem key={String(d)} value={String(d)}>
                        Dia {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-slate-500">
                  {dueDayIsSaved ? (
                    <>Vencimento salvo: <b>dia {currentDueDay}</b>.</>
                  ) : (
                    <>Selecione e clique em <b>Salvar vencimento</b> para continuar.</>
                  )}
                </div>
              </div>

              <div className="flex md:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl w-full md:w-auto"
                  onClick={saveDueDay}
                  disabled={saving || uploading || savingDueDay || !billingDueDay}
                >
                  {savingDueDay ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar vencimento
                </Button>
              </div>
            </div>

            {!dueDayIsSaved ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                Para enviar a documentação, primeiro defina o dia de vencimento. Isso será usado para gerar suas cobranças.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4 text-slate-500" />
              Informações do imóvel (obrigatório)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
              <div className="border rounded-2xl p-4 bg-white space-y-2">
                <Label className="text-sm text-slate-700 flex items-center gap-2">
                  Local do medidor/padrão <span className="text-rose-600">*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex items-center text-slate-400 hover:text-slate-600">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px]">
                      <p className="text-xs text-slate-700">Informe onde fica o padrão/medidor de energia.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>

                <Select value={technical?.meter_location || "externo"} onValueChange={(v) => setTechnical((p) => ({ ...(p || {}), meter_location: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {METER_LOCATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-2xl p-4 bg-white space-y-2">
                <Label className="text-sm text-slate-700 flex items-center gap-2">
                  Voltagem da rede <span className="text-rose-600">*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex items-center text-slate-400 hover:text-slate-600">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px]">
                      <p className="text-xs text-slate-700">Você encontra essa informação na conta de energia.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>

                <Select value={technical?.grid_voltage || ""} onValueChange={(v) => setTechnical((p) => ({ ...(p || {}), grid_voltage: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione (110/220)" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRID_VOLTAGE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-2xl p-4 bg-white space-y-2">
                <Label className="text-sm text-slate-700 flex items-center gap-2">
                  Tipo do telhado <span className="text-rose-600">*</span>
                </Label>

                <Select value={technical?.roof_type || ""} onValueChange={(v) => setTechnical((p) => ({ ...(p || {}), roof_type: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOF_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-2xl p-4 bg-white space-y-2">
                <Label className="text-sm text-slate-700 flex items-center gap-2">
                  Local do inversor <span className="text-rose-600">*</span>
                </Label>

                <Select value={technical?.inverter_location || ""} onValueChange={(v) => setTechnical((p) => ({ ...(p || {}), inverter_location: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVERTER_LOCATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-slate-600">
                {techIsOk ? (
                  <span className="inline-flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> Informações completas.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> Preencha: <b>{techMissing.join(", ")}</b>.
                  </span>
                )}
              </div>

              <Button type="button" variant="outline" className="rounded-xl" onClick={saveTechnicalOnly} disabled={saving || uploading || savingDueDay}>
                Salvar informações
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              Arquivos e fotos (um embaixo do outro)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600 flex items-center gap-2">
              <span>Total enviados:</span>
              <b>{totalFiles}</b>
              <span className="text-slate-400">/ {MAX_FILES_TOTAL}</span>
              {anyPickedCount ? <span className="text-slate-400"> • selecionados agora: <b>{anyPickedCount}</b></span> : null}
            </div>

            <div className="space-y-3">{DOC_TYPES.map((d) => renderDocTypeCard(d))}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Declarações e envio
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="border rounded-2xl p-4 bg-slate-50 space-y-3">
              <div className="font-medium text-slate-800">Declarações (obrigatórias)</div>

              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={!!declarations?.confirmOwner} onChange={() => toggleDeclaration("confirmOwner")} />
                <span>Confirmo que sou o <b>proprietário</b> do imóvel.</span>
              </label>

              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={!!declarations?.confirmTruth} onChange={() => toggleDeclaration("confirmTruth")} />
                <span>Confirmo que as informações e documentos enviados são verdadeiros.</span>
              </label>

              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={lgpdAccepted}
                  disabled={!!family?.lgpd_accepted}
                  onChange={() => toggleDeclaration("confirmLGPD")}
                />
                <span>
                  Li e aceito os termos da <b>LGPD</b>.{" "}
                  <button type="button" className="text-blue-600 hover:underline inline-flex items-center gap-1" onClick={() => window.open(LGPD_PUBLIC_PATH, "_blank")}>
                    Ler termos <ExternalLink className="h-3 w-3" />
                  </button>
                </span>
              </label>

              <div className="text-xs text-slate-600">
                Ao clicar em <b>Enviar arquivos selecionados</b>, sua documentação é enviada para análise.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 flex-wrap">
              <Button
                className="rounded-xl"
                onClick={uploadAllPicked}
                disabled={saving || uploading || savingDueDay || !dueDayIsSaved || !anyPickedCount}
              >
                <Upload className="h-4 w-4 mr-2" />
                Enviar arquivos selecionados ({anyPickedCount || 0})
              </Button>

              {anyPickedCount ? (
                <Button
                  variant="ghost"
                  className="rounded-xl"
                  onClick={clearAllPicked}
                  disabled={saving || uploading || savingDueDay}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar tudo
                </Button>
              ) : null}
            </div>

            {(() => {
              const ts = docRow?.submitted_at_client || docRow?.submitted_at;
              const txt = formatDateTime(ts);
              if (!txt) return null;
              return (
                <div className="mt-2 text-xs text-slate-500 text-right">
                  Último envio para análise: <b>{txt}</b>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";

import {
  BadgeCheck,
  CheckCircle2,
  CopyPlus,
  Download,
  FileCode2,
  FileText,
  Filter,
  History,
  Info,
  LayoutGrid,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

/* =========================
   HELPERS
========================= */
const PAGE_SEPARATOR = "\n\n===== PÁGINA =====\n\n";
const DEFAULT_RENDERER = "FamilyContractView";
const DEFAULT_TITLE = "Contrato padrão - Sol da Gente";
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
  const token = await auth.currentUser?.getIdToken?.();

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

function searchParamValue(params, keys, fallback = "") {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function getAnyGroupIdFromFamily(obj) {
  return (
    obj?.group_participant_group_id ||
    obj?.open_group_id ||
    obj?.group_id ||
    obj?.id_group ||
    obj?.groupId ||
    obj?.groupID ||
    null
  );
}

function getFamilyFranchiseId(family, groupIndex) {
  const gid = getAnyGroupIdFromFamily(family);
  const group = gid ? groupIndex.get(String(gid)) || null : null;
  return String(
    family?.franchise_id ||
      family?.franchiseId ||
      group?.franchise_id ||
      group?.franchiseId ||
      ""
  ).trim();
}

function sanitizeFileName(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function statusNormalize(s = "") {
  return String(s || "").trim().toLowerCase();
}

function statusLabel(s) {
  const v = statusNormalize(s);
  if (v === "validated" || v === "approved") return "validado";
  if (v === "signed_uploaded") return "assinado";
  if (v === "pending_signature") return "pendente";
  if (v === "rejected" || v === "refused" || v === "denied") return "recusado";
  return v || "pendente";
}

function statusBadgeClass(s) {
  const v = statusNormalize(s);
  if (v === "validated" || v === "approved") return "bg-emerald-100 text-emerald-700";
  if (v === "signed_uploaded") return "bg-blue-100 text-blue-700";
  if (v === "pending_signature") return "bg-amber-100 text-amber-700";
  if (v === "rejected" || v === "refused" || v === "denied") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function normStr(v) {
  return String(v || "").trim().toLowerCase();
}

function templateSource(template) {
  const explicit = normStr(template?.source_type);
  if (explicit) return explicit;
  if (template?.renderer_key || template?.view_key || template?.component_name) return "jsx";
  if (template?.storage_path) return "pdf";
  return "jsx";
}

function templateSourceLabel(template) {
  return templateSource(template) === "pdf" ? "PDF" : "JSX";
}

function templateRendererLabel(template) {
  if (templateSource(template) === "pdf") return "Arquivo PDF";
  return template?.renderer_key || template?.view_key || template?.component_name || DEFAULT_RENDERER;
}

function versionLabel(template) {
  return (
    String(template?.version || template?.template_version || template?.view_version || "v?").trim() || "v?"
  );
}

function contractTemplateSource(contract) {
  const explicit = normStr(contract?.template_source || contract?.source_type || contract?.render_source);
  if (explicit) return explicit;
  if (contract?.renderer_key || contract?.view_key || contract?.view_version) return "jsx";
  if (contract?.generated_storage_path) return "pdf";
  return "jsx";
}

function normalizePagesArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    const s = value.trim();
    return s ? [s] : [];
  }
  return [];
}

function extractSnapshotPages(source) {
  if (!source || typeof source !== "object") return [];

  const candidates = [
    source.template_snapshot_pages,
    source.render_snapshot_pages,
    source.snapshot_pages,
    source.body_pages,
    source.contract_pages,
    source.template_snapshot?.body_pages,
    source.template_snapshot?.pages,
    source.render_snapshot?.body_pages,
    source.render_snapshot?.pages,
    source.snapshot?.body_pages,
    source.snapshot?.pages,
  ];

  for (const candidate of candidates) {
    const pages = normalizePagesArray(candidate);
    if (pages.length) return pages;
  }

  return [];
}

function joinPagesForEditor(pages) {
  return normalizePagesArray(pages).join(PAGE_SEPARATOR);
}

function parsePagesEditor(text) {
  const raw = String(text || "").replace(/\r/g, "").trim();
  if (!raw) return [];

  return raw
    .split(/\n\s*={3,}\s*PÁGINA\s*={3,}\s*\n/gi)
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

function countPagesFromTemplate(template) {
  return extractSnapshotPages(template).length;
}

function simpleVersionBump(currentVersion) {
  const current = String(currentVersion || "").trim();
  if (!current) return "v1";

  const match = current.match(/^(.*?)(\d+)$/);
  if (!match) return `${current}_2`;

  const prefix = match[1] || "v";
  const number = String(Number(match[2]) + 1);
  return `${prefix}${number}`;
}

function isContractOutdated(contract, activeTemplate) {
  if (!activeTemplate) return false;

  const activeVersion = versionLabel(activeTemplate);
  const contractVersion = versionLabel(contract);
  const sourceChanged = contractTemplateSource(contract) !== templateSource(activeTemplate);

  return sourceChanged || contractVersion !== activeVersion;
}

function canRefreshContract(contract) {
  const st = statusNormalize(contract?.status);
  return !st || st === "pending_signature" || st === "rejected" || st === "refused" || st === "denied";
}

function isSignedContract(contract) {
  const st = statusNormalize(contract?.status);
  return st === "signed_uploaded" || !!contract?.signed_storage_path;
}

function isValidatedContract(contract) {
  const st = statusNormalize(contract?.status);
  return st === "validated" || st === "approved";
}

function getGeneratedContractStoragePath(contract) {
  return String(
    contract?.generated_storage_path || contract?.generated_pdf_storage_path || contract?.template_storage_path || ""
  ).trim();
}

function getGeneratedContractUrl(contract) {
  return String(contract?.generated_url || contract?.generated_pdf_url || "").trim();
}

function getSignedContractStoragePath(contract) {
  return String(contract?.signed_storage_path || contract?.signed_pdf_storage_path || "").trim();
}

function getSignedContractUrl(contract) {
  return String(contract?.signed_url || contract?.signed_pdf_url || "").trim();
}

function getValidatedContractStoragePath(contract) {
  return String(
    contract?.validated_storage_path ||
      contract?.final_storage_path ||
      contract?.approved_storage_path ||
      getSignedContractStoragePath(contract) ||
      ""
  ).trim();
}

function getValidatedContractUrl(contract) {
  return String(
    contract?.validated_url ||
      contract?.final_url ||
      contract?.approved_url ||
      getSignedContractUrl(contract) ||
      ""
  ).trim();
}

function hasGeneratedContractFile(contract) {
  return !!(getGeneratedContractStoragePath(contract) || getGeneratedContractUrl(contract));
}

function hasSignedContractFile(contract) {
  return !!(getSignedContractStoragePath(contract) || getSignedContractUrl(contract));
}

function hasValidatedContractFile(contract) {
  return !!(getValidatedContractStoragePath(contract) || getValidatedContractUrl(contract));
}

function recommendedAction(contract, activeTemplate) {
  const outdated = isContractOutdated(contract, activeTemplate);
  if (isValidatedContract(contract)) {
    return { text: "Sem ação operacional", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (isSignedContract(contract) && !isValidatedContract(contract)) {
    return { text: "Validar ou recusar", tone: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (outdated && canRefreshContract(contract)) {
    return { text: "Atualizar versão", tone: "bg-amber-50 text-amber-800 border-amber-200" };
  }
  if (statusNormalize(contract?.status) === "rejected") {
    return { text: "Aguardar novo envio", tone: "bg-red-50 text-red-700 border-red-200" };
  }
  return { text: "Acompanhar", tone: "bg-slate-50 text-slate-700 border-slate-200" };
}

function metricTone(key) {
  if (key === "pending") return "bg-amber-50 border-amber-200";
  if (key === "signed") return "bg-blue-50 border-blue-200";
  if (key === "rejected") return "bg-red-50 border-red-200";
  if (key === "validated") return "bg-emerald-50 border-emerald-200";
  return "bg-slate-50 border-slate-200";
}

function ContractMetricCard({ label, value, helper, tone = "bg-slate-50 border-slate-200", icon: Icon }) {
  return (
    <Card className={`border ${tone}`}>
      <CardContent className="px-3 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/70 border flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-slate-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 whitespace-nowrap">{label}</span>
              {helper ? <span className="text-[11px] text-slate-500 truncate">• {helper}</span> : null}
            </div>
          </div>
        </div>
        <div className="text-xl font-bold text-slate-900 shrink-0">{value}</div>
      </CardContent>
    </Card>
  );
}

function SectionSwitch({ activeTab, setActiveTab }) {
  const items = [
    { key: "operacao", label: "Operação", icon: LayoutGrid },
    { key: "versoes", label: "Versões", icon: FileCode2 },
    { key: "auditoria", label: "Auditoria", icon: History },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.key;
        return (
          <Button
            key={item.key}
            variant={active ? "default" : "outline"}
            className={active ? "bg-slate-900 hover:bg-slate-800" : ""}
            onClick={() => setActiveTab(item.key)}
          >
            <Icon className="w-4 h-4 mr-2" />
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}

export default function AdminContract() {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [groups, setGroups] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urlGroupFilter, setUrlGroupFilter] = useState("all");
  const [urlFranchiseFilter, setUrlFranchiseFilter] = useState("all");
  const [urlSourceFilter, setUrlSourceFilter] = useState("all");
  const [urlVersionFilter, setUrlVersionFilter] = useState("");
  const [urlFamilyFilter, setUrlFamilyFilter] = useState("");
  const [activeTab, setActiveTab] = useState("operacao");

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [templateTitle, setTemplateTitle] = useState(DEFAULT_TITLE);
  const [templateVersion, setTemplateVersion] = useState("v1");
  const [rendererKey, setRendererKey] = useState(DEFAULT_RENDERER);
  const [changeSummary, setChangeSummary] = useState("");
  const [bodyPagesText, setBodyPagesText] = useState("");
  const [applyPendingOnPublish, setApplyPendingOnPublish] = useState(true);

  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [rowUpdatingId, setRowUpdatingId] = useState("");

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingContract, setRejectingContract] = useState(null);
  const [validationNote, setValidationNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const familyIndex = useMemo(() => {
    const map = new Map();
    families.forEach((f) => map.set(f.id, f));
    return map;
  }, [families]);

  const groupIndex = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => map.set(String(g.id), g));
    return map;
  }, [groups]);

  const groupFilterOptions = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => {
      const id = String(g.id || "").trim();
      if (!id) return;
      map.set(id, {
        value: id,
        label: g?.name ? `${g.name} • ${id}` : id,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [groups]);

  const activeTemplate = useMemo(() => templates.find((t) => t.active), [templates]);
  const editorPages = useMemo(() => parsePagesEditor(bodyPagesText), [bodyPagesText]);

  async function loadAll({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [tplSnap, ctrSnap, famSnap, groupSnap] = await Promise.all([
        getDocs(query(collection(db, "ContractTemplates"), orderBy("created_at", "desc"))),
        getDocs(query(collection(db, "FamilyContracts"), orderBy("generated_at", "desc"))),
        getDocs(collection(db, "Family")),
        getDocs(collection(db, "Group")),
      ]);

      setTemplates(tplSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setContracts(ctrSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFamilies(famSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setGroups(groupSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Erro ao carregar AdminContract:", err);
      toast.error("Erro ao carregar dados do contrato");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const nextSearch = searchParamValue(params, ["q", "search"], "");
    const nextStatus =
      params.get("outdated") === "1"
        ? "outdated"
        : searchParamValue(params, ["status", "contractStatus"], "all");
    const nextGroup = searchParamValue(params, ["groupId", "group", "gid"], "all");
    const nextFranchise = searchParamValue(params, ["franchiseId", "franchise", "fid"], "all");
    const nextSource = searchParamValue(params, ["source", "templateSource"], "all");
    const nextVersion = searchParamValue(params, ["version", "templateVersion"], "");
    const nextFamily = searchParamValue(params, ["familyId", "family", "id"], "");

    setSearch(nextSearch);
    setStatusFilter(nextStatus || "all");
    setUrlGroupFilter(nextGroup || "all");
    setUrlFranchiseFilter(nextFranchise || "all");
    setUrlSourceFilter(nextSource || "all");
    setUrlVersionFilter(nextVersion);
    setUrlFamilyFilter(nextFamily);
  }, [location.search]);

  function openPublishModalPrefilled() {
    const basePages = extractSnapshotPages(activeTemplate);
    setTemplateTitle(String(activeTemplate?.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE);
    setTemplateVersion(simpleVersionBump(versionLabel(activeTemplate)));
    setRendererKey(String(templateRendererLabel(activeTemplate) || DEFAULT_RENDERER).trim() || DEFAULT_RENDERER);
    setChangeSummary("");
    setBodyPagesText(joinPagesForEditor(basePages));
    setApplyPendingOnPublish(true);
    setShowPublishModal(true);
  }

  function duplicateTemplateToEditor(template) {
    setTemplateTitle(String(template?.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE);
    setTemplateVersion(simpleVersionBump(versionLabel(template)));
    setRendererKey(String(templateRendererLabel(template) || DEFAULT_RENDERER).trim() || DEFAULT_RENDERER);
    setChangeSummary(String(template?.change_summary || "").trim());
    setBodyPagesText(joinPagesForEditor(extractSnapshotPages(template)));
    setApplyPendingOnPublish(true);
    setShowPublishModal(true);
  }

  async function openStoragePdf(storagePath, directUrl = "") {
    try {
      if (storagePath) {
        const url = await getDownloadURL(storageRef(storage, storagePath));
        window.open(url, "_blank");
        return;
      }

      if (directUrl) {
        window.open(directUrl, "_blank");
        return;
      }

      toast.error("Arquivo sem caminho salvo");
    } catch (err) {
      console.error("Erro ao abrir PDF:", err);
      toast.error("Erro ao abrir PDF");
    }
  }

  async function openGeneratedContract(contract) {
    await openStoragePdf(getGeneratedContractStoragePath(contract), getGeneratedContractUrl(contract));
  }

  async function openSignedContract(contract) {
    await openStoragePdf(getSignedContractStoragePath(contract), getSignedContractUrl(contract));
  }

  async function openValidatedContract(contract) {
    await openStoragePdf(getValidatedContractStoragePath(contract), getValidatedContractUrl(contract));
  }

  async function publishJsxTemplate() {
    const version = String(templateVersion || "").trim();
    const title = String(templateTitle || "").trim() || DEFAULT_TITLE;
    const renderer = String(rendererKey || "").trim() || DEFAULT_RENDERER;
    const pages = parsePagesEditor(bodyPagesText);
    const summary = String(changeSummary || "").trim();

    if (!version) {
      toast.error("Informe a versão do contrato.");
      return;
    }

    if (!pages.length) {
      toast.error("Cole o conteúdo do contrato e separe as páginas com ===== PÁGINA =====.");
      return;
    }

    if (pages.some((page) => page.length < 40)) {
      toast.error("Há página muito curta no snapshot. Revise o conteúdo antes de publicar.");
      return;
    }

    setPublishing(true);
    try {
      await callFunction("adminContractPublishTemplate", {
        version,
        title,
        renderer_key: renderer,
        change_summary: summary,
        body_pages: pages,
        apply_pending: applyPendingOnPublish,
      });

      toast.success(
        applyPendingOnPublish
          ? `Versão ${version} publicada e aplicada aos contratos pendentes/recusados.`
          : `Versão ${version} publicada com sucesso.`
      );

      setShowPublishModal(false);
      setTemplateTitle(DEFAULT_TITLE);
      setTemplateVersion(simpleVersionBump(version));
      setRendererKey(DEFAULT_RENDERER);
      setChangeSummary("");
      setBodyPagesText("");
      setApplyPendingOnPublish(true);

      await loadAll({ silent: true });
      setActiveTab("versoes");
    } catch (err) {
      console.error("Erro ao publicar versão JSX:", err);
      toast.error(err?.message || "Erro ao publicar a nova versão do contrato.");
    } finally {
      setPublishing(false);
    }
  }

  async function setActiveTemplate(templateId) {
    try {
      await callFunction("adminContractSetActiveTemplate", { templateId });
      toast.success("Versão ativa atualizada!");
      await loadAll({ silent: true });
    } catch (err) {
      console.error("Erro ao ativar template:", err);
      toast.error(err?.message || "Erro ao ativar template");
    }
  }

  async function applyTemplateToEligibleContracts(templateArg = activeTemplate, options = {}) {
    const template = templateArg;
    if (!template) {
      toast.error("Não há versão ativa para aplicar.");
      return;
    }

    const targets = contracts.filter((c) => canRefreshContract(c) && isContractOutdated(c, template));

    if (!targets.length) {
      if (!options.silent) {
        toast.success("Nenhum contrato pendente/recusado precisava de atualização.");
      }
      return;
    }

    setBulkUpdating(true);
    try {
      await callFunction("adminContractApplyActiveTemplate", {});

      if (!options.silent) {
        toast.success(`Versão ${versionLabel(template)} aplicada em ${targets.length} contrato(s).`);
      }
      await loadAll({ silent: true });
    } catch (err) {
      console.error("Erro ao aplicar versão aos contratos:", err);
      toast.error(err?.message || "Erro ao aplicar a versão ativa aos contratos pendentes.");
    } finally {
      setBulkUpdating(false);
    }
  }

  async function refreshSingleContract(contract) {
    if (!activeTemplate) {
      toast.error("Não há versão ativa para aplicar.");
      return;
    }

    if (isValidatedContract(contract)) {
      toast.error("Contrato validado não deve ser reemitido em cima do original. Use aditivo.");
      return;
    }

    if (isSignedContract(contract)) {
      toast.error("Contrato já assinado. Para trocar a versão, recuse e peça nova assinatura.");
      return;
    }

    if (!canRefreshContract(contract)) {
      toast.error("Este contrato não está em um estado seguro para atualização automática.");
      return;
    }

    setRowUpdatingId(contract.id);
    try {
      await callFunction("adminContractRefreshContract", { contractId: contract.id });
      toast.success(`Contrato atualizado para ${versionLabel(activeTemplate)}.`);
      await loadAll({ silent: true });
    } catch (err) {
      console.error("Erro ao reemitir contrato:", err);
      toast.error(err?.message || "Erro ao atualizar o contrato para a versão ativa.");
    } finally {
      setRowUpdatingId("");
    }
  }

  async function markValidated(contract) {
    try {
      if (!contract?.id) return;

      const signedStoragePath = getSignedContractStoragePath(contract);
      const signedUrl = getSignedContractUrl(contract);
      if (!signedStoragePath && !signedUrl) {
        toast.error("Não valide sem PDF assinado. Primeiro receba o arquivo enviado pela família.");
        return;
      }

      await callFunction("adminContractValidateContract", { contractId: contract.id });

      toast.success("Contrato validado! O PDF assinado virou o arquivo oficial da família.");
      await loadAll({ silent: true });
    } catch (err) {
      console.error("Erro ao validar contrato:", err);
      toast.error(err?.message || "Erro ao validar contrato");
    }
  }

  function openReject(contract) {
    setRejectingContract(contract);
    setValidationNote(contract?.validation_note || "");
    setShowRejectModal(true);
  }

  async function confirmReject() {
    try {
      if (!rejectingContract?.id) return;

      const note = String(validationNote || "").trim();
      if (!note) {
        toast.error("Informe o motivo da recusa (validation_note).");
        return;
      }

      setRejecting(true);

      await callFunction("adminContractRejectContract", {
        contractId: rejectingContract.id,
        validation_note: note,
      });

      toast.success("Contrato recusado ❌ • Pipeline da família atualizado.");
      setShowRejectModal(false);
      setRejectingContract(null);
      setValidationNote("");
      await loadAll({ silent: true });
    } catch (err) {
      console.error("Erro ao recusar contrato:", err);
      toast.error(err?.message || "Erro ao recusar contrato");
    } finally {
      setRejecting(false);
    }
  }

  const summary = useMemo(() => {
    const total = contracts.length;
    const pending = contracts.filter((c) => !statusNormalize(c.status) || statusNormalize(c.status) === "pending_signature").length;
    const signed = contracts.filter((c) => statusNormalize(c.status) === "signed_uploaded" || !!getSignedContractStoragePath(c)).length;
    const rejected = contracts.filter((c) => ["rejected", "refused", "denied"].includes(statusNormalize(c.status))).length;
    const outdated = contracts.filter((c) => isContractOutdated(c, activeTemplate)).length;
    const pendingRefreshable = contracts.filter((c) => canRefreshContract(c) && isContractOutdated(c, activeTemplate)).length;
    const signedOutdated = contracts.filter((c) => isSignedContract(c) && !isValidatedContract(c) && isContractOutdated(c, activeTemplate)).length;
    const validated = contracts.filter((c) => isValidatedContract(c)).length;

    return { total, pending, signed, rejected, outdated, pendingRefreshable, signedOutdated, validated };
  }, [contracts, activeTemplate]);

  const filteredContracts = useMemo(() => {
    const s = search.trim().toLowerCase();

    return contracts.filter((c) => {
      const fam = familyIndex.get(c.family_id);
      const name = (fam?.full_name || fam?.name || "").toLowerCase();
      const cpf = fam?.cpf || "";
      const status = (c.status || "").toLowerCase();
      const version = (c.template_version || c.view_version || "").toLowerCase();
      const tplTitle = (c.template_title || "").toLowerCase();
      const note = (c.validation_note || "").toLowerCase();
      const source = contractTemplateSource(c).toLowerCase();
      const familyGroupId = String(getAnyGroupIdFromFamily(fam) || "").trim();
      const familyFranchiseId = getFamilyFranchiseId(fam, groupIndex).toLowerCase();

      const bySearch =
        !s ||
        name.includes(s) ||
        cpf.includes(search.trim()) ||
        status.includes(s) ||
        version.includes(s) ||
        tplTitle.includes(s) ||
        note.includes(s) ||
        source.includes(s) ||
        familyGroupId.toLowerCase().includes(s) ||
        familyFranchiseId.includes(s) ||
        String(c.family_id || "").toLowerCase().includes(s);

      let byStatus = true;
      const st = statusNormalize(c.status);
      if (statusFilter === "pending") byStatus = !st || st === "pending_signature";
      else if (statusFilter === "signed") byStatus = st === "signed_uploaded" || !!getSignedContractStoragePath(c);
      else if (statusFilter === "validated") byStatus = st === "validated" || st === "approved";
      else if (statusFilter === "rejected") byStatus = st === "rejected" || st === "refused" || st === "denied";
      else if (statusFilter === "outdated") byStatus = isContractOutdated(c, activeTemplate);

      const matchesFamily = !urlFamilyFilter || String(c.family_id || "") === String(urlFamilyFilter);
      const matchesGroup = urlGroupFilter === "all" || familyGroupId === urlGroupFilter;
      const matchesFranchise = urlFranchiseFilter === "all" || familyFranchiseId === urlFranchiseFilter;
      const matchesSource = urlSourceFilter === "all" || source === urlSourceFilter;
      const matchesVersion = !urlVersionFilter || versionLabel(c) === urlVersionFilter;

      return bySearch && byStatus && matchesFamily && matchesGroup && matchesFranchise && matchesSource && matchesVersion;
    });
  }, [
    contracts,
    familyIndex,
    groupIndex,
    search,
    statusFilter,
    activeTemplate,
    urlGroupFilter,
    urlFranchiseFilter,
    urlSourceFilter,
    urlVersionFilter,
    urlFamilyFilter,
  ]);

  const operationContracts = useMemo(() => filteredContracts.filter((c) => !isValidatedContract(c)), [filteredContracts]);
  const auditContracts = useMemo(() => filteredContracts.filter((c) => isValidatedContract(c)), [filteredContracts]);
  const contractsForPrimaryTab = useMemo(() => {
    if (statusFilter === "validated") return filteredContracts;
    return operationContracts;
  }, [filteredContracts, operationContracts, statusFilter]);

  if (loading) {
    return (
      <div className="p-6 text-slate-600 flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando contratos…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 rounded-2xl p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-300">Mesa operacional</div>
            <h1 className="text-2xl font-bold mt-1">Gestão de Contratos</h1>
            <p className="text-sm text-slate-200 mt-2 max-w-3xl">
              A página agora separa melhor operação, versões e auditoria. O foco visual fica no que precisa de ação primeiro.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => loadAll({ silent: true })}
            >
              {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
              Atualizar
            </Button>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => applyTemplateToEligibleContracts()}
              disabled={!activeTemplate || bulkUpdating}
            >
              {bulkUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Atualizar pendentes
            </Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={openPublishModalPrefilled}>
              <FileCode2 className="w-4 h-4 mr-2" />
              Nova versão
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-5 gap-3 min-w-[1200px]">
          <ContractMetricCard label="Pendentes" value={summary.pending} helper="Aguardando assinatura" tone={metricTone("pending")} icon={FileText} />
          <ContractMetricCard label="Assinados" value={summary.signed} helper="Aguardando validação" tone={metricTone("signed")} icon={BadgeCheck} />
          <ContractMetricCard label="Recusados" value={summary.rejected} helper="Exigem correção" tone={metricTone("rejected")} icon={XCircle} />
          <ContractMetricCard label="Desatualizados" value={summary.outdated} helper={`${summary.pendingRefreshable} atualizáveis`} tone={metricTone("outdated")} icon={RotateCcw} />
          <ContractMetricCard label="Validados" value={summary.validated} helper="Arquivo oficial salvo" tone={metricTone("validated")} icon={CheckCircle2} />
        </div>
      </div>

      <div className="space-y-4">
        <Card className="border-2">
          <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Versão ativa do contrato</p>
                <p className="text-sm text-slate-600 mt-1">
                  Continua usando exatamente a mesma busca que já funcionava, mas com organização visual melhor para operação.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeTemplate ? (
                    <>
                      <Badge className="bg-green-100 text-green-700">Ativo: {activeTemplate.title} ({versionLabel(activeTemplate)})</Badge>
                      <Badge className="bg-slate-100 text-slate-700">Origem: {templateSourceLabel(activeTemplate)}</Badge>
                      <Badge className="bg-slate-100 text-slate-700">Renderer: {templateRendererLabel(activeTemplate)}</Badge>
                      <Badge className="bg-slate-100 text-slate-700">Páginas: {countPagesFromTemplate(activeTemplate) || 0}</Badge>
                    </>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-700">Nenhuma versão ativa</Badge>
                  )}
                </div>
                {activeTemplate?.change_summary ? (
                  <p className="text-xs text-slate-500 mt-2">Alterações: <strong>{activeTemplate.change_summary}</strong></p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[280px]">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Total de contratos</div>
                <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Assinados desatualizados</div>
                <div className="text-2xl font-bold text-slate-900">{summary.signedOutdated}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <ShieldAlert className="w-4 h-4" />
              Regra operacional
            </div>
            <div className="grid md:grid-cols-3 gap-2 text-sm text-amber-900">
              <p><strong>Pendentes/recusados:</strong> podem receber nova versão.</p>
              <p><strong>Assinados:</strong> valide ou recuse, sem sobrescrever em silêncio.</p>
              <p><strong>Validados:</strong> preserve histórico; mudança futura vira aditivo.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <SectionSwitch activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por família, CPF, versão, status, franquia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={urlGroupFilter}
            onChange={(e) => setUrlGroupFilter(e.target.value)}
            className="h-10 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
            title="Filtrar por grupo"
          >
            <option value="all">Todos os grupos</option>
            {groupFilterOptions.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>

          {activeTab === "operacao" ? (
            <div className="flex gap-2 flex-wrap">
              <Button variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>
                <Filter className="w-4 h-4 mr-2" />
                Todos
              </Button>
              <Button variant={statusFilter === "pending" ? "default" : "outline"} onClick={() => setStatusFilter("pending")}>Pendentes</Button>
              <Button variant={statusFilter === "signed" ? "default" : "outline"} onClick={() => setStatusFilter("signed")}>Assinados</Button>
              <Button variant={statusFilter === "validated" ? "default" : "outline"} onClick={() => setStatusFilter("validated")}>Validados</Button>
              <Button variant={statusFilter === "rejected" ? "default" : "outline"} onClick={() => setStatusFilter("rejected")}>Recusados</Button>
              <Button variant={statusFilter === "outdated" ? "default" : "outline"} onClick={() => setStatusFilter("outdated")}>Desatualizados</Button>
            </div>
          ) : null}
        </div>
      </div>

      {urlGroupFilter !== "all" || urlFranchiseFilter !== "all" || urlSourceFilter !== "all" || urlVersionFilter || urlFamilyFilter ? (
        <div className="rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Filtros ativos:
          {urlGroupFilter !== "all" ? <span className="ml-2 font-medium">Grupo {urlGroupFilter}</span> : null}
          {urlFranchiseFilter !== "all" ? <span className="ml-2 font-medium">Franquia {urlFranchiseFilter}</span> : null}
          {urlSourceFilter !== "all" ? <span className="ml-2 font-medium">Origem {urlSourceFilter.toUpperCase()}</span> : null}
          {urlVersionFilter ? <span className="ml-2 font-medium">Versão {urlVersionFilter}</span> : null}
          {urlFamilyFilter ? <span className="ml-2 font-medium">Família {urlFamilyFilter}</span> : null}
        </div>
      ) : null}

      {activeTab === "operacao" ? (
        <Card>
          <CardHeader>
            <CardTitle>{statusFilter === "validated" ? "Contratos validados" : "Fila operacional de contratos"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {contractsForPrimaryTab.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
                  {statusFilter === "validated" ? "Nenhum contrato validado encontrado." : "Nenhum contrato operacional encontrado."}
                </div>
              ) : (
                contractsForPrimaryTab.map((c) => {
                  const fam = familyIndex.get(c.family_id);
                  const outdated = isContractOutdated(c, activeTemplate);
                  const refreshable = canRefreshContract(c) && outdated;
                  const lockedValidated = isValidatedContract(c);
                  const rowBusy = rowUpdatingId === c.id;
                  const pageCount = extractSnapshotPages(c).length || c.page_count || 0;
                  const action = recommendedAction(c, activeTemplate);

                  return (
                    <div key={c.id} className="rounded-2xl border p-3 hover:bg-slate-50 transition">
                      <div className="space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-900">
                            {fam?.full_name || fam?.name || "Família (sem nome)"}
                          </div>
                          <Badge className={statusBadgeClass(c.status)}>{statusLabel(c.status)}</Badge>
                          <Badge className={action.tone}>{action.text}</Badge>
                          {outdated ? (
                            <Badge className="bg-amber-100 text-amber-800">Versão antiga</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700">Versão atual</Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span><span className="text-slate-500">Família:</span> {c.family_id || "-"}</span>
                          <span><span className="text-slate-500">CPF:</span> {fam?.cpf || "não informado"}</span>
                          <span><span className="text-slate-500">Versão:</span> {versionLabel(c)}</span>
                          <span><span className="text-slate-500">Origem:</span> {contractTemplateSource(c).toUpperCase()}</span>
                          <span><span className="text-slate-500">Snapshot:</span> {pageCount} pág.</span>
                          <span><span className="text-slate-500">Ativa:</span> {activeTemplate ? versionLabel(activeTemplate) : "—"}</span>
                        </div>

                        <div className="text-xs text-slate-500">
                          {outdated ? "Desalinhado com a versão ativa." : "Alinhado com a versão ativa."}{" "}
                          {isSignedContract(c) && !lockedValidated ? "PDF assinado aguardando decisão." : "Fluxo normal."}
                        </div>

                        {c.validation_note ? (
                          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <strong>Motivo registrado:</strong> {c.validation_note}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                          <Button variant="outline" size="sm" className="h-8 px-3" disabled={!hasGeneratedContractFile(c)} onClick={() => openGeneratedContract(c)}>
                            <Download className="w-4 h-4 mr-1.5" />
                            Gerado
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 px-3" disabled={!hasSignedContractFile(c)} onClick={() => openSignedContract(c)}>
                            <Download className="w-4 h-4 mr-1.5" />
                            Assinado
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 px-3" disabled={!refreshable || rowBusy} onClick={() => refreshSingleContract(c)}>
                            {rowBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}
                            Atualizar
                          </Button>
                          <Button size="sm" className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600" disabled={lockedValidated || !hasSignedContractFile(c)} onClick={() => markValidated(c)}>
                            <BadgeCheck className="w-4 h-4 mr-1.5" />
                            Validar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8 px-3" disabled={lockedValidated} onClick={() => openReject(c)}>
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Recusar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "versoes" ? (
        <div className="grid xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Histórico de templates</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Título</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Versão</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Origem</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Páginas</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">Nenhum template cadastrado</td>
                    </tr>
                  ) : (
                    templates.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-slate-50 align-top">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{t.title || "-"}</div>
                          <div className="text-xs text-slate-500">{t.change_summary || "Sem resumo informado"}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          <div>{versionLabel(t)}</div>
                          <div className="text-xs text-slate-500">{t.active ? "Versão ativa" : "Histórico"}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          <div>{templateSourceLabel(t)}</div>
                          <div className="text-xs text-slate-500">{templateRendererLabel(t)}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">{countPagesFromTemplate(t) || "-"}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 flex-wrap">
                            {templateSource(t) === "pdf" && t.storage_path ? (
                              <Button variant="outline" size="sm" onClick={() => openStoragePdf(t.storage_path)}>
                                <Download className="w-4 h-4 mr-1" />
                                Baixar
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" onClick={() => duplicateTemplateToEditor(t)}>
                              <CopyPlus className="w-4 h-4 mr-1" />
                              Duplicar
                            </Button>
                            {!t.active ? (
                              <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => setActiveTemplate(t.id)}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Ativar
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled>Ativo</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fluxo recomendado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-xl border p-3">
                <div className="font-semibold text-slate-900">1. Preparar nova versão</div>
                <div className="mt-1">Copie a última versão, ajuste o conteúdo e publique uma nova revisão com resumo claro.</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="font-semibold text-slate-900">2. Aplicar nos pendentes</div>
                <div className="mt-1">Aplique a nova versão apenas em contratos pendentes ou recusados.</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="font-semibold text-slate-900">3. Preservar auditoria</div>
                <div className="mt-1">Assinados e validados não devem ser sobrescritos automaticamente.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "auditoria" ? (
        <Card>
          <CardHeader>
            <CardTitle>Auditoria e arquivo oficial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600">
              Esta área foca em contratos validados, para facilitar consulta de histórico e download do arquivo oficial.
            </div>
            <div className="space-y-3">
              {auditContracts.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
                  Nenhum contrato validado encontrado.
                </div>
              ) : (
                auditContracts.map((c) => {
                  const fam = familyIndex.get(c.family_id);
                  return (
                    <div key={c.id} className="rounded-2xl border p-4 hover:bg-slate-50 transition">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-slate-900">{fam?.full_name || fam?.name || "Família (sem nome)"}</div>
                            <Badge className="bg-emerald-100 text-emerald-700">Validado</Badge>
                            <Badge className="bg-slate-100 text-slate-700">{versionLabel(c)}</Badge>
                          </div>
                          <div className="text-sm text-slate-600 mt-2">
                            Família: {c.family_id || "-"} • Origem: {contractTemplateSource(c).toUpperCase()} • Renderer: {c.renderer_key || DEFAULT_RENDERER}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" disabled={!hasSignedContractFile(c)} onClick={() => openSignedContract(c)}>
                            <Download className="w-4 h-4 mr-2" />
                            PDF assinado
                          </Button>
                          <Button size="sm" className="bg-slate-900 hover:bg-slate-800" disabled={!hasValidatedContractFile(c)} onClick={() => openValidatedContract(c)}>
                            <Download className="w-4 h-4 mr-2" />
                            PDF oficial
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary.signedOutdated > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5" />
              <div>
                Existem <strong>{summary.signedOutdated}</strong> contrato(s) assinados em versão antiga. O fluxo seguro é <strong>recusar com motivo claro</strong> e solicitar <strong>nova assinatura</strong>, sem sobrescrever o assinado anterior.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Publicar nova versão do contrato</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Título do contrato</Label>
                <Input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} placeholder={`Ex: ${DEFAULT_TITLE}`} />
              </div>
              <div>
                <Label>Versão</Label>
                <Input value={templateVersion} onChange={(e) => setTemplateVersion(sanitizeFileName(e.target.value))} placeholder="Ex: v12" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Renderer JSX</Label>
                <Input value={rendererKey} onChange={(e) => setRendererKey(e.target.value)} placeholder={DEFAULT_RENDERER} />
              </div>
              <div>
                <Label>Resumo da alteração</Label>
                <Input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} placeholder="Ex.: cláusulas revisadas, nova redação jurídica..." />
              </div>
            </div>

            <div>
              <Label>Corpo do contrato por páginas</Label>
              <textarea
                value={bodyPagesText}
                onChange={(e) => setBodyPagesText(e.target.value)}
                placeholder={[
                  "Cole aqui o contrato completo.",
                  "",
                  "Separe cada página com:",
                  "===== PÁGINA =====",
                  "",
                  "Exemplo:",
                  "CONTRATO DE ADESÃO...",
                  "",
                  "===== PÁGINA =====",
                  "",
                  "Cláusula 5...",
                ].join("\n")}
                className="w-full min-h-[360px] rounded-md border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-200"
              />
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-md bg-slate-100 px-2 py-1">Separador: ===== PÁGINA =====</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">Páginas detectadas: {editorPages.length}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">Caracteres: {String(bodyPagesText || "").trim().length}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border p-3">
              <input type="checkbox" checked={applyPendingOnPublish} onChange={(e) => setApplyPendingOnPublish(e.target.checked)} className="mt-1" />
              <div className="text-sm text-slate-700">
                <div className="font-medium">Aplicar automaticamente aos contratos pendentes/recusados</div>
                <div className="text-xs text-slate-500 mt-1">Assinados e validados continuam exigindo decisão humana.</div>
              </div>
            </label>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
              O fluxo continua igual no dado, só ficou mais organizado visualmente: publicar, revisar e aplicar nas pendências com segurança.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishModal(false)} disabled={publishing}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={publishJsxTemplate} disabled={publishing}>
              {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCode2 className="w-4 h-4 mr-2" />}
              Publicar versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar contrato</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              Informe o motivo da recusa de forma clara para a família saber o que corrigir.
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={validationNote}
                onChange={(e) => setValidationNote(e.target.value)}
                placeholder="Ex.: contrato atualizado, assine novamente / documento ilegível / falta assinatura..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setRejectingContract(null);
                setValidationNote("");
              }}
              disabled={rejecting}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={rejecting}>
              {rejecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

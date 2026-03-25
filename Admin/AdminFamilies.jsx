import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
} from "firebase/firestore";
import { Download, Loader2, Users, Zap } from "lucide-react";
import { toast } from "sonner";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";

import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import PipelineProgress from "../../components/ui/PipelineProgress";

import {
  COL_FAMILY,
  COL_GROUPS,
  COL_PAYMENTS,
  DOC_STATUS,
  familyStatusConfig,
  processSteps,
} from "./AdminFamilies/constants";
import {
  derivePipeline,
  flattenDocumentFiles,
  fmtDateTimeBR,
  getBillingDueDayFromFamily,
  getFamilyGroupId,
  getGroupLabel,
  nextStepForPipeline,
  normalizeStage,
  normStr,
  safeToDate,
  searchParamValue,
  tsToMillis,
} from "./AdminFamilies/helpers";
import {
  approveDocsAction,
  buildApprovedDocPatch,
  buildDocsNotesPatch,
  buildRejectedDocPatch,
  loadFamilyDetails,
  openDocumentInNewTab,
  rejectDocsAction,
  saveDocsNotesAction,
} from "./AdminFamilies/services";
import FiltersCard from "./AdminFamilies/components/FiltersCard";
import FamiliesListCard from "./AdminFamilies/components/FamiliesListCard";
import SelectedFamilyHeader from "./AdminFamilies/components/SelectedFamilyHeader";
import DocumentationCard from "./AdminFamilies/components/DocumentationCard";
import FinanceCard from "./AdminFamilies/components/FinanceCard";
import RejectDocsDialog from "./AdminFamilies/components/RejectDocsDialog";
import DocumentsFilesDialog from "./AdminFamilies/components/DocumentsFilesDialog";

export default function AdminFamilies() {
  const location = useLocation();

  const [families, setFamilies] = useState([]);
  const [payments, setPayments] = useState([]);
  const [groups, setGroups] = useState([]);

  const [search, setSearch] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [franchiseFilter, setFranchiseFilter] = useState("all");

  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [rightLoading, setRightLoading] = useState(false);

  const [documentsDoc, setDocumentsDoc] = useState(null);
  const [contractDoc, setContractDoc] = useState(null);
  const [engineeringProjectLast, setEngineeringProjectLast] = useState(null);
  const [visitJob, setVisitJob] = useState(null);
  const [installationJob, setInstallationJob] = useState(null);
  const [installExecution, setInstallExecution] = useState(null);
  const [homologationDoc, setHomologationDoc] = useState(null);

  const [docsNotes, setDocsNotes] = useState("");
  const [docsFilesOpen, setDocsFilesOpen] = useState(false);
  const [docsActionLoading, setDocsActionLoading] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);

  const selectedFamily = useMemo(
    () => families.find((family) => family.id === selectedFamilyId) || null,
    [families, selectedFamilyId],
  );

  const groupIndex = useMemo(() => {
    const map = new Map();
    (groups || []).forEach((group) => map.set(String(group.id), group));
    return map;
  }, [groups]);

  const pipelineStageByFamily = useMemo(() => {
    const map = new Map();
    for (const family of families) {
      map.set(family.id, normalizeStage(family.pipeline_stage));
    }
    return map;
  }, [families]);

  const groupFilterOptions = useMemo(() => {
    const map = new Map();

    (groups || []).forEach((group) => {
      const id = String(group.id);
      map.set(id, {
        value: id,
        label: getGroupLabel(group, id),
      });
    });

    (families || []).forEach((family) => {
      const groupId = getFamilyGroupId(family);
      if (!groupId || map.has(groupId)) return;
      map.set(groupId, {
        value: groupId,
        label: getGroupLabel(groupIndex.get(groupId), groupId),
      });
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [families, groupIndex, groups]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const nextSearch = searchParamValue(params, ["q", "search"], "");
    const nextPipeline = searchParamValue(params, ["pipeline", "stage"], "all");
    const nextGroup = searchParamValue(params, ["groupId", "group", "gid"], "all");
    const nextFranchise = searchParamValue(
      params,
      ["franchiseId", "franchise", "fid"],
      "all",
    );
    const hasFamilyParam = ["familyId", "family", "id"].some((key) => params.has(key));
    const nextFamilyId = searchParamValue(params, ["familyId", "family", "id"], "");

    setSearch(nextSearch);
    setPipelineFilter(nextPipeline || "all");
    setGroupFilter(nextGroup || "all");
    setFranchiseFilter(nextFranchise || "all");

    if (hasFamilyParam) {
      setSelectedFamilyId(nextFamilyId || null);
    }
  }, [location.search]);

  useEffect(() => {
    let unsubscribeFamilies = null;
    let unsubscribeGroups = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const familyQuery = query(collection(db, COL_FAMILY));
        unsubscribeFamilies = onSnapshot(
          familyQuery,
          (snapshot) => {
            const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            setFamilies(rows);
            setSelectedFamilyId((current) => {
              if (!current) return null;
              const stillExists = rows.some((row) => row.id === current);
              return stillExists ? current : null;
            });
          },
          (error) => {
            console.error(error);
            toast.error("Erro ao carregar famílias");
          },
        );

        const groupsQuery = query(collection(db, COL_GROUPS));
        unsubscribeGroups = onSnapshot(
          groupsQuery,
          (snapshot) => {
            const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            setGroups(rows);
          },
          (error) => {
            console.error(error);
            toast.error("Erro ao carregar grupos");
          },
        );

        const paymentsSnapshot = await getDocs(collection(db, COL_PAYMENTS));
        setPayments(paymentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar dados");
      }
    });

    return () => {
      if (typeof unsubscribeFamilies === "function") unsubscribeFamilies();
      if (typeof unsubscribeGroups === "function") unsubscribeGroups();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (selectedFamilyId) return;

    setRightLoading(false);
    setDocumentsDoc(null);
    setContractDoc(null);
    setEngineeringProjectLast(null);
    setVisitJob(null);
    setInstallationJob(null);
    setInstallExecution(null);
    setHomologationDoc(null);
    setDocsNotes("");
    setDocsActionLoading(false);
    setConfirmRejectOpen(false);
  }, [selectedFamilyId]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedFamilyId) return;
      setRightLoading(true);

      try {
        const details = await loadFamilyDetails(db, selectedFamilyId);
        if (!alive) return;

        setDocumentsDoc(details.documentsDoc);
        setContractDoc(details.contractDoc);
        setEngineeringProjectLast(details.engineeringProjectLast);
        setVisitJob(details.visitJob);
        setInstallationJob(details.installationJob);
        setInstallExecution(details.installExecution);
        setHomologationDoc(details.homologationDoc);
        setDocsNotes(details.docsNotes);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar detalhes");
        if (!alive) return;
        setDocumentsDoc(null);
        setContractDoc(null);
        setEngineeringProjectLast(null);
        setVisitJob(null);
        setInstallationJob(null);
        setInstallExecution(null);
        setHomologationDoc(null);
      } finally {
        if (alive) setRightLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [selectedFamilyId]);

  const filteredFamilies = useMemo(() => {
    const term = normStr(search);

    return families
      .filter((family) => {
        const familyGroupId = getFamilyGroupId(family);
        const familyGroup = familyGroupId ? groupIndex.get(familyGroupId) || null : null;
        const groupLabel = familyGroupId ? normStr(getGroupLabel(familyGroup, familyGroupId)) : "";
        const familyFranchiseId = String(
          family?.franchise_id ||
            family?.franchiseId ||
            familyGroup?.franchise_id ||
            familyGroup?.franchiseId ||
            "",
        ).trim();

        const matchesSearch =
          !term ||
          normStr(family.full_name).includes(term) ||
          String(family.cpf || "").includes(search) ||
          normStr(family.address?.city).includes(term) ||
          groupLabel.includes(term) ||
          familyFranchiseId.toLowerCase().includes(term);

        const pipeline = pipelineStageByFamily.get(family.id) || "cadastro";
        const matchesPipeline = pipelineFilter === "all" || pipeline === pipelineFilter;
        const matchesGroup =
          groupFilter === "all" ||
          (groupFilter === "no_group" ? !familyGroupId : familyGroupId === groupFilter);
        const matchesFranchise = franchiseFilter === "all" || familyFranchiseId === franchiseFilter;

        return matchesSearch && matchesPipeline && matchesGroup && matchesFranchise;
      })
      .sort((a, b) => normStr(a.full_name).localeCompare(normStr(b.full_name)));
  }, [
    families,
    franchiseFilter,
    groupFilter,
    groupIndex,
    pipelineFilter,
    pipelineStageByFamily,
    search,
  ]);

  useEffect(() => {
    if (!selectedFamilyId) return;
    const isVisible = filteredFamilies.some((family) => family.id === selectedFamilyId);
    if (!isVisible) {
      setSelectedFamilyId(null);
    }
  }, [filteredFamilies, selectedFamilyId]);

  const selectedPayments = useMemo(() => {
    if (!selectedFamilyId) return [];
    return payments
      .filter((payment) => payment.family_id === selectedFamilyId)
      .slice()
      .sort((a, b) => (tsToMillis(b.created_at) || 0) - (tsToMillis(a.created_at) || 0));
  }, [payments, selectedFamilyId]);

  const totalPaid = useMemo(() => {
    return selectedPayments
      .filter((payment) => payment.status === "paid" || payment.status === "overdue")
      .reduce((accumulator, payment) => accumulator + (payment.amount || 0), 0);
  }, [selectedPayments]);

  const firstPayment = useMemo(() => {
    return (
      selectedPayments.find((payment) => Number(payment?.installment_number) === 1) ||
      selectedPayments.find((payment) => String(payment?.id || "").endsWith("_0001")) ||
      null
    );
  }, [selectedPayments]);

  const firstPaymentPaid = useMemo(
    () => normStr(firstPayment?.status) === "paid",
    [firstPayment],
  );

  const derived = useMemo(() => {
    if (!selectedFamily) return null;
    return derivePipeline({
      family: selectedFamily,
      documentsDoc,
      contractDoc,
      engineeringProjectLast,
      visitJob,
      installationJob,
      installExecution,
      homologationDoc,
    });
  }, [
    contractDoc,
    documentsDoc,
    engineeringProjectLast,
    homologationDoc,
    installExecution,
    installationJob,
    selectedFamily,
    visitJob,
  ]);

  const currentProcessIndex = useMemo(() => {
    const currentStage = derived?.pipeline_stage || "cadastro";
    const idx = processSteps.findIndex((step) => step.key === currentStage);
    return idx >= 0 ? idx : 0;
  }, [derived]);

  const stepTone = (stepKey, idx) => {
    if (derived?.isActiveNow) return "green";
    if (stepKey === "ativo") return derived?.isActiveNow ? "green" : "yellow";
    if (idx < currentProcessIndex) return "green";
    return "yellow";
  };

  const nextStepInfo = useMemo(
    () => nextStepForPipeline({ pipeline: derived, firstPaymentPaid }),
    [derived, firstPaymentPaid],
  );

  const selectedDueDay = useMemo(
    () => getBillingDueDayFromFamily(selectedFamily),
    [selectedFamily],
  );

  const selectedGroupId = useMemo(() => getFamilyGroupId(selectedFamily), [selectedFamily]);
  const selectedGroup = useMemo(
    () => (selectedGroupId ? groupIndex.get(selectedGroupId) || null : null),
    [groupIndex, selectedGroupId],
  );
  const selectedGroupLabel = useMemo(
    () => (selectedGroupId ? getGroupLabel(selectedGroup, selectedGroupId) : "Sem grupo"),
    [selectedGroup, selectedGroupId],
  );

  const docsFilesFlat = useMemo(() => flattenDocumentFiles(documentsDoc), [documentsDoc]);

  const docsAlreadyApproved = useMemo(
    () => normStr(derived?.docs_status) === DOC_STATUS.APROVADO,
    [derived],
  );

  const approveDisabledReason = useMemo(() => {
    if (!selectedFamilyId) return "Selecione uma família";
    if (rightLoading) return "Carregando detalhes…";
    if (docsActionLoading) return "Ação em andamento…";
    if (docsAlreadyApproved) return "Documentação já aprovada";
    if (!documentsDoc && docsFilesFlat.length === 0) return "Sem documentação anexada";
    return "";
  }, [
    docsActionLoading,
    docsAlreadyApproved,
    docsFilesFlat.length,
    documentsDoc,
    rightLoading,
    selectedFamilyId,
  ]);

  const canApprove = !approveDisabledReason;
  const approvedAtText = useMemo(() => {
    const approvedAt = safeToDate(documentsDoc?.approved_at);
    return approvedAt ? fmtDateTimeBR(approvedAt) : null;
  }, [documentsDoc]);

  async function handleSaveDocsNotes() {
    if (!selectedFamilyId) return;

    try {
      setDocsActionLoading(true);
      const payload = await saveDocsNotesAction(selectedFamilyId, docsNotes);
      setDocumentsDoc((previous) => buildDocsNotesPatch(previous, selectedFamilyId, payload, docsNotes));
      toast.success("Observações salvas");
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Erro ao salvar observações");
    } finally {
      setDocsActionLoading(false);
    }
  }

  async function handleApproveDocs() {
    if (!selectedFamilyId || docsAlreadyApproved) return;

    try {
      setDocsActionLoading(true);
      const payload = await approveDocsAction(selectedFamilyId, docsNotes);
      const familyPatch = payload.familyPatch || {
        status: "approved",
        documents_status: DOC_STATUS.APROVADO,
        pipeline_stage: "grupo",
        pipeline_substatus: "aguardando",
        pipeline_reason: "",
        group_queue_role: "primary",
      };

      setFamilies((previous) =>
        previous.map((family) => (family.id === selectedFamilyId ? { ...family, ...familyPatch } : family)),
      );
      setDocumentsDoc((previous) =>
        buildApprovedDocPatch(previous, selectedFamilyId, payload, docsNotes, DOC_STATUS.APROVADO),
      );
      toast.success("Documentação aprovada e pipeline avançado para Grupo");
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Erro ao aprovar documentação");
    } finally {
      setDocsActionLoading(false);
    }
  }

  async function handleRejectDocs() {
    if (!selectedFamilyId) return;

    try {
      setDocsActionLoading(true);
      const payload = await rejectDocsAction(selectedFamilyId, docsNotes);
      const familyPatch = payload.familyPatch || {
        documents_status: DOC_STATUS.REPROVADO,
        pipeline_stage: "cadastro",
        pipeline_substatus: "reprovado",
        pipeline_reason: docsNotes
          ? String(docsNotes).slice(0, 140)
          : "Documentação reprovada",
      };

      setFamilies((previous) =>
        previous.map((family) => (family.id === selectedFamilyId ? { ...family, ...familyPatch } : family)),
      );
      setDocumentsDoc((previous) =>
        buildRejectedDocPatch(previous, selectedFamilyId, payload, docsNotes, DOC_STATUS.REPROVADO),
      );
      toast.success("Documentação reprovada e pipeline voltou para Cadastro");
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Erro ao reprovar documentação");
    } finally {
      setDocsActionLoading(false);
      setConfirmRejectOpen(false);
    }
  }

  async function handleOpenDocument(fileLike) {
    try {
      await openDocumentInNewTab(storage, fileLike);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Não foi possível abrir o arquivo no Storage.");
    }
  }

  function handleCopyToClipboard(text) {
    try {
      navigator.clipboard.writeText(String(text || ""));
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function handleOpenWhatsApp() {
    const phone = String(selectedFamily?.phone || "").replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Admin • Famílias
          </h1>
          <p className="text-slate-600">{families.length} famílias cadastradas</p>
        </div>

        <Button
          variant="outline"
          onClick={() =>
            toast.message("Dica", {
              description: "Se quiser exportar de verdade, pluga seu CSV aqui.",
            })
          }
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <FiltersCard
            search={search}
            onSearchChange={setSearch}
            pipelineFilter={pipelineFilter}
            onPipelineFilterChange={setPipelineFilter}
            processSteps={processSteps}
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            groupFilterOptions={groupFilterOptions}
            filteredFamiliesCount={filteredFamilies.length}
            familiesCount={families.length}
            franchiseFilter={franchiseFilter}
            groupIndex={groupIndex}
          />

          <FamiliesListCard
            filteredFamilies={filteredFamilies}
            selectedFamilyId={selectedFamilyId}
            onSelectFamily={setSelectedFamilyId}
            familyStatusConfig={familyStatusConfig}
            pipelineStageByFamily={pipelineStageByFamily}
            groupIndex={groupIndex}
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!selectedFamily ? (
            <Card className="rounded-2xl">
              <CardContent className="p-6 text-sm text-slate-600">
                Selecione uma família na lista ao lado.
              </CardContent>
            </Card>
          ) : (
            <>
              <SelectedFamilyHeader
                selectedFamily={selectedFamily}
                selectedGroupLabel={selectedGroupLabel}
                selectedDueDay={selectedDueDay}
                derived={derived}
                familyStatusConfig={familyStatusConfig}
                onCopyFamilyId={() => handleCopyToClipboard(selectedFamily.id)}
                onOpenWhatsApp={handleOpenWhatsApp}
                onDeselect={() => setSelectedFamilyId(null)}
              />

              {rightLoading ? (
                <Card className="rounded-2xl">
                  <CardContent className="p-6 flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando detalhes…
                  </CardContent>
                </Card>
              ) : (
                <>
                  <PipelineProgress
                    title="Pipeline (família selecionada)"
                    titleIcon={Zap}
                    steps={processSteps}
                    currentIndex={currentProcessIndex}
                    getTone={stepTone}
                    substatus={derived?.pipeline_substatus || ""}
                    nextStep={{
                      title: nextStepInfo.title,
                      desc: nextStepInfo.desc,
                    }}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    <DocumentationCard
                      derived={derived}
                      docsAlreadyApproved={docsAlreadyApproved}
                      approvedAtText={approvedAtText}
                      docsFilesCount={docsFilesFlat.length}
                      onOpenFiles={() => setDocsFilesOpen(true)}
                      docsNotes={docsNotes}
                      onDocsNotesChange={setDocsNotes}
                      docsActionLoading={docsActionLoading}
                      selectedFamilyId={selectedFamilyId}
                      onSaveDocsNotes={handleSaveDocsNotes}
                      canApprove={canApprove}
                      approveDisabledReason={approveDisabledReason}
                      onApprove={handleApproveDocs}
                      onAskReject={() => setConfirmRejectOpen(true)}
                      documentsDoc={documentsDoc}
                    />

                    <FinanceCard totalPaid={totalPaid} selectedPayments={selectedPayments} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <RejectDocsDialog
        open={confirmRejectOpen}
        onOpenChange={setConfirmRejectOpen}
        docsActionLoading={docsActionLoading}
        selectedFamilyId={selectedFamilyId}
        onConfirm={handleRejectDocs}
      />

      <DocumentsFilesDialog
        open={docsFilesOpen}
        onOpenChange={setDocsFilesOpen}
        docsFilesFlat={docsFilesFlat}
        onOpenDocument={handleOpenDocument}
      />
    </div>
  );
}

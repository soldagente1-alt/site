// FamilyDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { AlertTriangle, ClipboardList, CreditCard, Zap } from "lucide-react";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { createPageUrl } from "../../utils/createPageUrl";
import PipelineProgress from "../../components/ui/PipelineProgress";

import {
  derivePipelineFromFamily,
  documentsLabel,
  engineeringNextStepByStatus,
  fmtDateTimeBR,
  getBillingDueDayFromFamily,
  homologationNextStepInfo,
  installationNextStepByExecution,
  normStr,
  normalizeStage,
  PROCESS_STEPS,
  safeToDate,
} from "./FamilyDashboard/helpers";
import { getEmptyFamilyDashboardData, loadFamilyDashboardData } from "./FamilyDashboard/services";
import DashboardHeader from "./FamilyDashboard/components/DashboardHeader";
import TopInfoCards from "./FamilyDashboard/components/TopInfoCards";
import InstallationStagesCard from "./FamilyDashboard/components/InstallationStagesCard";
import PendingItemsCard from "./FamilyDashboard/components/PendingItemsCard";
import PaymentsCard from "./FamilyDashboard/components/PaymentsCard";

const EMPTY_DATA = getEmptyFamilyDashboardData();

export default function FamilyDashboard() {
  const [familyData, setFamilyData] = useState(EMPTY_DATA.familyData);
  const [waitlistLead, setWaitlistLead] = useState(EMPTY_DATA.waitlistLead);
  const [groupQueueDerived, setGroupQueueDerived] = useState(EMPTY_DATA.groupQueueDerived);
  const [planData, setPlanData] = useState(EMPTY_DATA.planData);
  const [groupData, setGroupData] = useState(EMPTY_DATA.groupData);
  const [visitJob, setVisitJob] = useState(EMPTY_DATA.visitJob);
  const [installationJob, setInstallationJob] = useState(EMPTY_DATA.installationJob);
  const [installExecution, setInstallExecution] = useState(EMPTY_DATA.installExecution);
  const [homologationDoc, setHomologationDoc] = useState(EMPTY_DATA.homologationDoc);
  const [contractDoc, setContractDoc] = useState(EMPTY_DATA.contractDoc);
  const [engineeringProjectLast, setEngineeringProjectLast] = useState(EMPTY_DATA.engineeringProjectLast);
  const [documentsDoc, setDocumentsDoc] = useState(EMPTY_DATA.documentsDoc);
  const [payments, setPayments] = useState(EMPTY_DATA.payments);

  const [loading, setLoading] = useState(true);
  const [waitlistLeadLoading, setWaitlistLeadLoading] = useState(false);
  const [groupQueueLoading, setGroupQueueLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [visitJobLoading, setVisitJobLoading] = useState(false);
  const [installationJobLoading, setInstallationJobLoading] = useState(false);
  const [installExecutionLoading, setInstallExecutionLoading] = useState(false);
  const [homologationLoading, setHomologationLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [engineeringProjectLoading, setEngineeringProjectLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const documentsPageUrl = createPageUrl("family/documents");

  const statusLabels = useMemo(
    () => ({
      ApprovalPending: { label: "Aguardando aprovação", color: "bg-yellow-100 text-yellow-700" },
      pending: { label: "Aguardando aprovação", color: "bg-yellow-100 text-yellow-700" },
      approved: { label: "Aprovado", color: "bg-blue-100 text-blue-700" },
      in_group: { label: "Em grupo", color: "bg-purple-100 text-purple-700" },
      active: { label: "Kit ativo", color: "bg-green-100 text-green-700" },
      completed: { label: "Quitado", color: "bg-emerald-100 text-emerald-700" },
    }),
    []
  );

  const groupStatusLabels = {
    forming: "Em formação",
    fundraising: "Em captação",
    ready: "Pronto para instalação",
    installing: "Em instalação",
    completed: "Concluído",
  };

  function resetDashboardState() {
    const empty = getEmptyFamilyDashboardData();
    setFamilyData(empty.familyData);
    setWaitlistLead(empty.waitlistLead);
    setGroupQueueDerived(empty.groupQueueDerived);
    setPlanData(empty.planData);
    setGroupData(empty.groupData);
    setVisitJob(empty.visitJob);
    setInstallationJob(empty.installationJob);
    setInstallExecution(empty.installExecution);
    setHomologationDoc(empty.homologationDoc);
    setContractDoc(empty.contractDoc);
    setEngineeringProjectLast(empty.engineeringProjectLast);
    setDocumentsDoc(empty.documentsDoc);
    setPayments(empty.payments);

    setWaitlistLeadLoading(false);
    setGroupQueueLoading(false);
    setPlanLoading(false);
    setGroupLoading(false);
    setVisitJobLoading(false);
    setInstallationJobLoading(false);
    setInstallExecutionLoading(false);
    setHomologationLoading(false);
    setContractLoading(false);
    setEngineeringProjectLoading(false);
    setDocumentsLoading(false);
  }

  function applyDashboardData(data) {
    setFamilyData(data.familyData || null);
    setWaitlistLead(data.waitlistLead || null);
    setGroupQueueDerived(data.groupQueueDerived || null);
    setPlanData(data.planData || null);
    setGroupData(data.groupData || null);
    setVisitJob(data.visitJob || null);
    setInstallationJob(data.installationJob || null);
    setInstallExecution(data.installExecution || null);
    setHomologationDoc(data.homologationDoc || null);
    setContractDoc(data.contractDoc || null);
    setEngineeringProjectLast(data.engineeringProjectLast || null);
    setDocumentsDoc(data.documentsDoc || null);
    setPayments(Array.isArray(data.payments) ? data.payments : []);
  }

  async function loadAll(user) {
    try {
      setLoading(true);
      setWaitlistLeadLoading(true);
      setGroupQueueLoading(true);
      setPlanLoading(true);
      setGroupLoading(true);
      setVisitJobLoading(true);
      setInstallationJobLoading(true);
      setInstallExecutionLoading(true);
      setHomologationLoading(true);
      setContractLoading(true);
      setEngineeringProjectLoading(true);
      setDocumentsLoading(true);

      const data = await loadFamilyDashboardData({ user, auth, db });
      applyDashboardData(data);
    } finally {
      setWaitlistLeadLoading(false);
      setGroupQueueLoading(false);
      setPlanLoading(false);
      setGroupLoading(false);
      setVisitJobLoading(false);
      setInstallationJobLoading(false);
      setInstallExecutionLoading(false);
      setHomologationLoading(false);
      setContractLoading(false);
      setEngineeringProjectLoading(false);
      setDocumentsLoading(false);
      setLoading(false);
    }
  }

  const derived = useMemo(() => {
    if (!familyData) return null;
    return derivePipelineFromFamily({ family: familyData });
  }, [familyData]);

  const pipelineReason = useMemo(() => String(derived?.pipeline_reason || "").trim(), [derived]);
  const pipelineUpdatedAt = useMemo(() => derived?.pipeline_updated_at || null, [derived]);

  const waitlist = useMemo(() => {
    const wlObj = familyData?.waitlist || {};
    const wlStatus =
      normStr(wlObj?.status) ||
      normStr(familyData?.waitlist_status) ||
      normStr(familyData?.lifecycle_status) ||
      normStr(familyData?.onboarding_status) ||
      "";

    const wlFlag =
      familyData?.is_waitlist === true ||
      familyData?.waitlist === true ||
      wlObj?.enabled === true ||
      wlObj?.active === true;

    const isWait =
      wlFlag ||
      wlStatus === "waitlist" ||
      wlStatus === "fila" ||
      wlStatus === "fila_de_espera" ||
      wlStatus === "fila de espera" ||
      wlStatus === "aguardando_selecao" ||
      wlStatus === "aguardando seleção" ||
      wlStatus === "em_analise" ||
      wlStatus === "em análise" ||
      wlStatus === "analise" ||
      wlStatus === "análise";

    if (!isWait) return { active: false };

    const label =
      wlStatus === "em_analise" ||
      wlStatus === "em análise" ||
      wlStatus === "analise" ||
      wlStatus === "análise"
        ? "Em análise"
        : "Fila de espera";

    const notes = String(wlObj?.notes || familyData?.waitlist_note || "").trim();
    const enteredAt = safeToDate(wlObj?.entered_at) || safeToDate(familyData?.waitlist_entered_at);

    return { active: true, label, notes, enteredAt };
  }, [familyData]);

  const monthlyPayment = familyData?.monthly_payment || 0;
  const billingDueDay = useMemo(() => getBillingDueDayFromFamily(familyData), [familyData]);

  const firstPayment = useMemo(() => {
    return (
      payments.find((p) => Number(p?.installment_number) === 1) ||
      payments.find((p) => String(p?.id || "").endsWith("_0001")) ||
      null
    );
  }, [payments]);

  const firstPaymentStatus = useMemo(() => normStr(firstPayment?.status || ""), [firstPayment]);
  const firstPaymentPaid = useMemo(() => firstPaymentStatus === "paid", [firstPaymentStatus]);

  const planId = familyData?.plan_id || familyData?.pre_enrolled_plan_id || null;
  const planName = planData?.name || null;
  const groupId = familyData?.group_id || familyData?.pre_enrolled_group_id || null;
  const groupName = groupData?.name || null;

  const documentsStatus = useMemo(() => {
    const sDoc = normStr(documentsDoc?.status);
    if (sDoc) return sDoc;

    const sFam = normStr(familyData?.documents_status);
    if (sFam) return sFam;

    const stage = normalizeStage(familyData?.pipeline_stage);
    const sub = normStr(familyData?.pipeline_substatus);
    if (stage === "cadastro" && sub) return sub;

    return "aguardando";
  }, [documentsDoc, familyData]);

  const documentsApproved = useMemo(
    () => normStr(documentsStatus) === "aprovado" || normStr(documentsStatus) === "approved",
    [documentsStatus]
  );

  const documentsSent = useMemo(() => {
    const s = normStr(documentsStatus);
    const sub = normStr(familyData?.pipeline_substatus);

    return (
      s === "enviado" ||
      s === "documentação enviada" ||
      s === "documentacao enviada" ||
      s === "documentação_enviada" ||
      s === "documentacao_enviada" ||
      s === "dcoumentação enviada" ||
      s === "dcoumentacao enviada" ||
      sub === "documento_enviado" ||
      sub === "documentacao_enviada" ||
      sub === "documentação_enviada"
    );
  }, [documentsStatus, familyData]);

  const pipelineStage = useMemo(() => {
    if (!familyData) return "cadastro";
    if (derived?.isActiveNow) return "ativo";
    if (!documentsApproved) return "cadastro";

    const gid = familyData?.group_id || null;
    const roleRaw = normStr(
      familyData?.group_role || familyData?.group_queue_role || familyData?.group_role
    );
    const isPrimary = roleRaw === "primary" || roleRaw === "titular";

    const gStatus = normStr(groupData?.status || familyData?.group_status || "");
    const groupActivated = gStatus === "closed" || gStatus === "activated";

    if (!gid) return "grupo";
    if (!groupActivated) return "grupo";
    if (!isPrimary) return "grupo";

    const activatedAt = safeToDate(groupData?.activated_at) || safeToDate(groupData?.completion_date) || null;
    const deadlineMs = activatedAt ? activatedAt.getTime() + 48 * 60 * 60 * 1000 : null;
    const now = Date.now();

    const cst = normStr(contractDoc?.status || "");
    const contractValidated = cst === "validated";

    if (deadlineMs && now > deadlineMs && !contractValidated) return "grupo";
    if (!contractValidated) return "contrato";
    if (!firstPaymentPaid) return "contrato";

    return "instalacao";
  }, [familyData, derived, documentsApproved, groupData, contractDoc, firstPaymentPaid]);

  const contractStatus = useMemo(() => String(contractDoc?.status || "").toLowerCase(), [contractDoc]);

  const contractUI = useMemo(() => {
    if (!contractDoc || !contractStatus) {
      return {
        badge: { text: "Pendente", className: "bg-amber-100 text-amber-700" },
        text: "Faça o download do contrato para seguir. Acesse o painel Contrato para download e assinatura.",
        tone: "warn",
      };
    }

    if (contractStatus === "pending_signature") {
      return {
        badge: { text: "Assinatura pendente", className: "bg-amber-100 text-amber-700" },
        text: "Você já baixou o Contrato. Assine-o no portal gov.br e nos envie.",
        tone: "warn",
      };
    }

    if (contractStatus === "signed_uploaded") {
      return {
        badge: { text: "Em análise", className: "bg-blue-100 text-blue-700" },
        text: "Arquivo enviado, gentileza aguardar análise.",
        tone: "info",
      };
    }

    if (contractStatus === "validated") {
      return firstPaymentPaid
        ? {
            badge: { text: "Validado", className: "bg-green-100 text-green-700" },
            text: "Contrato validado ✅ A 1ª parcela já foi confirmada. Agora seguimos com as etapas de instalação.",
            tone: "ok",
          }
        : {
            badge: { text: "Validado", className: "bg-green-100 text-green-700" },
            text: "Contrato validado ✅ Falta a confirmação da 1ª parcela para liberar a etapa de Instalação.",
            tone: "info",
          };
    }

    if (contractStatus === "refused") {
      return {
        badge: { text: "Recusado", className: "bg-red-100 text-red-700" },
        text: "O contrato não foi aprovado. Acesse o painel Contrato e obtenha mais informações.",
        tone: "danger",
      };
    }

    return {
      badge: { text: contractStatus, className: "bg-slate-100 text-slate-700" },
      text: "Faça o download do contrato para seguir. Acesse o painel Contrato para download e assinatura.",
      tone: "warn",
    };
  }, [contractDoc, contractStatus, firstPaymentPaid]);

  const processSteps = useMemo(() => PROCESS_STEPS, []);

  const currentProcessIndex = useMemo(() => {
    const cur = pipelineStage || "cadastro";
    const idx = processSteps.findIndex((s) => s.key === cur);
    return idx >= 0 ? idx : 0;
  }, [pipelineStage, processSteps]);

  const groupStatusNorm = useMemo(
    () => normStr(groupData?.status || familyData?.group_status || ""),
    [groupData, familyData]
  );
  const groupActivated = useMemo(
    () => groupStatusNorm === "closed" || groupStatusNorm === "activated",
    [groupStatusNorm]
  );

  const groupRoleNorm = useMemo(() => {
    return normStr(
      familyData?.group_queue_role ||
        familyData?.group_role ||
        familyData?.group_role_label ||
        groupQueueDerived?.role ||
        ""
    );
  }, [familyData, groupQueueDerived]);

  const isPrimaryInGroup = useMemo(() => {
    const r = groupRoleNorm;
    return r === "primary" || r === "titular";
  }, [groupRoleNorm]);

  const contractUnlocked = useMemo(() => {
    if (derived?.isActiveNow) return true;
    if (!documentsApproved) return false;
    if (!groupActivated) return false;
    if (!isPrimaryInGroup) return false;
    return true;
  }, [derived, documentsApproved, groupActivated, isPrimaryInGroup]);

  const contractLockReason = useMemo(() => {
    if (derived?.isActiveNow) return "";
    if (!documentsApproved) return "Aguardando aprovação da documentação.";
    if (!groupActivated) return "Aguardando o grupo ser ativado para liberar o contrato (48h).";
    if (!isPrimaryInGroup) return "Você está na lista de espera do grupo. Se uma vaga abrir, você será chamado.";
    return "";
  }, [derived, documentsApproved, groupActivated, isPrimaryInGroup]);

  const stepTone = (stepKey, idx) => {
    if (derived?.isActiveNow) return "green";
    if (stepKey === "ativo") return derived?.isActiveNow ? "green" : "yellow";
    if (idx < currentProcessIndex) return "green";
    return "yellow";
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        resetDashboardState();
        setLoading(false);
        return;
      }
      await loadAll(user);
    });

    return () => unsub();
  }, []);

  const installMini = useMemo(() => {
    if (!familyData) return null;

    const visitJobStatus = normStr(visitJob?.status);
    const visitResult = normStr(familyData?.visit_result);

    const v =
      visitResult === "aprovada" || visitResult === "approved"
        ? { key: "done", label: "Concluída" }
        : visitResult === "reprovada" || visitResult === "rejected" || visitResult === "recusada"
        ? { key: "warn", label: "Reprovada" }
        : !visitJob
        ? { key: "todo", label: "Aguardando agendamento" }
        : visitJobStatus === "scheduled"
        ? { key: "doing", label: "Agendada" }
        : visitJobStatus === "in_progress"
        ? { key: "doing", label: "Em andamento" }
        : visitJobStatus === "completed"
        ? { key: "doing", label: "Concluída (aguardando resultado)" }
        : visitJobStatus === "canceled"
        ? { key: "warn", label: "Cancelada" }
        : { key: "doing", label: "Em acompanhamento" };

    const cst = normStr(contractStatus);
    const e =
      cst !== "validated"
        ? { key: "lock", label: "Aguardando contrato" }
        : (() => {
            const st = normStr(engineeringProjectLast?.status || familyData?.engineering_status || "");
            if (!st || st === "pending") return { key: "todo", label: "Na fila" };
            if (st === "in_progress" || st === "submitted") return { key: "doing", label: "Em andamento" };
            if (st === "revision_requested") return { key: "warn", label: "Revisão solicitada" };
            if (st === "approved" || st === "completed") return { key: "done", label: "Concluído" };
            return { key: "doing", label: "Em andamento" };
          })();

    const fam = normStr(familyData?.installation_status);
    const exec = normStr(installExecution?.status);
    const job = normStr(installationJob?.status);

    const i =
      fam === "instalado" || fam === "completed"
        ? { key: "done", label: "Concluída" }
        : exec === "scheduled" || job === "scheduled"
        ? { key: "doing", label: "Agendada" }
        : exec === "in_progress" || job === "in_progress"
        ? { key: "doing", label: "Em andamento" }
        : exec === "completed" || job === "completed"
        ? { key: "done", label: "Concluída" }
        : exec === "canceled" || job === "canceled"
        ? { key: "warn", label: "Cancelada" }
        : { key: "todo", label: "Aguardando agendamento" };

    const installDone = i.key === "done";
    const hs = normStr(homologationDoc?.status || familyData?.homologation_status || "aguardando");
    const h =
      !installDone
        ? { key: "lock", label: "Após instalação" }
        : !hs || hs === "aguardando" || hs === "pending" || hs === "awaiting"
        ? { key: "todo", label: "Aguardando início" }
        : hs === "pendencia" || hs === "pending_docs" || hs === "rejected" || hs === "refused"
        ? { key: "warn", label: "Pendência" }
        : hs === "homologado" || hs === "homologated" || hs === "approved" || hs === "completed"
        ? { key: "done", label: "Concluída" }
        : { key: "doing", label: "Em andamento" };

    return { visit: v, engineering: e, install: i, homolog: h, installDone };
  }, [
    familyData,
    visitJob,
    engineeringProjectLast,
    contractStatus,
    installExecution,
    installationJob,
    homologationDoc,
  ]);

  const showInstallStagesCard = useMemo(() => {
    return derived?.isActiveNow || pipelineStage === "instalacao";
  }, [derived, pipelineStage]);

  const nextStepInfo = useMemo(() => {
    if (derived?.isActiveNow) {
      return {
        title: "Sistema ativo",
        desc: "Seu sistema já está ativo ✅ Caso precise de suporte, fale com a nossa equipe.",
      };
    }

    if (pipelineStage === "cadastro") {
      if (documentsSent) {
        return {
          title: "Documentos enviados ✅",
          desc: "Aguarde a análise em até 24h. Se houver pendência, vamos avisar por aqui.",
          cta: { label: `Ver documentos (${documentsLabel(documentsStatus)})`, to: documentsPageUrl },
        };
      }

      if (!documentsApproved) {
        return {
          title: "Documentação necessária",
          desc: [
            "Para seguir, é necessário o envio da documentação para análise.",
            pipelineReason ? `Motivo: ${pipelineReason}` : null,
          ]
            .filter(Boolean)
            .join(" "),
          cta: {
            label: documentsLoading ? "Carregando..." : `Documentos (${documentsLabel(documentsStatus)})`,
            to: documentsPageUrl,
          },
        };
      }

      return {
        title: "Cadastro concluído",
        desc: "Documentação aprovada ✅ Agora você entra na etapa de Grupo (fila e alocação).",
      };
    }

    if (pipelineStage === "grupo") {
      const gid = familyData?.group_id || familyData?.pre_enrolled_group_id || null;
      const gName = groupData?.name || gid || "Grupo";
      const gStatus = normStr(groupData?.status || familyData?.group_status || "");
      const gActivated = gStatus === "closed" || gStatus === "activated";
      const wp = familyData?.waitlist_position || waitlistLead?.waitlist_position || null;
      const idx = groupQueueDerived?.idx || null;
      const role = normStr(groupQueueDerived?.role || "");
      const capacity =
        groupQueueDerived?.capacity ||
        Number(groupData?.max_participants || groupData?.max_families || groupData?.capacity || 0) ||
        0;
      const queueLimit = groupQueueDerived?.queueLimit || null;
      const isPrimary = role === "primary" || role === "titular";
      const isStandby = role === "standby";
      const roleLabel = isPrimary ? "Titular" : isStandby ? "Lista de espera" : "—";

      if (!gid) {
        return {
          title: "Grupo",
          desc: [
            "Aguardando inclusão em um grupo.",
            wp ? `Sua posição geral na fila: #${wp}.` : null,
            "Assim que houver alocação, sua posição no grupo aparecerá aqui.",
          ]
            .filter(Boolean)
            .join(" "),
        };
      }

      const queueText =
        idx && capacity
          ? isStandby
            ? `Você está na lista de espera do grupo (posição ${Math.max(1, idx - capacity)}${
                queueLimit ? `/${Math.max(0, queueLimit - capacity)}` : ""
              }).`
            : `Você é titular do grupo (posição ${idx}${capacity ? `/${capacity}` : ""}).`
          : null;

      if (!gActivated) {
        return {
          title: "Grupo",
          desc: [
            `Grupo: ${gName}.`,
            queueText,
            roleLabel !== "—" ? `Tipo: ${roleLabel}.` : null,
            wp ? `Fila geral: #${wp}.` : null,
            queueLimit ? `Fila do grupo: ${idx ? idx : "—"}/${queueLimit}.` : null,
            groupQueueDerived?.source === "none"
              ? "Sua posição no grupo será exibida assim que você for importado para a lista do grupo."
              : null,
            "Quando o grupo for ativado, os titulares terão 48h para assinar o contrato e pagar a 1ª mensalidade.",
          ]
            .filter(Boolean)
            .join(" "),
        };
      }

      if (isPrimary) {
        const activatedAt = safeToDate(groupData?.activated_at) || null;
        const deadline = activatedAt ? new Date(activatedAt.getTime() + 48 * 60 * 60 * 1000) : null;

        return {
          title: "Grupo ativado",
          desc: [
            `Grupo: ${gName}.`,
            queueText,
            deadline
              ? `Prazo: até ${deadline.toLocaleString("pt-BR")} para assinar e pagar.`
              : "Prazo de 48h para assinar e pagar.",
          ]
            .filter(Boolean)
            .join(" "),
          cta: { label: "Abrir contrato", to: createPageUrl("family/contract") },
        };
      }

      return {
        title: "Lista de espera do grupo",
        desc: [
          `Grupo: ${gName}.`,
          queueText,
          "Você está na lista de espera. Se uma vaga abrir (48h expirou de um titular), você será chamado.",
        ]
          .filter(Boolean)
          .join(" "),
      };
    }

    if (pipelineStage === "contrato") {
      const gid = familyData?.group_id || null;
      const roleRaw = normStr(familyData?.group_role || familyData?.group_queue_role || familyData?.group_role);
      const isPrimary = roleRaw === "primary" || roleRaw === "titular";
      const gStatus = normStr(groupData?.status || familyData?.group_status || "");
      const gActivated = gStatus === "closed" || gStatus === "activated";

      if (!gid || !gActivated || !isPrimary) {
        return {
          title: "Contrato",
          desc: "Contrato disponível quando o grupo for ativado e você estiver como Titular. Até lá, acompanhe em Grupo.",
        };
      }

      const activatedAt = safeToDate(groupData?.activated_at) || safeToDate(groupData?.completion_date) || null;
      const deadline = activatedAt ? new Date(activatedAt.getTime() + 48 * 60 * 60 * 1000) : null;

      if (deadline && Date.now() > deadline.getTime() && normStr(contractDoc?.status || "") !== "validated") {
        return {
          title: "Prazo expirado",
          desc: "A janela de 48h expirou sem confirmação. Sua vaga pode ter passado para a lista de espera. Fale com a equipe no WhatsApp.",
          cta: { label: "Abrir contrato", to: createPageUrl("family/contract") },
        };
      }

      if (contractLoading) return { title: "Contrato", desc: "Carregando status do contrato..." };

      if (contractStatus !== "validated") {
        return {
          title: "Contrato",
          desc: pipelineReason || contractUI.text,
          cta: { label: "Abrir contrato", to: createPageUrl("family/contract") },
        };
      }

      if (!firstPaymentPaid) {
        return {
          title: "1ª parcela",
          desc: "Contrato validado ✅ Agora falta a confirmação da 1ª parcela para liberar a etapa de Instalação.",
          cta: { label: "Abrir pagamentos", to: createPageUrl("payments") },
        };
      }

      return { title: "Contrato e 1ª parcela", desc: "Contrato validado e 1ª parcela paga ✅ Agora seguimos com as etapas de instalação." };
    }

    if (pipelineStage === "instalacao") {
      if (contractLoading) return { title: "Instalação", desc: "Carregando informações..." };
      if (contractStatus && contractStatus !== "validated") {
        return {
          title: "Antes da instalação",
          desc: "Precisamos concluir o contrato para avançar com as etapas de instalação.",
          cta: { label: "Abrir contrato", to: createPageUrl("family/contract") },
        };
      }

      if (visitJobLoading) return { title: "Instalação", desc: "Carregando status da visita técnica..." };
      if (engineeringProjectLoading) return { title: "Instalação", desc: "Carregando status do projeto elétrico..." };
      if (installExecutionLoading || installationJobLoading) return { title: "Instalação", desc: "Carregando status da instalação..." };
      if (homologationLoading) return { title: "Instalação", desc: "Carregando status da homologação..." };

      const vKey = installMini?.visit?.key;
      if (vKey && vKey !== "done") {
        const jobStatus = normStr(visitJob?.status);
        const techName = visitJob?.technician_name || null;

        let scheduledText = null;
        const dt = safeToDate(visitJob?.scheduled_at);
        if (dt && !Number.isNaN(dt.getTime())) {
          const date = dt.toLocaleDateString("pt-BR");
          const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          scheduledText = `${date} às ${time}`;
        }

        if (!visitJob) {
          return { title: "Visita", desc: pipelineReason || "Aguardando agendamento da visita técnica." };
        }

        if (jobStatus === "canceled") {
          return { title: "Visita", desc: pipelineReason || "A visita técnica foi cancelada. Aguarde um novo agendamento." };
        }

        if (jobStatus === "scheduled") {
          const parts = [];
          parts.push(`Visita técnica agendada${scheduledText ? ` para ${scheduledText}` : ""}.`);
          if (techName) parts.push(`Técnico responsável: ${techName}.`);
          return { title: "Visita", desc: parts.join(" ") };
        }

        if (jobStatus === "in_progress") {
          const who = techName ? `Técnico ${techName}` : "O técnico";
          return { title: "Visita", desc: `${who} está a caminho. Assim que a visita for concluída, você verá o resultado aqui.` };
        }

        return { title: "Visita", desc: pipelineReason || "A visita técnica está em acompanhamento. Assim que houver atualização, ela aparecerá aqui." };
      }

      const eKey = installMini?.engineering?.key;
      if (eKey && eKey !== "done" && eKey !== "lock") {
        const projStatus = engineeringProjectLast?.status || familyData?.engineering_status || "";
        const projInfo = engineeringNextStepByStatus(projStatus);
        return { title: projInfo.title, desc: pipelineReason ? `${projInfo.desc} Motivo: ${pipelineReason}` : projInfo.desc };
      }

      const iKey = installMini?.install?.key;
      if (iKey && iKey !== "done") {
        const instInfo = installationNextStepByExecution(installExecution, installationJob, familyData);
        return { title: instInfo.title, desc: pipelineReason ? `${instInfo.desc} Motivo: ${pipelineReason}` : instInfo.desc };
      }

      const hKey = installMini?.homolog?.key;
      if (hKey && hKey !== "done" && hKey !== "lock") {
        const info = homologationNextStepInfo(homologationDoc, familyData);
        return { title: info.title, desc: pipelineReason ? `${info.desc} Motivo: ${pipelineReason}` : info.desc };
      }

      return { title: "Instalação", desc: "Etapas concluídas ✅ Agora aguardamos a ativação do sistema." };
    }

    return {
      title: "Próximo passo",
      desc:
        pipelineReason ||
        "Acompanhe o andamento do processo. Assim que houver atualização, ela aparecerá por aqui.",
    };
  }, [
    derived,
    pipelineStage,
    pipelineReason,
    documentsApproved,
    documentsSent,
    documentsLoading,
    documentsStatus,
    documentsPageUrl,
    familyData,
    groupData,
    groupQueueDerived,
    waitlistLead,
    contractLoading,
    contractStatus,
    contractUI,
    contractDoc,
    firstPaymentPaid,
    installMini,
    visitJobLoading,
    visitJob,
    engineeringProjectLoading,
    engineeringProjectLast,
    installExecutionLoading,
    installExecution,
    installationJobLoading,
    installationJob,
    homologationLoading,
    homologationDoc,
  ]);

  const pendingItems = useMemo(() => {
    const items = [];

    if (!derived?.isActiveNow && pipelineStage === "cadastro") {
      if (!documentsApproved && !documentsSent) {
        items.push({
          id: "docs",
          title: "Envie sua documentação",
          desc: `Status atual: ${documentsLabel(documentsStatus)}.`,
          to: documentsPageUrl,
          cta: "Abrir documentos",
          icon: ClipboardList,
          tone: "warn",
        });
      }

      if (documentsSent) {
        items.push({
          id: "docs_sent",
          title: "Documentos enviados ✅",
          desc: "Aguarde a análise em até 24h. Se houver pendência, vamos avisar por aqui.",
          to: documentsPageUrl,
          cta: "Ver envio",
          icon: AlertTriangle,
          tone: "warn",
        });
      }
    }

    if (familyData?.contract_signed === false) {
      items.push({
        id: "contract",
        title: "Assine o contrato",
        desc: "Assinatura necessária para seguir com o processo.",
        to: createPageUrl("family/contract"),
        cta: "Abrir contrato",
        icon: ClipboardList,
        tone: "warn",
      });
    }

    if (familyData?.payment_pending === true) {
      items.push({
        id: "pay",
        title: "Pagamento pendente",
        desc: "Regularize para evitar pausa no andamento.",
        to: createPageUrl("payments"),
        cta: "Ver pagamentos",
        icon: CreditCard,
        tone: "danger",
      });
    }

    return items.slice(0, 4);
  }, [derived, familyData, documentsApproved, documentsSent, documentsStatus, documentsPageUrl, pipelineStage]);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Carregando seu painel...</h2>
        <p className="text-slate-500">Buscando informações da sua família.</p>
      </div>
    );
  }

  if (!familyData) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Nenhum cadastro encontrado</h2>
        <p className="text-slate-500">Não localizamos um perfil de família vinculado a este usuário.</p>
      </div>
    );
  }

  const displayFamilyStatus = derived?.isActiveNow ? "active" : (familyData.status || "ApprovalPending");

  return (
    <div className="space-y-6">
      <DashboardHeader
        familyData={familyData}
        waitlist={waitlist}
        isActiveNow={derived?.isActiveNow}
        pipelineUpdatedAtText={fmtDateTimeBR(pipelineUpdatedAt)}
      />

      <TopInfoCards
        statusLabels={statusLabels}
        displayFamilyStatus={displayFamilyStatus}
        isActiveNow={derived?.isActiveNow}
        waitlist={waitlist}
        planId={planId}
        planLoading={planLoading}
        planName={planName}
        groupId={groupId}
        groupLoading={groupLoading}
        groupName={groupName}
        groupData={groupData}
        groupStatusLabels={groupStatusLabels}
        groupQueueLoading={groupQueueLoading}
        groupQueueDerived={groupQueueDerived}
        contractUnlocked={contractUnlocked}
        contractUI={contractUI}
        contractLoading={contractLoading}
        contractStatus={contractStatus}
        contractLockReason={contractLockReason}
        monthlyPayment={monthlyPayment}
        billingDueDay={billingDueDay}
        createPageUrl={createPageUrl}
      />

      <PipelineProgress
        title="Progresso do processo"
        titleIcon={Zap}
        steps={processSteps}
        currentIndex={currentProcessIndex}
        getTone={stepTone}
        substatus={familyData?.pipeline_substatus || ""}
        nextStep={nextStepInfo}
      />

      {showInstallStagesCard && (
        <InstallationStagesCard
          installMini={installMini}
          visitJob={visitJob}
          engineeringProjectLast={engineeringProjectLast}
          installationJob={installationJob}
          homologationDoc={homologationDoc}
          visitJobLoading={visitJobLoading}
          engineeringProjectLoading={engineeringProjectLoading}
          installExecutionLoading={installExecutionLoading}
          installationJobLoading={installationJobLoading}
          homologationLoading={homologationLoading}
        />
      )}

      <PendingItemsCard pendingItems={pendingItems} />
      <PaymentsCard payments={payments} />
    </div>
  );
}

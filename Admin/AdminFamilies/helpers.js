import { DOC_STATUS, processSteps } from "./constants";

export function normStr(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

export function getAnyGroupIdFrom(obj) {
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

export function getFamilyGroupId(obj) {
  const gid = getAnyGroupIdFrom(obj);
  return gid ? String(gid).trim() : null;
}

export function searchParamValue(params, keys, fallback = "") {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

export function getGroupLabel(group, fallbackId = "") {
  const label =
    group?.name ||
    group?.title ||
    group?.label ||
    group?.group_name ||
    group?.code ||
    group?.number ||
    "";

  if (String(label || "").trim()) return String(label).trim();
  if (fallbackId) return `Grupo ${fallbackId}`;
  return "Sem grupo";
}

export function safeToDate(ts) {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tsToMillis(ts) {
  const d = safeToDate(ts);
  return d ? d.getTime() : 0;
}

export function pickDocumentUrl(fileLike) {
  if (!fileLike) return "";
  return String(
    fileLike?.url ||
      fileLike?.downloadURL ||
      fileLike?.download_url ||
      fileLike?.link ||
      "",
  ).trim();
}

export function pickDocumentStoragePath(fileLike) {
  if (!fileLike) return "";
  return String(
    fileLike?.path ||
      fileLike?.storage_path ||
      fileLike?.storagePath ||
      fileLike?.fullPath ||
      fileLike?.full_path ||
      "",
  ).trim();
}

export function fmtDateTimeBR(d) {
  if (!d) return "—";
  try {
    return d.toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

export function formatScheduleBR(dt) {
  if (!dt || Number.isNaN(dt.getTime())) return null;
  const date = dt.toLocaleDateString("pt-BR");
  const time = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} às ${time}`;
}

export function getBillingDueDayFromFamily(family) {
  const dueDay =
    (Number.isFinite(Number(family?.billing_due_day)) && Number(family?.billing_due_day)) ||
    (Number.isFinite(Number(family?.due_day)) && Number(family?.due_day)) ||
    null;

  if (!dueDay) return null;
  if (dueDay < 1 || dueDay > 31) return null;
  return dueDay;
}

export function badgeForDocs(status) {
  const value = normStr(status);
  if (value === DOC_STATUS.APROVADO) {
    return { t: "Aprovado", cn: "bg-green-100 text-green-700" };
  }
  if (value === DOC_STATUS.ENVIADO) {
    return { t: "Enviado", cn: "bg-blue-100 text-blue-700" };
  }
  if (value === DOC_STATUS.INICIADO) {
    return { t: "Iniciado", cn: "bg-amber-100 text-amber-700" };
  }
  if (value === DOC_STATUS.REPROVADO) {
    return { t: "Reprovado", cn: "bg-rose-100 text-rose-700" };
  }
  return { t: "Aguardando", cn: "bg-slate-100 text-slate-700" };
}

export function badgeForSubstatus(subRaw) {
  const value = normStr(subRaw);

  const isSent =
    value === "enviado" ||
    value === "documentação enviada" ||
    value === "documentacao enviada" ||
    value === "documentação_enviada" ||
    value === "documentacao_enviada" ||
    value === "dcoumentação enviada" ||
    value === "dcoumentacao enviada";

  if (isSent) {
    return { t: "Documentação enviada", cn: "bg-blue-100 text-blue-700" };
  }
  if (value === "aprovado" || value === "approved") {
    return { t: "Aprovado", cn: "bg-green-100 text-green-700" };
  }
  if (value === "reprovado" || value === "reprovada" || value === "rejected") {
    return { t: "Reprovado", cn: "bg-rose-100 text-rose-700" };
  }
  if (value === "iniciado") {
    return { t: "Iniciado", cn: "bg-amber-100 text-amber-700" };
  }
  if (value === "aguardando" || value === "pending") {
    return { t: "Aguardando", cn: "bg-slate-100 text-slate-700" };
  }
  if (!value) return { t: "", cn: "" };

  const pretty = String(subRaw || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  return { t: pretty, cn: "bg-slate-100 text-slate-700" };
}

export function pipelineLabelForKey(keyRaw) {
  const key = normStr(keyRaw);
  const found = processSteps.find((step) => step.key === key);
  return found?.label || (keyRaw ? String(keyRaw) : "Cadastro");
}

export function normalizeStage(stageRaw) {
  const stage = normStr(stageRaw);

  const legacyMap = {
    cadastro: "cadastro",
    contrato: "contrato",
    instalacao: "instalacao",
    instalação: "instalacao",
    installation: "instalacao",
    install: "instalacao",
    ativo: "ativo",
    plano: "grupo",
    grupo: "grupo",
    visita: "instalacao",
    projeto_eletrico: "instalacao",
    "projeto elétrico": "instalacao",
    homologacao: "instalacao",
    homologação: "instalacao",
  };

  const mapped = legacyMap[stage] || null;
  if (mapped) return mapped;

  const valid = new Set(processSteps.map((item) => item.key));
  return valid.has(stage) ? stage : "cadastro";
}

export function derivePipeline({
  family,
  documentsDoc,
  contractDoc,
  engineeringProjectLast,
  visitJob,
  installationJob,
  installExecution,
  homologationDoc,
}) {
  if (!family) return null;

  const familyStatus = normStr(family.status);
  const docsStatus = normStr(
    documentsDoc?.status || family.documents_status || DOC_STATUS.AGUARDANDO,
  );
  const docsApproved = docsStatus === DOC_STATUS.APROVADO;
  const contractStatus = normStr(contractDoc?.status || "");
  const engineeringStatus =
    engineeringProjectLast?.status || family.engineering_status || "aguardando";

  const visitJobRaw = normStr(visitJob?.status);
  const hasVisit = !!visitJob;
  const visitStatus = !hasVisit
    ? "aguardando"
    : visitJobRaw === "scheduled"
      ? "agendada"
      : visitJobRaw === "in_progress"
        ? "em_andamento"
        : visitJobRaw === "completed"
          ? "realizada"
          : visitJobRaw === "canceled"
            ? "cancelada"
            : "aguardando";

  const visitScheduledAt =
    safeToDate(visitJob?.scheduled_at) ||
    safeToDate(visitJob?.scheduled_date) ||
    safeToDate(visitJob?.date) ||
    safeToDate(visitJob?.updated_at) ||
    safeToDate(visitJob?.created_at) ||
    null;

  const visitScheduledText = formatScheduleBR(visitScheduledAt);
  const visitTechName =
    visitJob?.technician_name ||
    visitJob?.crew_name ||
    visitJob?.technician ||
    null;

  const installExecRaw = normStr(installExecution?.status);
  const installJobRaw = normStr(installationJob?.status);
  const hasInstallExecution = !!installExecution;
  const hasInstallationJob = !!installationJob;

  const installationStatusJob = !hasInstallationJob
    ? "aguardando"
    : installJobRaw === "scheduled"
      ? "agendada"
      : installJobRaw === "in_progress"
        ? "em_andamento"
        : installJobRaw === "completed"
          ? "instalado"
          : installJobRaw === "canceled"
            ? "cancelada"
            : "aguardando";

  const installationStatusExec = !hasInstallExecution
    ? ""
    : installExecRaw === "scheduled"
      ? "agendada"
      : installExecRaw === "in_progress"
        ? "em_andamento"
        : installExecRaw === "completed"
          ? "instalado"
          : installExecRaw === "canceled"
            ? "cancelada"
            : "";

  const installationStatus = installationStatusExec || installationStatusJob || "aguardando";
  const homologationStatus =
    normStr(homologationDoc?.status) || normStr(family.homologation_status) || "aguardando";

  const activationStatus =
    family.activation_status || (familyStatus === "active" ? "kit_ativo" : "kit_inativo");
  const isActiveNow = activationStatus === "kit_ativo" || familyStatus === "active";

  const pipelineStage = isActiveNow ? "ativo" : normalizeStage(family.pipeline_stage);

  return {
    docs_status: docsStatus,
    docsApproved,
    contract_status: contractStatus,
    engineering_status: normStr(engineeringStatus),
    visit_status: visitStatus,
    visit_job_status: visitJobRaw,
    visit_scheduled_text: visitScheduledText,
    visit_tech_name: visitTechName,
    installation_status: installationStatus,
    homologation_status: homologationStatus,
    activation_status: activationStatus,
    pipeline_stage: pipelineStage,
    pipeline_substatus: normStr(family.pipeline_substatus || ""),
    pipeline_reason: String(family.pipeline_reason || "").trim(),
    pipeline_updated_at: safeToDate(family.pipeline_updated_at) || safeToDate(family.updated_at),
    isActiveNow,
  };
}

export function nextStepForPipeline({ pipeline, firstPaymentPaid }) {
  if (!pipeline) return { title: "Próximo passo", desc: "—" };

  if (pipeline.isActiveNow) {
    return { title: "Sistema ativo", desc: "Sistema já ativo ✅" };
  }

  if (normStr(pipeline.docs_status) === DOC_STATUS.ENVIADO) {
    return {
      title: "Documentos enviados",
      desc: "Análise da documentação pendente.",
    };
  }

  if (pipeline.pipeline_stage === "cadastro") {
    if (pipeline.docsApproved) {
      return {
        title: "Cadastro concluído",
        desc: pipeline.pipeline_reason || "Documentação aprovada ✅ Próximo: grupo.",
      };
    }
    return {
      title: "Documentação necessária",
      desc: pipeline.pipeline_reason || "Aguardando envio/análise da documentação.",
    };
  }

  if (pipeline.pipeline_stage === "contrato") {
    const contractStatus = normStr(pipeline.contract_status);

    if (contractStatus === "validated") {
      if (!firstPaymentPaid) {
        return {
          title: "1ª parcela",
          desc: "Contrato validado ✅ Falta a confirmação da 1ª parcela para avançar para Instalação.",
        };
      }
      return {
        title: "Contrato e 1ª parcela",
        desc: "Contrato validado e 1ª parcela paga ✅ Próximo: instalação.",
      };
    }

    if (contractStatus === "signed_uploaded") {
      return {
        title: "Contrato",
        desc: "Arquivo enviado • aguardando aprovação.",
      };
    }

    if (contractStatus === "refused") {
      return {
        title: "Contrato recusado",
        desc:
          pipeline.pipeline_reason ||
          "Contrato recusado. Solicite o reenvio do documento assinado.",
      };
    }

    if (!contractStatus || contractStatus === "pending_signature") {
      return {
        title: "Contrato",
        desc: pipeline.pipeline_reason || "Pendente de assinatura.",
      };
    }

    return {
      title: "Contrato",
      desc: pipeline.pipeline_reason || `Status: ${contractStatus}.`,
    };
  }

  if (pipeline.pipeline_stage === "instalacao") {
    const contractStatus = normStr(pipeline.contract_status);
    if (contractStatus && contractStatus !== "validated") {
      return {
        title: "Antes da instalação",
        desc: "Contrato precisa ser validado para avançar nas etapas de instalação.",
      };
    }

    const visitJobStatus = normStr(pipeline.visit_job_status);
    const when = pipeline.visit_scheduled_text;
    const technician = pipeline.visit_tech_name;

    if (!visitJobStatus) {
      return {
        title: "Visita",
        desc: pipeline.pipeline_reason || "Aguardando agendamento da visita técnica.",
      };
    }

    if (visitJobStatus === "scheduled") {
      const parts = [];
      parts.push(`Visita técnica agendada${when ? ` para ${when}` : ""}.`);
      if (technician) parts.push(`Técnico: ${technician}.`);
      return { title: "Visita", desc: parts.join(" ") };
    }

    if (visitJobStatus === "in_progress") {
      return {
        title: "Visita em andamento",
        desc: `${technician ? `Técnico ${technician}` : "O técnico"} está em andamento. Acompanhe as atualizações.`,
      };
    }

    if (visitJobStatus === "canceled") {
      return {
        title: "Visita cancelada",
        desc: "A visita foi cancelada. Aguarde um novo agendamento.",
      };
    }

    if (visitJobStatus !== "completed") {
      return {
        title: "Visita",
        desc: pipeline.pipeline_reason || "Aguardando andamento da visita técnica.",
      };
    }

    const engineeringStatus = normStr(pipeline.engineering_status);
    if (!engineeringStatus || engineeringStatus === "aguardando" || engineeringStatus === "pending") {
      return { title: "Projeto", desc: "Na fila da engenharia." };
    }
    if (engineeringStatus === "in_progress") {
      return { title: "Projeto", desc: "Em andamento na engenharia." };
    }
    if (engineeringStatus === "revision_requested") {
      return {
        title: "Projeto",
        desc: "Revisão solicitada pela engenharia. Verifique pendências/observações.",
      };
    }
    if (engineeringStatus !== "approved" && engineeringStatus !== "completed") {
      return { title: "Projeto", desc: `Status: ${engineeringStatus}.` };
    }

    const installationStatus = normStr(pipeline.installation_status);
    if (!installationStatus || installationStatus === "aguardando") {
      return {
        title: "Instalação",
        desc: "Aguardando agendamento da instalação.",
      };
    }
    if (installationStatus === "agendada") {
      return {
        title: "Instalação agendada",
        desc: "Instalação agendada. Acompanhe a execução.",
      };
    }
    if (installationStatus === "em_andamento") {
      return {
        title: "Instalação em andamento",
        desc: "Equipe em execução. Acompanhe as atualizações.",
      };
    }
    if (installationStatus === "cancelada") {
      return {
        title: "Instalação cancelada",
        desc: "A instalação foi cancelada. Aguarde novo agendamento.",
      };
    }
    if (installationStatus !== "instalado") {
      return { title: "Instalação", desc: `Status: ${installationStatus}.` };
    }

    const homologationStatus = normStr(pipeline.homologation_status);
    if (!homologationStatus || homologationStatus === "aguardando" || homologationStatus === "pending" || homologationStatus === "awaiting") {
      return {
        title: "Homologação",
        desc: "Aguardando início da homologação.",
      };
    }
    if (
      homologationStatus === "pendencia" ||
      homologationStatus === "pending_docs" ||
      homologationStatus === "rejected" ||
      homologationStatus === "refused"
    ) {
      return {
        title: "Homologação",
        desc: "Pendência na homologação. Verifique observações.",
      };
    }
    if (
      homologationStatus === "homologado" ||
      homologationStatus === "homologated" ||
      homologationStatus === "approved" ||
      homologationStatus === "completed"
    ) {
      return {
        title: "Homologação concluída",
        desc: "Homologação concluída ✅ Aguardando ativação.",
      };
    }
    return { title: "Homologação", desc: `Status: ${homologationStatus}.` };
  }

  return {
    title: "Próximo passo",
    desc: pipeline.pipeline_reason || "Acompanhar andamento.",
  };
}

export function flattenDocumentFiles(documentsDoc) {
  const out = [];

  const items = Array.isArray(documentsDoc?.items) ? documentsDoc.items : [];
  for (const item of items) {
    const files = Array.isArray(item?.files) ? item.files : [];
    for (const file of files) {
      out.push({
        name: file?.name || file?.file_name || "Arquivo",
        url: file?.url || file?.downloadURL || file?.download_url || file?.link || "",
        path:
          file?.path ||
          file?.storage_path ||
          file?.storagePath ||
          file?.fullPath ||
          file?.full_path ||
          "",
        contentType: file?.contentType || file?.type || "",
        size: file?.size || file?.bytes || null,
      });
    }
  }

  const directFiles = Array.isArray(documentsDoc?.files) ? documentsDoc.files : [];
  for (const file of directFiles) {
    out.push({
      name: file?.name || file?.file_name || "Arquivo",
      url: file?.url || file?.downloadURL || file?.download_url || file?.link || "",
      path:
        file?.path ||
        file?.storage_path ||
        file?.storagePath ||
        file?.fullPath ||
        file?.full_path ||
        "",
      contentType: file?.contentType || file?.type || "",
      size: file?.size || file?.bytes || null,
    });
  }

  const seen = new Set();
  return out.filter((file) => {
    const key = file.url || `${file.name}-${file.size || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

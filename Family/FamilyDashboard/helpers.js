export function normStr(v) {
  return String(v ?? "").trim().toLowerCase();
}

export function tsToMillis(v) {
  if (!v) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v?.toMillis === "function") {
    try { return v.toMillis(); } catch (_) {}
  }
  if (typeof v?.toDate === "function") {
    try {
      const d = v.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    } catch (_) {}
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 0 : v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof v === "object") {
    const seconds = Number(v.seconds);
    const nanos = Number(v.nanoseconds || 0);
    if (Number.isFinite(seconds)) return seconds * 1000 + Math.floor(nanos / 1e6);
    const ms = Number(v._seconds);
    if (Number.isFinite(ms)) return ms * 1000;
  }
  return 0;
}

export function safeToDate(v) {
  const ms = tsToMillis(v);
  if (!ms) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTimeBR(v) {
  const d = safeToDate(v);
  return d ? d.toLocaleString("pt-BR") : "—";
}

export function normalizeStage(stage) {
  const s = normStr(stage).replace(/[-\s]+/g, "_");
  if (!s) return "cadastro";
  if (["cadastro", "documentos", "docs"].includes(s)) return "cadastro";
  if (["grupo", "fila", "waitlist"].includes(s)) return "grupo";
  if (["contrato", "assinatura", "contract"].includes(s)) return "contrato";
  if (["instalacao", "instalação", "instalacao_execucao", "installation"].includes(s)) return "instalacao";
  if (["ativo", "active", "kit_ativo", "homologado", "homologada"].includes(s)) return "ativo";
  return s;
}

export const PROCESS_STEPS = [
  { key: "cadastro", label: "Cadastro" },
  { key: "grupo", label: "Grupo" },
  { key: "contrato", label: "Contrato" },
  { key: "instalacao", label: "Instalação" },
  { key: "ativo", label: "Ativo" },
];

export function documentsLabel(status) {
  const s = normStr(status)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  const map = {
    aguardando: "Aguardando",
    iniciado: "Iniciado",
    enviado: "Enviado",
    documento_enviado: "Documentação enviada",
    documentacao_enviada: "Documentação enviada",
    aprovado: "Aprovado",
    approved: "Aprovado",
    reprovado: "Reprovado",
    rejected: "Reprovado",
    pendencia: "Pendência",
    pendente: "Pendência",
  };

  return map[s] || (status ? String(status) : "Aguardando");
}

export function getBillingDueDayFromFamily(family) {
  const candidates = [
    family?.billing_due_day,
    family?.due_day,
    family?.billing?.due_day,
    family?.billing?.day,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isInteger(n) && n >= 1 && n <= 31) return n;
  }
  return null;
}

export function badgeByMiniStatus(key) {
  const k = normStr(key);
  if (k === "done") return "bg-green-100 text-green-700";
  if (k === "doing") return "bg-blue-100 text-blue-700";
  if (k === "warn") return "bg-amber-100 text-amber-800";
  if (k === "lock") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-700";
}

export function homologationLabel(status) {
  const s = normStr(status);
  if (!s || s === "aguardando" || s === "pending" || s === "awaiting") return "Aguardando início";
  if (["pending_docs", "pendencia", "rejected", "refused"].includes(s)) return "Pendência";
  if (["meter_exchange_scheduled", "troca_medidor_agendada"].includes(s)) return "Troca de medidor agendada";
  if (["meter_exchanged", "medidor_trocado"].includes(s)) return "Medidor trocado";
  if (["request_submitted", "pedido_enviado"].includes(s)) return "Pedido enviado";
  if (["under_review", "em_analise", "em análise"].includes(s)) return "Em análise";
  if (["homologado", "homologated", "approved", "completed"].includes(s)) return "Homologada";
  return status ? String(status) : "Aguardando início";
}

export function derivePipelineFromFamily({ family }) {
  const status = normStr(family?.status);
  const activation = normStr(family?.activation_status);
  const homolog = normStr(family?.homologation_status);
  const active =
    status === "active" ||
    status === "ativo" ||
    activation === "kit_ativo" ||
    activation === "active" ||
    homolog === "homologado" ||
    homolog === "homologated";

  return {
    isActiveNow: active,
    pipeline_stage: normalizeStage(family?.pipeline_stage),
    pipeline_reason: String(family?.pipeline_reason || family?.pipeline_substatus_reason || "").trim(),
    pipeline_updated_at: family?.pipeline_updated_at || family?.updated_at || null,
  };
}

export function engineeringNextStepByStatus(status) {
  const s = normStr(status);
  if (!s || s === "pending") return { title: "Projeto elétrico", desc: "Seu projeto elétrico ainda não entrou em execução. Assim que iniciarmos, o status aparecerá aqui." };
  if (s === "submitted" || s === "in_progress") return { title: "Projeto elétrico", desc: "O projeto elétrico está em andamento. Assim que for finalizado, avançaremos para a instalação." };
  if (s === "revision_requested") return { title: "Projeto elétrico", desc: "O projeto elétrico recebeu pedido de revisão. Nossa equipe já está tratando isso." };
  if (s === "approved" || s === "completed") return { title: "Projeto elétrico", desc: "Projeto elétrico concluído. Seguimos para a instalação." };
  return { title: "Projeto elétrico", desc: `Status atual: ${status || "em andamento"}.` };
}

export function installationNextStepByExecution(installExecution, installationJob, family) {
  const exec = normStr(installExecution?.status);
  const job = normStr(installationJob?.status);
  const fam = normStr(family?.installation_status);
  const scheduled = safeToDate(installationJob?.scheduled_at || installExecution?.scheduled_at);
  if (fam === "instalado" || fam === "completed" || exec === "completed" || job === "completed") {
    return { title: "Instalação", desc: "Instalação concluída ✅ Agora seguimos para a homologação." };
  }
  if (exec === "scheduled" || job === "scheduled") {
    return { title: "Instalação", desc: `A instalação foi agendada${scheduled ? ` para ${scheduled.toLocaleString("pt-BR")}` : ""}.` };
  }
  if (exec === "in_progress" || job === "in_progress") {
    return { title: "Instalação", desc: "A instalação está em andamento." };
  }
  if (exec === "canceled" || job === "canceled") {
    return { title: "Instalação", desc: "A instalação foi cancelada. Nossa equipe fará um novo agendamento." };
  }
  return { title: "Instalação", desc: "Aguardando agendamento da instalação." };
}

export function homologationNextStepInfo(homologationDoc, family) {
  const status = normStr(homologationDoc?.status || family?.homologation_status);
  if (!status || status === "aguardando" || status === "pending" || status === "awaiting") {
    return { title: "Homologação", desc: "A homologação ainda não foi iniciada." };
  }
  if (["request_submitted", "pedido_enviado"].includes(status)) {
    return { title: "Homologação", desc: "O pedido de homologação já foi enviado à concessionária." };
  }
  if (["under_review", "em_analise", "em análise", "meter_exchange_scheduled", "troca_medidor_agendada", "meter_exchanged", "medidor_trocado"].includes(status)) {
    return { title: "Homologação", desc: `Status atual: ${homologationLabel(status)}.` };
  }
  if (["pending_docs", "pendencia", "rejected", "refused"].includes(status)) {
    return { title: "Homologação", desc: "Há uma pendência na homologação. Nossa equipe vai te orientar pelos próximos passos." };
  }
  if (["homologado", "homologated", "approved", "completed"].includes(status)) {
    return { title: "Homologação", desc: "Homologação concluída ✅ Agora aguardamos a ativação final." };
  }
  return { title: "Homologação", desc: `Status atual: ${status}.` };
}

const api = {
  normStr,
  tsToMillis,
  safeToDate,
  fmtDateTimeBR,
  normalizeStage,
  PROCESS_STEPS,
  documentsLabel,
  getBillingDueDayFromFamily,
  badgeByMiniStatus,
  homologationLabel,
  derivePipelineFromFamily,
  engineeringNextStepByStatus,
  installationNextStepByExecution,
  homologationNextStepInfo,
};

export default api;

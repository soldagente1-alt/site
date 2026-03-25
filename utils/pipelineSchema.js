// src/constants/pipelineSchema.js

export const PIPELINE = {
  stages: {
    cadastro: {
      label: "Cadastro",
      // docs como substatus do cadastro
      substatus: {
        documentos_aguardando: { label: "Documentos • Aguardando" },
        documentos_enviado: { label: "Documentos • Enviado" },
        documentos_aprovado: { label: "Documentos • Aprovado" },
        documentos_reprovado: { label: "Documentos • Reprovado" },
      },
      defaultSubstatus: "documentos_aguardando",
    },

    plano: {
      label: "Plano",
      substatus: {
        aguardando: { label: "Aguardando" }, // sem plan_id
        selecionado: { label: "Selecionado" }, // plan_id definido
      },
      defaultSubstatus: "aguardando",
    },

    visita: {
      label: "Visita técnica",
      substatus: {
        aguardando: { label: "Aguardando" },
        agendada: { label: "Agendada" },
        em_andamento: { label: "Em andamento" },
        realizada: { label: "Realizada" },
        pendencias: { label: "Pendências" },
        cancelada: { label: "Cancelada" },
      },
      defaultSubstatus: "aguardando",
    },

    grupo: {
      label: "Grupo",
      substatus: {
        sem_grupo: { label: "Sem grupo" },
        em_grupo: { label: "Em grupo" }, // group_id definido
      },
      defaultSubstatus: "sem_grupo",
    },

    contrato: {
      label: "Contrato",
      substatus: {
        aguardando: { label: "Aguardando" },
        gerado: { label: "Gerado" },
        enviado: { label: "Enviado" },
        validado: { label: "Validado" },
        recusado: { label: "Recusado" },
      },
      defaultSubstatus: "aguardando",
    },

    projeto_eletrico: {
      label: "Projeto elétrico",
      substatus: {
        aguardando: { label: "Aguardando" },
        em_andamento: { label: "Em andamento" },
        pendencia: { label: "Pendência" },
        aprovado: { label: "Aprovado" },
        concluido: { label: "Concluído" },
      },
      defaultSubstatus: "aguardando",
    },

    instalacao: {
      label: "Instalação",
      substatus: {
        aguardando: { label: "Aguardando" },
        agendada: { label: "Agendada" },
        em_andamento: { label: "Em andamento" },
        instalado: { label: "Instalado" },
        pendencia: { label: "Pendência" },
        cancelada: { label: "Cancelada" },
      },
      defaultSubstatus: "aguardando",
    },

    homologacao: {
      label: "Homologação",
      substatus: {
        aguardando: { label: "Aguardando" },
        em_andamento: { label: "Em andamento" },
        pendencia: { label: "Pendência" },
        homologado: { label: "Homologado" },
      },
      defaultSubstatus: "aguardando",
    },

    ativo: {
      label: "Ativo",
      substatus: {
        kit_inativo: { label: "Kit inativo" },
        kit_ativo: { label: "Kit ativo" },
      },
      defaultSubstatus: "kit_inativo",
    },
  },

  // ordem canônica do pipeline (pra UI do PipelineProgress)
  order: [
    "cadastro",
    "plano",
    "visita",
    "grupo",
    "contrato",
    "projeto_eletrico",
    "instalacao",
    "homologacao",
    "ativo",
  ],
};

// helpers práticos (opcionais)
export function getStageLabel(stage) {
  return PIPELINE.stages?.[stage]?.label || String(stage || "—");
}

export function getSubstatusLabel(stage, substatus) {
  const s = PIPELINE.stages?.[stage];
  return s?.substatus?.[substatus]?.label || String(substatus || "—");
}

export function getDefaultSubstatus(stage) {
  return PIPELINE.stages?.[stage]?.defaultSubstatus || null;
}

// normaliza/garante coerência (útil antes de salvar no Firestore)
export function normalizePipeline(stage, substatus) {
  const s = PIPELINE.stages?.[stage];
  if (!s) return { stage: "cadastro", substatus: "documentos_aguardando" };

  const ok = !!s.substatus?.[substatus];
  const fixedSub = ok ? substatus : s.defaultSubstatus;

  return { stage, substatus: fixedSub };
}

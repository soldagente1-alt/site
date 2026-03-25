export const COL_FAMILY = "Family";
export const COL_PAYMENTS = "Payments";
export const COL_GROUPS = "Group";
export const COL_DOCS = "FamilyDocuments";
export const COL_CONTRACTS = "FamilyContracts";
export const COL_ENGINEERING = "EngineeringProjects";
export const COL_TECH_JOBS = "TechnicalJobs";
export const COL_TECH_VISITS = "TechnicalVisits";
export const COL_HOMOLOG = "TechnicalHomologations";

export const DOC_STATUS = {
  AGUARDANDO: "aguardando",
  INICIADO: "iniciado",
  ENVIADO: "enviado",
  APROVADO: "aprovado",
  REPROVADO: "reprovado",
};

export const familyStatusConfig = {
  ApprovalPending: {
    label: "Pendente",
    color: "bg-yellow-100 text-yellow-700",
  },
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Aprovado", color: "bg-blue-100 text-blue-700" },
  in_group: { label: "Em grupo", color: "bg-purple-100 text-purple-700" },
  active: { label: "Kit ativo", color: "bg-green-100 text-green-700" },
  completed: { label: "Quitado", color: "bg-emerald-100 text-emerald-700" },
};

export const processSteps = [
  { key: "cadastro", label: "Cadastro" },
  { key: "grupo", label: "Grupo" },
  { key: "contrato", label: "Contrato" },
  { key: "instalacao", label: "Instalação" },
  { key: "ativo", label: "Ativo" },
];

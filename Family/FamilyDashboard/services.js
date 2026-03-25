import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { normalizeStage, normStr, tsToMillis } from "./helpers";

function getFunctionsBase(auth) {
  const projectId = auth?.app?.options?.projectId || "soldagente-30f00";
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}

export async function callFamilyFunction(auth, path, body) {
  const base = getFunctionsBase(auth);
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

  return data?.data || data;
}

export function getEmptyFamilyDashboardData() {
  return {
    familyData: null,
    waitlistLead: null,
    groupQueueDerived: null,
    planData: null,
    groupData: null,
    visitJob: null,
    installationJob: null,
    installExecution: null,
    homologationDoc: null,
    contractDoc: null,
    engineeringProjectLast: null,
    documentsDoc: null,
    payments: [],
  };
}

export async function loadFamilyDashboardData({ user, auth, db }) {
  const empty = getEmptyFamilyDashboardData();

  try {
    const familyRef = doc(db, "Family", user.uid);
    const familySnap = await getDoc(familyRef);

    if (!familySnap.exists()) {
      return empty;
    }

    const family = { id: familySnap.id, ...familySnap.data() };
    if (!family.pipeline_stage) family.pipeline_stage = "cadastro";

    const result = { ...empty, familyData: family };

    try {
      const queueData = await callFamilyFunction(auth, "getFamilyGroupQueueInfo", { familyId: user.uid });
      result.waitlistLead = queueData?.waitlistLead || null;
      result.groupQueueDerived = queueData?.groupQueue || null;
    } catch (e) {
      console.error("Erro ao carregar fila/posição do grupo:", e);
    }

    try {
      let best = null;
      const direct = await getDoc(doc(db, "FamilyDocuments", user.uid));
      if (direct.exists()) {
        best = { id: direct.id, ...direct.data() };
      } else {
        const qD = query(collection(db, "FamilyDocuments"), where("family_id", "==", user.uid), limit(20));
        const snap = await getDocs(qD);
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (all.length) {
          all.sort((a, b) => {
            const ma = tsToMillis(a.updated_at) || tsToMillis(a.created_at);
            const mb = tsToMillis(b.updated_at) || tsToMillis(b.created_at);
            return mb - ma;
          });
          best = all[0] || null;
        }
      }
      result.documentsDoc = best;
    } catch (e) {
      console.error("Erro ao carregar FamilyDocuments:", e);
    }

    const effectivePlanId = family?.plan_id || family?.pre_enrolled_plan_id || null;
    if (effectivePlanId) {
      try {
        const planRef = doc(db, "Familyplans", String(effectivePlanId));
        const planSnap = await getDoc(planRef);
        result.planData = planSnap.exists() ? { id: planSnap.id, ...planSnap.data() } : null;
      } catch (e) {
        console.error("Erro ao carregar plano:", e);
      }
    }

    const effectiveGroupId = family?.group_id || family?.pre_enrolled_group_id || null;
    if (effectiveGroupId) {
      try {
        const groupRef = doc(db, "Group", String(effectiveGroupId));
        const groupSnap = await getDoc(groupRef);
        result.groupData = groupSnap.exists() ? { id: groupSnap.id, ...groupSnap.data() } : null;
      } catch (e) {
        console.error("Erro ao carregar grupo:", e);
      }
    }

    try {
      const qPayments = query(collection(db, "Payments"), where("family_id", "==", user.uid), limit(60));
      const paymentsSnap = await getDocs(qPayments);
      const rows = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => {
        const aInst = Number(a?.installment_number || 9999);
        const bInst = Number(b?.installment_number || 9999);
        if (aInst !== bInst) return aInst - bInst;
        const aDue = String(a?.due_date || "");
        const bDue = String(b?.due_date || "");
        if (aDue !== bDue) return aDue.localeCompare(bDue);
        return (tsToMillis(a.created_at) || 0) - (tsToMillis(b.created_at) || 0);
      });
      result.payments = rows;
    } catch (e) {
      console.error("Erro ao carregar pagamentos:", e);
    }

    const stage = normalizeStage(family.pipeline_stage);
    const needsContract = ["contrato", "instalacao", "ativo"].includes(stage);
    const needsInstallBundle = ["instalacao", "ativo"].includes(stage);

    if (needsInstallBundle) {
      try {
        const qy = query(collection(db, "TechnicalJobs"), where("family_uid", "==", user.uid), limit(50));
        const snap = await getDocs(qy);
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const visits = all.filter((j) => normStr(j.type) === "visit");
        const installs = all.filter((j) => normStr(j.type) === "install");

        if (visits.length) {
          visits.sort((a, b) => tsToMillis(b.scheduled_at) - tsToMillis(a.scheduled_at));
          result.visitJob = visits[0] || null;
        } else if (family.visit_job_id) {
          const jobRef = doc(db, "TechnicalJobs", family.visit_job_id);
          const jobSnap = await getDoc(jobRef);
          result.visitJob = jobSnap.exists() ? { id: jobSnap.id, ...jobSnap.data() } : null;
        }

        if (installs.length) {
          installs.sort((a, b) => tsToMillis(b.scheduled_at) - tsToMillis(a.scheduled_at));
          result.installationJob = installs[0] || null;
        } else if (family.installation_job_id) {
          const jobRef = doc(db, "TechnicalJobs", family.installation_job_id);
          const jobSnap = await getDoc(jobRef);
          result.installationJob = jobSnap.exists() ? { id: jobSnap.id, ...jobSnap.data() } : null;
        }
      } catch (e) {
        console.error("Erro ao carregar TechnicalJobs (visit/install):", e);
      }
    }

    if (needsInstallBundle) {
      try {
        const qInstall = query(
          collection(db, "TechnicalVisits"),
          where("family_id", "==", user.uid),
          where("type", "==", "install"),
          limit(20)
        );
        const snap = await getDocs(qInstall);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (rows.length) {
          rows.sort((a, b) => {
            const ma = tsToMillis(a.updated_at) || tsToMillis(a.created_at);
            const mb = tsToMillis(b.updated_at) || tsToMillis(b.created_at);
            return mb - ma;
          });
          result.installExecution = rows[0] || null;
        }
      } catch (e) {
        console.error("Erro ao carregar TechnicalVisits (install):", e);
      }
    }

    let latestContract = null;
    if (needsContract) {
      try {
        const qy = query(collection(db, "FamilyContracts"), where("family_id", "==", user.uid), limit(20));
        const snap = await getDocs(qy);
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (all.length) {
          all.sort((a, b) => {
            const ma = tsToMillis(a.updated_at) || tsToMillis(a.generated_at);
            const mb = tsToMillis(b.updated_at) || tsToMillis(b.generated_at);
            return mb - ma;
          });
          latestContract = all[0] || null;
          result.contractDoc = latestContract;
        }
      } catch (e) {
        console.error("Erro ao carregar FamilyContracts:", e);
      }
    }

    const cst = normStr(latestContract?.status);
    if (needsInstallBundle && cst === "validated") {
      try {
        const epQ = query(
          collection(db, "EngineeringProjects"),
          where("family_id", "==", user.uid),
          orderBy("created_at", "desc"),
          limit(1)
        );
        const epSnap = await getDocs(epQ);
        if (!epSnap.empty) {
          const d = epSnap.docs[0];
          result.engineeringProjectLast = { id: d.id, ...d.data() };
        }
      } catch (e) {
        console.error("Erro ao carregar EngineeringProjects:", e);
      }
    }

    if (needsInstallBundle) {
      try {
        const qH = query(
          collection(db, "TechnicalHomologations"),
          where("family_id", "==", user.uid),
          orderBy("created_at", "desc"),
          limit(1)
        );
        const snap = await getDocs(qH);
        if (!snap.empty) {
          const d = snap.docs[0];
          result.homologationDoc = { id: d.id, ...d.data() };
        }
      } catch (e) {
        try {
          const qH2 = query(collection(db, "TechnicalHomologations"), where("family_id", "==", user.uid), limit(20));
          const snap2 = await getDocs(qH2);
          const rows = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => tsToMillis(b.created_at) - tsToMillis(a.created_at));
          result.homologationDoc = rows[0] || null;
        } catch (err2) {
          console.error("Erro ao carregar TechnicalHomologations:", e, err2);
        }
      }
    }

    return result;
  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
    return empty;
  }
}

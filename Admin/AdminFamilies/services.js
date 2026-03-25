import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";

import {
  COL_CONTRACTS,
  COL_DOCS,
  COL_ENGINEERING,
  COL_HOMOLOG,
  COL_TECH_JOBS,
  COL_TECH_VISITS,
} from "./constants";
import {
  normStr,
  pickDocumentStoragePath,
  pickDocumentUrl,
  safeToDate,
  tsToMillis,
} from "./helpers";

const fns = getFunctions(undefined, "us-central1");

export async function loadFamilyDetails(db, familyId) {
  let documentsDoc = null;

  try {
    const direct = await getDoc(doc(db, COL_DOCS, familyId));
    if (direct.exists()) {
      documentsDoc = { id: direct.id, ...direct.data() };
    }
  } catch {
    // noop
  }

  if (!documentsDoc) {
    const docsQuery = query(
      collection(db, COL_DOCS),
      where("family_id", "==", familyId),
      limit(20),
    );
    const docsSnapshot = await getDocs(docsQuery);
    const allDocuments = docsSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    if (allDocuments.length) {
      allDocuments.sort((a, b) => {
        const aMillis = tsToMillis(a.updated_at) || tsToMillis(a.created_at) || 0;
        const bMillis = tsToMillis(b.updated_at) || tsToMillis(b.created_at) || 0;
        return bMillis - aMillis;
      });
      documentsDoc = allDocuments[0] || null;
    }
  }

  const contractQuery = query(
    collection(db, COL_CONTRACTS),
    where("family_id", "==", familyId),
    limit(20),
  );
  const contractSnapshot = await getDocs(contractQuery);
  const contracts = contractSnapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
  contracts.sort((a, b) => {
    const aMillis = tsToMillis(a.updated_at) || tsToMillis(a.generated_at);
    const bMillis = tsToMillis(b.updated_at) || tsToMillis(b.generated_at);
    return bMillis - aMillis;
  });
  const contractDoc = contracts[0] || null;

  let engineeringProjectLast = null;
  try {
    const engineeringQuery = query(
      collection(db, COL_ENGINEERING),
      where("family_id", "==", familyId),
      limit(20),
    );
    const engineeringSnapshot = await getDocs(engineeringQuery);
    const engineeringRows = engineeringSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
    engineeringRows.sort(
      (a, b) => (tsToMillis(b.created_at) || 0) - (tsToMillis(a.created_at) || 0),
    );
    engineeringProjectLast = engineeringRows[0] || null;
  } catch {
    engineeringProjectLast = null;
  }

  const jobsQuery = query(
    collection(db, COL_TECH_JOBS),
    where("family_uid", "==", familyId),
    limit(50),
  );
  const jobsSnapshot = await getDocs(jobsQuery);
  const jobs = jobsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  const visits = jobs.filter((item) => normStr(item.type) === "visit");
  const installs = jobs.filter((item) => normStr(item.type) === "install");

  const jobDateMillis = (job) =>
    tsToMillis(job.scheduled_at) ||
    tsToMillis(job.updated_at) ||
    tsToMillis(job.created_at) ||
    0;

  if (visits.length) {
    visits.sort((a, b) => jobDateMillis(b) - jobDateMillis(a));
  }
  if (installs.length) {
    installs.sort((a, b) => jobDateMillis(b) - jobDateMillis(a));
  }

  const visitJob = visits[0] || null;
  const installationJob = installs[0] || null;

  const installExecutionQuery = query(
    collection(db, COL_TECH_VISITS),
    where("family_id", "==", familyId),
    where("type", "==", "install"),
    limit(20),
  );
  const installExecutionSnapshot = await getDocs(installExecutionQuery);
  const installExecutions = installExecutionSnapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
  installExecutions.sort((a, b) => {
    const aMillis = tsToMillis(a.updated_at) || tsToMillis(a.created_at);
    const bMillis = tsToMillis(b.updated_at) || tsToMillis(b.created_at);
    return bMillis - aMillis;
  });
  const installExecution = installExecutions[0] || null;

  let homologationDoc = null;
  try {
    const homologationQuery = query(
      collection(db, COL_HOMOLOG),
      where("family_id", "==", familyId),
      limit(20),
    );
    const homologationSnapshot = await getDocs(homologationQuery);
    const homologationRows = homologationSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
    homologationRows.sort(
      (a, b) => (tsToMillis(b.created_at) || 0) - (tsToMillis(a.created_at) || 0),
    );
    homologationDoc = homologationRows[0] || null;
  } catch {
    homologationDoc = null;
  }

  return {
    documentsDoc,
    contractDoc,
    engineeringProjectLast,
    visitJob,
    installationJob,
    installExecution,
    homologationDoc,
    docsNotes: String(documentsDoc?.admin_notes || ""),
  };
}

export async function saveDocsNotesAction(familyId, notes) {
  const callable = httpsCallable(fns, "adminFamilySaveDocsNotes");
  const result = await callable({ familyId, notes: notes || "" });
  return result?.data || {};
}

export async function approveDocsAction(familyId, notes) {
  const callable = httpsCallable(fns, "adminFamilyApproveDocuments");
  const result = await callable({ familyId, notes: notes || "" });
  return result?.data || {};
}

export async function rejectDocsAction(familyId, notes) {
  const callable = httpsCallable(fns, "adminFamilyRejectDocuments");
  const result = await callable({ familyId, notes: notes || "" });
  return result?.data || {};
}

export async function openDocumentInNewTab(storage, fileLike) {
  const directUrl = pickDocumentUrl(fileLike);
  if (directUrl) {
    window.open(directUrl, "_blank");
    return;
  }

  const storagePath = pickDocumentStoragePath(fileLike);
  if (!storagePath) {
    throw new Error("Não encontrei URL nem caminho do arquivo.");
  }

  const url = await getDownloadURL(storageRef(storage, storagePath));
  window.open(url, "_blank");
}

export function buildDocumentDocPatch(previousDoc, familyId, payload, notes, statusField) {
  return {
    ...(previousDoc || {}),
    id: previousDoc?.id || payload.documentId || familyId,
    family_id: familyId,
    status: statusField,
    admin_notes: payload.notes ?? notes ?? "",
  };
}

export function buildApprovedDocPatch(previousDoc, familyId, payload, notes, statusField) {
  return {
    ...buildDocumentDocPatch(previousDoc, familyId, payload, notes, statusField),
    approved_at: new Date(),
  };
}

export function buildRejectedDocPatch(previousDoc, familyId, payload, notes, statusField) {
  return {
    ...buildDocumentDocPatch(previousDoc, familyId, payload, notes, statusField),
    rejected_at: new Date(),
  };
}

export function buildDocsNotesPatch(previousDoc, familyId, payload, notes) {
  return {
    ...(previousDoc || {}),
    id: previousDoc?.id || payload.documentId || familyId,
    family_id: familyId,
    admin_notes: payload.notes ?? notes ?? "",
  };
}

export function getDocsApprovedAtText(documentsDoc, formatter) {
  const approvedAt = safeToDate(documentsDoc?.approved_at);
  return approvedAt ? formatter(approvedAt) : null;
}

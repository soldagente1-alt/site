import { format, addMonths } from "date-fns";
import { db } from "../../../../api/firebaseDb";
import {
  collection,
  getDocs,
  doc,
  query,
  where,
  getDoc,
  limit,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

const ACCOUNT_DEBIT_ID = "acc_1_2_01";
const ACCOUNT_CREDIT_ID = "acc_4_1_01";
const FALLBACK_COST_CENTER_ID = "cc_cc-000";

function paymentDocId(familyId, installmentNumber) {
  const n = String(installmentNumber).padStart(4, "0");
  return `${familyId}_${n}`;
}

function journalEntryDocId(familyId, installmentNumber) {
  const n = String(installmentNumber).padStart(4, "0");
  return `je_${familyId}_${n}`;
}

function journalLineDocId(familyId, installmentNumber, side) {
  const n = String(installmentNumber).padStart(4, "0");
  return `jl_${familyId}_${n}_${side}`;
}

function computeDueDate(baseDate, dueDay) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(Number(dueDay || 1), lastDay);
  return new Date(year, month, day);
}

async function fetchFamilyPayments(familyId) {
  const qy = query(collection(db, "Payments"), where("family_id", "==", familyId));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function resolveCostCenterIdByGroupId(groupId) {
  const gid = String(groupId || "").trim();
  if (!gid) return FALLBACK_COST_CENTER_ID;

  try {
    const direct = await getDoc(doc(db, "cost_centers", gid));
    if (direct.exists()) return direct.id;
  } catch {}

  try {
    const q1 = query(collection(db, "cost_centers"), where("code", "==", gid), limit(1));
    const s1 = await getDocs(q1);
    if (!s1.empty) return s1.docs[0].id;
  } catch {}

  try {
    const q2 = query(collection(db, "cost_centers"), where("group_id", "==", gid), limit(1));
    const s2 = await getDocs(q2);
    if (!s2.empty) return s2.docs[0].id;
  } catch {}

  return FALLBACK_COST_CENTER_ID;
}

async function ensureFamilyInstallments({ familyId, families, createdByUid }) {
  const family = families.find((f) => f.id === familyId);
  if (!family) throw new Error("Família não encontrada");
  if (!family.plan_id) throw new Error("Família não tem plano atribuído");

  const planRef = doc(db, "Familyplans", family.plan_id);
  const planSnap = await getDoc(planRef);
  const planData = planSnap.data();
  if (!planData) throw new Error("Plano não encontrado");

  const totalInstallments = Number(planData.number_of_installments || 120);
  const amount = Number(planData.monthly_payment || 0);
  const dueDay = Number(family.due_day || 1);
  const costCenterId = await resolveCostCenterIdByGroupId(family.group_id);

  const existing = await fetchFamilyPayments(family.id);
  const existingInstallments = new Set(
    existing
      .map((p) => Number(p.installment_number))
      .filter((n) => Number.isFinite(n) && n > 0)
  );

  const startAnchor = new Date();
  const batch = writeBatch(db);
  let writes = 0;
  let createdCount = 0;

  for (let i = 1; i <= totalInstallments; i++) {
    if (existingInstallments.has(i)) continue;

    const baseMonth = addMonths(startAnchor, i - 1);
    const dueDate = computeDueDate(baseMonth, dueDay);
    const dueDateStr = format(dueDate, "yyyy-MM-dd");

    const newPayment = {
      family_id: family.id,
      plan_id: family.plan_id,
      type: "family_payment",
      reference: `Parcela ${i}/${totalInstallments} - ${family.full_name || ""}`.trim(),
      amount,
      due_date: dueDateStr,
      status: "pending",
      installment_number: i,
      total_installments: totalInstallments,
      created_date: new Date(),
      group_id: family.group_id || null,
      cost_center_id: costCenterId || null,
    };

    const pid = paymentDocId(family.id, i);
    const pref = doc(db, "Payments", pid);
    batch.set(pref, newPayment, { merge: false });
    writes++;

    const entryId = journalEntryDocId(family.id, i);
    const entryRef = doc(db, "journal_entries", entryId);

    const entry = {
      costCenterId: costCenterId || FALLBACK_COST_CENTER_ID,
      date: dueDateStr,
      description: `Lançamento parcela ${i}/${totalInstallments} - ${family.full_name || ""}`.trim(),
      status: "posted",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: createdByUid || null,
      familyId: family.id,
      groupId: family.group_id || null,
      paymentId: pid,
      planId: family.plan_id,
      installmentNumber: i,
    };

    batch.set(entryRef, entry, { merge: false });
    writes++;

    const lineDId = journalLineDocId(family.id, i, "D");
    const lineDRef = doc(db, "journal_lines", lineDId);
    batch.set(
      lineDRef,
      {
        entryId,
        accountId: ACCOUNT_DEBIT_ID,
        amount,
        dc: "D",
        memo: `Parcela ${i}/${totalInstallments} (${dueDateStr})`,
        createdAt: serverTimestamp(),
      },
      { merge: false }
    );
    writes++;

    const lineCId = journalLineDocId(family.id, i, "C");
    const lineCRef = doc(db, "journal_lines", lineCId);
    batch.set(
      lineCRef,
      {
        entryId,
        accountId: ACCOUNT_CREDIT_ID,
        amount,
        dc: "C",
        memo: `Parcela ${i}/${totalInstallments} (${dueDateStr})`,
        createdAt: serverTimestamp(),
      },
      { merge: false }
    );
    writes++;

    createdCount++;
    if (writes >= 480) break;
  }

  if (createdCount === 0) {
    return {
      createdCount: 0,
      familyName: family.full_name || "Família",
      costCenterId: costCenterId || FALLBACK_COST_CENTER_ID,
    };
  }

  await batch.commit();

  return {
    createdCount,
    familyName: family.full_name || "Família",
    costCenterId: costCenterId || FALLBACK_COST_CENTER_ID,
  };
}

export {
  ACCOUNT_DEBIT_ID,
  ACCOUNT_CREDIT_ID,
  FALLBACK_COST_CENTER_ID,
  paymentDocId,
  journalEntryDocId,
  journalLineDocId,
  computeDueDate,
  fetchFamilyPayments,
  resolveCostCenterIdByGroupId,
  ensureFamilyInstallments,
};

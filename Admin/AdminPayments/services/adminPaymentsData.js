import { db } from "../../../../api/firebaseDb";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFamilyPlanId, safeDateFromFirestoreLike } from "../helpers/formatters";

async function fetchPayments() {
  const paymentsSnap = await getDocs(
    query(collection(db, "Payments"), orderBy("due_date", "asc"), limit(500))
  );
  return paymentsSnap.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

async function fetchFamilies() {
  const familiesSnap = await getDocs(collection(db, "Family"));
  return familiesSnap.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

async function loadSelectedContext(payment, familyIndex) {
  if (!payment?.family_id) {
    return {
      family: null,
      group: null,
      plan: null,
    };
  }

  let family = familyIndex.get(payment.family_id) || null;
  if (!family) {
    const familySnap = await getDoc(doc(db, "Family", payment.family_id));
    family = familySnap.exists() ? { id: familySnap.id, ...familySnap.data() } : null;
  }

  let group = null;
  const groupId = payment?.group_id || family?.group_id || family?.open_group_id || family?.groupId || null;
  if (groupId) {
    const groupSnap = await getDoc(doc(db, "Group", String(groupId)));
    group = groupSnap.exists() ? { id: groupSnap.id, ...groupSnap.data() } : null;
  }

  let plan = null;
  const planId = payment?.plan_id || getFamilyPlanId(family) || getFamilyPlanId(group) || null;
  if (planId) {
    const planSnap = await getDoc(doc(db, "Familyplans", String(planId)));
    plan = planSnap.exists() ? { id: planSnap.id, ...planSnap.data() } : null;
  }

  return { family, group, plan };
}

function patchPaymentInList(payments, paymentId, patch) {
  return payments.map((payment) =>
    payment.id === paymentId ? { ...payment, ...patch } : payment
  );
}

async function markPaymentOverdue(paymentId) {
  await updateDoc(doc(db, "Payments", paymentId), { status: "overdue" });
}

function getPendingOverdueIds(payments, today = new Date()) {
  return payments
    .filter((payment) => payment.status === "pending" && payment.due_date)
    .filter((payment) => {
      const dueDate = safeDateFromFirestoreLike(payment.due_date);
      return !!dueDate && dueDate < today;
    })
    .map((payment) => payment.id);
}

export {
  fetchPayments,
  fetchFamilies,
  loadSelectedContext,
  patchPaymentInList,
  markPaymentOverdue,
  getPendingOverdueIds,
};

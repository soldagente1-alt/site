import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  paid: { label: 'Pago', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  overdue: { label: 'Atrasado', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export const statusFallback = { label: '—', color: 'bg-slate-100 text-slate-700', icon: Clock };

export function getTimestampDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getPaymentDateObj(payment) {
  return getTimestampDate(payment?.due_date) || getTimestampDate(payment?.due_at);
}

export function getPaymentIssueDate(payment) {
  return (
    getTimestampDate(payment?.paid_at) ||
    getTimestampDate(payment?.paidAt) ||
    getTimestampDate(payment?.payment_date) ||
    getTimestampDate(payment?.updated_at) ||
    getTimestampDate(payment?.created_at) ||
    getPaymentDateObj(payment) ||
    new Date()
  );
}

export function fmtDueDate(payment) {
  const d = getPaymentDateObj(payment);
  return d ? format(d, 'dd MMM yyyy', { locale: ptBR }) : 'Sem vencimento';
}

export function formatDateBR(dateValue) {
  const d = getTimestampDate(dateValue);
  return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—';
}

export function formatCompetence(payment) {
  const d = getPaymentDateObj(payment);
  return d ? format(d, 'MM/yyyy', { locale: ptBR }) : '—';
}

export function getYearKey(payment) {
  const d = getPaymentDateObj(payment);
  return d ? String(d.getFullYear()) : 'Sem data';
}

export function moneyBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseMoneyToNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function pickFirstPositive(...values) {
  for (const value of values) {
    const n = parseMoneyToNumber(value);
    if (n !== null && n > 0) return n;
  }
  return null;
}

export function getFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
}

export function getStatusLabel(status) {
  return (statusConfig[status] || statusFallback).label;
}

export function getFamilyDisplayName(family) {
  return getFirstNonEmpty(
    family?.responsible_name,
    family?.responsible_full_name,
    family?.customer_name,
    family?.holder_name,
    family?.name,
    family?.full_name,
  );
}

export function getFamilyCpf(family) {
  return getFirstNonEmpty(
    family?.responsible_cpf,
    family?.holder_cpf,
    family?.customer_cpf,
    family?.cpf,
    family?.document,
  );
}

export function getGroupDisplayName(group) {
  return getFirstNonEmpty(group?.name, group?.title, group?.group_name, group?.label);
}

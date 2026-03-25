import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Pencil,
  Plus,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  FolderOpen,
  FileText,
  ChevronsDown,
  ChevronsUp,
} from "lucide-react";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

const ACCOUNT_TYPES = [
  { value: "ASSET", label: "Ativo" },
  { value: "LIABILITY", label: "Passivo" },
  { value: "EQUITY", label: "Patrimônio Líquido" },
  { value: "REVENUE", label: "Receita" },
  { value: "EXPENSE", label: "Despesa" },
];

function buildTree(accounts) {
  const map = new Map();
  accounts.forEach((a) => map.set(a.id, { ...a, children: [] }));
  const roots = [];

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRec = (arr) => {
    arr.sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
    arr.forEach((n) => sortRec(n.children));
  };

  sortRec(roots);
  return roots;
}

function collectAllIds(nodes, acc = []) {
  nodes.forEach((node) => {
    acc.push(node.id);
    if (node.children?.length) collectAllIds(node.children, acc);
  });
  return acc;
}

function getFunctionsBase() {
  const projectId =
    db?.app?.options?.projectId ||
    process.env.REACT_APP_FIREBASE_PROJECT_ID ||
    "soldagente-30f00";
  const region = process.env.REACT_APP_FIREBASE_FUNCTIONS_REGION || "us-central1";
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const useEmulator = process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === "true";

  if (isLocal && useEmulator) {
    const emulatorHost = process.env.REACT_APP_FUNCTIONS_EMULATOR_HOST || "127.0.0.1";
    const emulatorPort = process.env.REACT_APP_FUNCTIONS_EMULATOR_PORT || "5001";
    return `http://${emulatorHost}:${emulatorPort}/${projectId}/${region}`;
  }

  return `https://${region}-${projectId}.cloudfunctions.net`;
}

async function callFunction(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão não carregada. Entre novamente.");

  const token = await user.getIdToken();
  const res = await fetch(`${getFunctionsBase()}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw Object.assign(new Error(data?.error || "Falha ao executar a operação."), {
      status: res.status,
      responseData: data,
    });
  }

  return data;
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    id: null,
    code: "",
    name: "",
    type: "ASSET",
    parentId: "",
    acceptsPosting: true,
    active: true,
  });

  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("code", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAccounts(rows);
      },
      (err) => {
        console.error(err);
        toast.error("Erro ao carregar plano de contas.");
      }
    );
    return () => unsub();
  }, []);

  const tree = useMemo(() => buildTree(accounts), [accounts]);

  const parentCandidates = useMemo(() => {
    return accounts
      .filter((a) => a.active !== false && a.id !== form.id)
      .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  }, [accounts, form.id]);

  const allTreeIds = useMemo(() => collectAllIds(tree), [tree]);

  const resetForm = () => {
    setForm({
      id: null,
      code: "",
      name: "",
      type: "ASSET",
      parentId: "",
      acceptsPosting: true,
      active: true,
    });
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(allTreeIds));
  const collapseAll = () => setExpanded(new Set());

  const startEdit = (acc) => {
    setForm({
      id: acc.id,
      code: acc.code || "",
      name: acc.name || "",
      type: acc.type || "ASSET",
      parentId: acc.parentId || "",
      acceptsPosting: acc.acceptsPosting ?? true,
      active: acc.active ?? true,
    });
  };

  const validate = () => {
    if (!form.code.trim()) return "Informe o código.";
    if (!form.name.trim()) return "Informe o nome.";
    if (!form.type) return "Informe o tipo.";
    if (form.parentId && form.parentId === form.id) return "Conta não pode ser pai dela mesma.";
    return null;
  };

  const saveAccount = async () => {
    const err = validate();
    if (err) return toast.error(err);

    setSaving(true);
    try {
      await callFunction("upsertChartAccount", {
        id: form.id || null,
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || null,
        acceptsPosting: !!form.acceptsPosting,
        active: !!form.active,
      });

      toast.success(form.id ? "Conta atualizada." : "Conta criada.");
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node, level = 0) => {
    const hasChildren = node.children?.length > 0;
    const open = expanded.has(node.id);
    const typeLabel = ACCOUNT_TYPES.find((t) => t.value === node.type)?.label || node.type;

    return (
      <div key={node.id} className="relative">
        {level > 0 && <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />}

        <div className="relative pl-0">
          <div
            className="group flex items-center justify-between rounded-2xl border bg-white px-3 py-2 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/30"
            style={{ marginLeft: level * 18 }}
          >
            <button
              type="button"
              onClick={() => hasChildren && toggleExpand(node.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              title={hasChildren ? "Expandir/Recolher" : "Conta"}
            >
              <span className="flex w-6 shrink-0 items-center justify-center rounded-md">
                {hasChildren ? (
                  open ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-slate-300 bg-slate-100" />
                )}
              </span>

              {hasChildren ? (
                open ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-600" /> : <FolderTree className="h-4 w-4 shrink-0 text-slate-500" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              )}

              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {node.code} — {node.name}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {typeLabel}
                  {node.acceptsPosting ? " • Lançável" : " • Somente agrupadora"}
                  {node.active === false ? " • Inativa" : ""}
                </div>
              </div>
            </button>

            <div className="ml-3 flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => startEdit(node)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
          </div>
        </div>

        {hasChildren && open && (
          <div className="mt-2 space-y-2">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Plano de Contas</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="Ex: 1.1.01"
              />
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Banco"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Conta Pai (opcional)</Label>
              <select
                className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
                value={form.parentId}
                onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
              >
                <option value="">— Sem pai (raiz) —</option>
                {parentCandidates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Dica: contas pai normalmente ficam como “somente agrupadora”.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">Aceita lançamento</div>
                <div className="text-xs text-slate-500">Se desativado, a conta vira agrupadora.</div>
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, acceptsPosting: !p.acceptsPosting }))}
                className="rounded p-1 hover:bg-slate-100"
                title="Alternar"
              >
                {form.acceptsPosting ? (
                  <ToggleRight className="h-7 w-7 text-amber-600" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-slate-400" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">Ativa</div>
                <div className="text-xs text-slate-500">Contas inativas não aparecem nos lançamentos.</div>
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
                className="rounded p-1 hover:bg-slate-100"
                title="Alternar"
              >
                {form.active ? (
                  <ToggleRight className="h-7 w-7 text-amber-600" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-slate-400" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveAccount} disabled={saving} className="flex-1">
                {form.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {form.id ? "Salvar" : "Criar"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>
          </div>

          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-slate-50 px-3 py-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">Estrutura em árvore</div>
                <div className="text-xs text-slate-500">Clique na linha da conta agrupadora para abrir ou recolher os níveis inferiores.</div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={expandAll}>
                  <ChevronsDown className="mr-2 h-4 w-4" />
                  Expandir tudo
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  <ChevronsUp className="mr-2 h-4 w-4" />
                  Recolher tudo
                </Button>
              </div>
            </div>

            {tree.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhuma conta cadastrada ainda.</div>
            ) : (
              <div className="space-y-2">{tree.map((n) => renderNode(n, 0))}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

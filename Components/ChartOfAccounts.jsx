import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ChevronRight, FolderTree, Pencil, Plus, Save, X, ToggleLeft, ToggleRight } from "lucide-react";
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
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId).children.push(node);
    else roots.push(node);
  });
  // ordena por código
  const sortRec = (arr) => {
    arr.sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
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

  const leafCandidates = useMemo(() => {
    // contas que podem ser pai (qualquer uma) e contas "folha" também
    return accounts
      .filter((a) => a.active !== false)
      .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  }, [accounts]);

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
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || null,
        acceptsPosting: !!form.acceptsPosting,
        active: !!form.active,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        await updateDoc(doc(db, "accounts", form.id), payload);
        toast.success("Conta atualizada.");
      } else {
        await addDoc(collection(db, "accounts"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Conta criada.");
      }

      resetForm();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node, level = 0) => {
    const hasChildren = node.children?.length > 0;
    const open = expanded.has(node.id);

    return (
      <div key={node.id} className="space-y-1">
        <div
          className="flex items-center justify-between rounded-xl bg-white border px-3 py-2"
          style={{ marginLeft: level * 14 }}
        >
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="p-1 rounded hover:bg-slate-100"
                title="Expandir/Recolher"
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
              </button>
            ) : (
              <span className="w-6" />
            )}

            <FolderTree className="w-4 h-4 text-slate-500" />

            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">
                {node.code} — {node.name}
              </div>
              <div className="text-xs text-slate-500">
                {ACCOUNT_TYPES.find((t) => t.value === node.type)?.label || node.type}
                {node.acceptsPosting ? " • Lançável" : " • Somente agrupadora"}
                {node.active === false ? " • Inativa" : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => startEdit(node)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>

        {hasChildren && open && (
          <div className="space-y-2">
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
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário */}
          <div className="lg:col-span-1 space-y-4">
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
                className="w-full h-10 rounded-xl border bg-white px-3 text-sm"
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
                className="w-full h-10 rounded-xl border bg-white px-3 text-sm"
                value={form.parentId}
                onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
              >
                <option value="">— Sem pai (raiz) —</option>
                {leafCandidates.map((a) => (
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
                className="p-1 rounded hover:bg-slate-100"
                title="Alternar"
              >
                {form.acceptsPosting ? (
                  <ToggleRight className="w-7 h-7 text-amber-600" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-400" />
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
                className="p-1 rounded hover:bg-slate-100"
                title="Alternar"
              >
                {form.active ? (
                  <ToggleRight className="w-7 h-7 text-amber-600" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-400" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveAccount} disabled={saving} className="flex-1">
                {form.id ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {form.id ? "Salvar" : "Criar"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>

          {/* Árvore */}
          <div className="lg:col-span-2 space-y-3">
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

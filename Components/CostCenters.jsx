import React, { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Pencil, Plus, Save, X, ToggleLeft, ToggleRight } from "lucide-react";
import { db } from "../../api/firebaseDb";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

export default function CostCenters() {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    id: null,
    name: "",
    code: "",
    active: true,
  });

  useEffect(() => {
    const q = query(collection(db, "cost_centers"), orderBy("code", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(err);
        toast.error("Erro ao carregar centros de custo.");
      }
    );
    return () => unsub();
  }, []);

  const reset = () => setForm({ id: null, name: "", code: "", active: true });

  const startEdit = (row) => {
    setForm({
      id: row.id,
      name: row.name || "",
      code: row.code || "",
      active: row.active ?? true,
    });
  };

  const validate = () => {
    if (!form.code.trim()) return "Informe o código.";
    if (!form.name.trim()) return "Informe o nome.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return toast.error(err);

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        active: !!form.active,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        await updateDoc(doc(db, "cost_centers", form.id), payload);
        toast.success("Centro de custo atualizado.");
      } else {
        await addDoc(collection(db, "cost_centers"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Centro de custo criado.");
      }
      reset();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Centros de Custo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="Ex: CC-001"
              />
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Casa 12 / Bairro X / Marketing"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">Ativo</div>
                <div className="text-xs text-slate-500">Inativos não aparecem nos lançamentos.</div>
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
              <Button onClick={save} disabled={saving} className="flex-1">
                {form.id ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {form.id ? "Salvar" : "Criar"}
              </Button>
              <Button variant="outline" onClick={reset}>
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-2">
            {items.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhum centro de custo cadastrado.</div>
            ) : (
              <div className="space-y-2">
                {items.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-xl bg-white border px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {row.code} — {row.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.active === false ? "Inativo" : "Ativo"}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => startEdit(row)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

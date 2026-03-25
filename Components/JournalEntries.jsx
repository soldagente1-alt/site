import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { Plus, Trash2, CheckCircle2, Save, AlertTriangle } from "lucide-react";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function JournalEntries() {
  const [accounts, setAccounts] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [saving, setSaving] = useState(false);

  const [header, setHeader] = useState({
    date: todayISO(),
    description: "",
    costCenterId: "",
  });

  const [lines, setLines] = useState(() => [
    { accountId: "", dc: "D", amount: "", memo: "" },
    { accountId: "", dc: "C", amount: "", memo: "" },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const aq = query(collection(db, "accounts"), orderBy("code", "asc"));
        const asnap = await getDocs(aq);
        const acc = asnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => (a.active ?? true) && (a.acceptsPosting ?? true));
        setAccounts(acc);

        const cq = query(collection(db, "cost_centers"), orderBy("code", "asc"));
        const csnap = await getDocs(cq);
        const cc = csnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => (c.active ?? true));
        setCostCenters(cc);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar contas/centros de custo.");
      }
    })();
  }, []);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const v = Number(String(l.amount).replace(",", "."));
      if (!isFinite(v) || v <= 0) continue;
      if (l.dc === "D") debit += v;
      else credit += v;
    }
    return { debit, credit, diff: debit - credit };
  }, [lines]);

  const addLine = () => {
    setLines((p) => [...p, { accountId: "", dc: "D", amount: "", memo: "" }]);
  };

  const removeLine = (idx) => {
    setLines((p) => p.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, patch) => {
    setLines((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const validate = () => {
    if (!header.date) return "Informe a data.";
    if (!header.description.trim()) return "Informe a descrição.";

    const cleaned = lines.map((l) => ({
      ...l,
      amountNum: Number(String(l.amount).replace(",", ".")),
    }));

    if (cleaned.length < 2) return "O lançamento precisa de no mínimo 2 linhas.";
    for (const l of cleaned) {
      if (!l.accountId) return "Selecione a conta em todas as linhas.";
      if (!l.dc) return "Selecione D/C em todas as linhas.";
      if (!isFinite(l.amountNum) || l.amountNum <= 0) return "Informe valores válidos (> 0).";
    }

    if (Math.abs(totals.diff) > 0.00001) return "Débitos e créditos precisam fechar (D = C).";
    return null;
  };

  const persist = async (status) => {
    const err = validate();
    if (err) return toast.error(err);

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const entryRef = doc(collection(db, "journal_entries"));

      batch.set(entryRef, {
        date: header.date,
        description: header.description.trim(),
        status, // "draft" | "posted"
        costCenterId: header.costCenterId || null,
        createdBy: auth?.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      lines.forEach((l) => {
        const lineRef = doc(collection(db, "journal_lines"));
        batch.set(lineRef, {
          entryId: entryRef.id,
          accountId: l.accountId,
          dc: l.dc,
          amount: Number(String(l.amount).replace(",", ".")),
          memo: (l.memo || "").trim(),
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();

      toast.success(status === "posted" ? "Lançamento contabilizado (POSTED)." : "Rascunho salvo.");
      // reset
      setHeader({ date: todayISO(), description: "", costCenterId: "" });
      setLines([
        { accountId: "", dc: "D", amount: "", memo: "" },
        { accountId: "", dc: "C", amount: "", memo: "" },
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar lançamento. (Pode exigir índice no Firestore em alguns cenários)");
    } finally {
      setSaving(false);
    }
  };

  const warning = totals.diff !== 0;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Lançamentos (Partida Dobrada)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cabeçalho */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={header.date}
                onChange={(e) => setHeader((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={header.description}
                onChange={(e) => setHeader((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ex: Mensalidade cliente / Pagamento instalador"
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>Centro de custo (opcional)</Label>
              <select
                className="w-full h-10 rounded-xl border bg-white px-3 text-sm"
                value={header.costCenterId}
                onChange={(e) => setHeader((p) => ({ ...p, costCenterId: e.target.value }))}
              >
                <option value="">— Nenhum —</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linhas */}
          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Linhas</div>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar linha
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr className="text-left">
                    <th className="px-4 py-2 w-[360px]">Conta</th>
                    <th className="px-4 py-2 w-[90px]">D/C</th>
                    <th className="px-4 py-2 w-[140px]">Valor</th>
                    <th className="px-4 py-2">Memo</th>
                    <th className="px-4 py-2 w-[90px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="px-4 py-2">
                        <select
                          className="w-full h-10 rounded-xl border bg-white px-3 text-sm"
                          value={l.accountId}
                          onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                        >
                          <option value="">— Selecione —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-2">
                        <select
                          className="w-full h-10 rounded-xl border bg-white px-3 text-sm"
                          value={l.dc}
                          onChange={(e) => updateLine(idx, { dc: e.target.value })}
                        >
                          <option value="D">D</option>
                          <option value="C">C</option>
                        </select>
                      </td>

                      <td className="px-4 py-2">
                        <Input
                          value={l.amount}
                          onChange={(e) => updateLine(idx, { amount: e.target.value })}
                          placeholder="0,00"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <Input
                          value={l.memo}
                          onChange={(e) => updateLine(idx, { memo: e.target.value })}
                          placeholder="Opcional"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length <= 2}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totais */}
            <div className="px-4 py-3 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-slate-700 flex items-center gap-2">
                {warning ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>
                      Totais não fecham: <b>D {totals.debit.toFixed(2)}</b> / <b>C {totals.credit.toFixed(2)}</b>
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Fechado: <b>D {totals.debit.toFixed(2)}</b> = <b>C {totals.credit.toFixed(2)}</b>
                    </span>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => persist("draft")} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar rascunho
                </Button>
                <Button onClick={() => persist("posted")} disabled={saving || warning}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Contabilizar
                </Button>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Regra: o sistema só “contabiliza” se <b>Débitos = Créditos</b>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

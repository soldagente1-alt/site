import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../api/firebaseDb";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalSide(type) {
  // saldo natural: Ativo/Despesa = Débito; Passivo/PL/Receita = Crédito
  if (type === "ASSET" || type === "EXPENSE") return "D";
  return "C";
}

function calcBalance(type, debit, credit) {
  const side = normalSide(type);
  return side === "D" ? (debit - credit) : (credit - debit);
}

export default function Reports() {
  const [tab, setTab] = useState("balancete"); // balancete | razao | dre
  const [accounts, setAccounts] = useState([]);
  const [costCenters, setCostCenters] = useState([]);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    costCenterId: "",
    accountId: "",
  });

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [lines, setLines] = useState([]);
  const [entryMap, setEntryMap] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const aq = query(collection(db, "accounts"), orderBy("code", "asc"));
        const asnap = await getDocs(aq);
        setAccounts(asnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const cq = query(collection(db, "cost_centers"), orderBy("code", "asc"));
        const csnap = await getDocs(cq);
        setCostCenters(csnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar cadastros.");
      }
    })();
  }, []);

  const fetchReportData = async () => {
    if (!filters.from || !filters.to) return toast.error("Selecione o período (de / até).");

    setLoading(true);
    try {
      // 1) busca lançamentos posted no período
      const eq = query(
        collection(db, "journal_entries"),
        where("status", "==", "posted"),
        where("date", ">=", filters.from),
        where("date", "<=", filters.to)
      );

      const esnap = await getDocs(eq);
      let eRows = esnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (filters.costCenterId) {
        eRows = eRows.filter((e) => e.costCenterId === filters.costCenterId);
      }

      const emap = {};
      eRows.forEach((e) => (emap[e.id] = e));
      setEntries(eRows);
      setEntryMap(emap);

      if (eRows.length === 0) {
        setLines([]);
        toast.message("Sem lançamentos no período.");
        return;
      }

      // 2) busca linhas por entryId (em chunks por limite do 'in')
      const ids = eRows.map((e) => e.id);
      const chunks = chunk(ids, 30);
      const allLines = [];

      for (const ch of chunks) {
        const lq = query(collection(db, "journal_lines"), where("entryId", "in", ch));
        const lsnap = await getDocs(lq);
        allLines.push(...lsnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }

      setLines(allLines);
      toast.success("Relatório carregado.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar relatório. (Pode exigir índice no Firestore)");
    } finally {
      setLoading(false);
    }
  };

  const accountMap = useMemo(() => {
    const m = {};
    accounts.forEach((a) => (m[a.id] = a));
    return m;
  }, [accounts]);

  const costCenterMap = useMemo(() => {
    const m = {};
    costCenters.forEach((c) => (m[c.id] = c));
    return m;
  }, [costCenters]);

  const aggregated = useMemo(() => {
    const byAccount = {};
    for (const l of lines) {
      const acc = accountMap[l.accountId];
      if (!acc) continue;
      if (!byAccount[l.accountId]) {
        byAccount[l.accountId] = { debit: 0, credit: 0, account: acc };
      }
      const v = Number(l.amount || 0);
      if (l.dc === "D") byAccount[l.accountId].debit += v;
      else byAccount[l.accountId].credit += v;
    }

    const rows = Object.values(byAccount).sort((a, b) =>
      String(a.account.code || "").localeCompare(String(b.account.code || ""))
    );

    return rows;
  }, [lines, accountMap]);

  const dre = useMemo(() => {
    let revenue = 0;
    let expense = 0;

    for (const row of aggregated) {
      const { account, debit, credit } = row;
      const bal = calcBalance(account.type, debit, credit);
      if (account.type === "REVENUE") revenue += Math.abs(bal);
      if (account.type === "EXPENSE") expense += Math.abs(bal);
    }

    return { revenue, expense, result: revenue - expense };
  }, [aggregated]);

  const razaoRows = useMemo(() => {
    if (!filters.accountId) return [];
    const acc = accountMap[filters.accountId];
    if (!acc) return [];

    const rows = lines
      .filter((l) => l.accountId === filters.accountId)
      .map((l) => {
        const e = entryMap[l.entryId];
        const cc = e?.costCenterId ? costCenterMap[e.costCenterId] : null;
        return {
          id: l.id,
          date: e?.date || "",
          description: e?.description || "",
          costCenter: cc ? `${cc.code} — ${cc.name}` : "",
          dc: l.dc,
          amount: Number(l.amount || 0),
          memo: l.memo || "",
        };
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // saldo progressivo (natural)
    let running = 0;
    const side = normalSide(acc.type);
    return rows.map((r) => {
      const delta = r.dc === side ? r.amount : -r.amount;
      running += delta;
      return { ...r, running };
    });
  }, [filters.accountId, lines, entryMap, costCenterMap, accountMap]);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Relatórios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>De</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Até</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Centro de custo (opcional)</Label>
              <select
                className="w-full h-10 rounded-xl border bg-white px-3 text-sm"
                value={filters.costCenterId}
                onChange={(e) => setFilters((p) => ({ ...p, costCenterId: e.target.value }))}
              >
                <option value="">— Todos —</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {tab === "razao" && (
              <div className="space-y-2 md:col-span-4">
                <Label>Conta (Razão)</Label>
                <select
                  className="w-full h-10 rounded-xl border bg-white px-3 text-sm"
                  value={filters.accountId}
                  onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))}
                >
                  <option value="">— Selecione —</option>
                  {accounts
                    .filter((a) => (a.active ?? true))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex gap-2">
              <Button
                variant={tab === "balancete" ? "default" : "outline"}
                onClick={() => setTab("balancete")}
              >
                Balancete
              </Button>
              <Button
                variant={tab === "razao" ? "default" : "outline"}
                onClick={() => setTab("razao")}
              >
                Razão
              </Button>
              <Button
                variant={tab === "dre" ? "default" : "outline"}
                onClick={() => setTab("dre")}
              >
                DRE
              </Button>
            </div>

            <Button onClick={fetchReportData} disabled={loading}>
              {loading ? "Gerando..." : "Gerar"}
            </Button>
          </div>

          {/* Conteúdo */}
          {tab === "balancete" && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-slate-900">
                Balancete — {filters.from || "—"} até {filters.to || "—"} ({filters.costCenterId ? "com filtro" : "todos"})
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-left">
                      <th className="px-4 py-2 w-[120px]">Código</th>
                      <th className="px-4 py-2">Conta</th>
                      <th className="px-4 py-2 w-[140px]">Débito</th>
                      <th className="px-4 py-2 w-[140px]">Crédito</th>
                      <th className="px-4 py-2 w-[140px]">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-500" colSpan={5}>
                          Sem dados. Gere o relatório.
                        </td>
                      </tr>
                    ) : (
                      aggregated.map((r) => {
                        const bal = calcBalance(r.account.type, r.debit, r.credit);
                        return (
                          <tr key={r.account.id} className="border-b last:border-b-0">
                            <td className="px-4 py-2">{r.account.code}</td>
                            <td className="px-4 py-2">{r.account.name}</td>
                            <td className="px-4 py-2">{r.debit.toFixed(2)}</td>
                            <td className="px-4 py-2">{r.credit.toFixed(2)}</td>
                            <td className="px-4 py-2 font-semibold">{bal.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "razao" && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-slate-900">
                Razão {filters.accountId ? `— ${accountMap[filters.accountId]?.code || ""} ${accountMap[filters.accountId]?.name || ""}` : ""}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-left">
                      <th className="px-4 py-2 w-[120px]">Data</th>
                      <th className="px-4 py-2">Histórico</th>
                      <th className="px-4 py-2">Centro de custo</th>
                      <th className="px-4 py-2 w-[80px]">D/C</th>
                      <th className="px-4 py-2 w-[140px]">Valor</th>
                      <th className="px-4 py-2 w-[140px]">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filters.accountId ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-500" colSpan={6}>
                          Selecione uma conta para ver o razão.
                        </td>
                      </tr>
                    ) : razaoRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-500" colSpan={6}>
                          Sem movimentação (ou ainda não gerou o relatório).
                        </td>
                      </tr>
                    ) : (
                      razaoRows.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="px-4 py-2">{r.date}</td>
                          <td className="px-4 py-2">{r.description}</td>
                          <td className="px-4 py-2">{r.costCenter}</td>
                          <td className="px-4 py-2">{r.dc}</td>
                          <td className="px-4 py-2">{r.amount.toFixed(2)}</td>
                          <td className="px-4 py-2 font-semibold">{r.running.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "dre" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm text-slate-500">Receitas</div>
                <div className="text-2xl font-bold text-slate-900">{dre.revenue.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm text-slate-500">Despesas</div>
                <div className="text-2xl font-bold text-slate-900">{dre.expense.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm text-slate-500">Resultado</div>
                <div className="text-2xl font-bold text-slate-900">{dre.result.toFixed(2)}</div>
              </div>

              <div className="md:col-span-3 text-xs text-slate-500">
                Observação: DRE aqui é “simples”, baseado em somatório por tipo de conta (Receita/Despesa) no período.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

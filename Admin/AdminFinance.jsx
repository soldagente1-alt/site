import React, { useEffect, useMemo, useState } from "react";

import { collection, getDocs } from "firebase/firestore";
import { db } from "../../api/firebaseDb";

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { MiniDonutChart } from "../../components/ui/light-charts";

function moneyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default function AdminFinance() {
  const [period, setPeriod] = useState("6");
  const [payments, setPayments] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFinanceData() {
      try {
        setLoading(true);

        const [paymentsSnap, investorsSnap, franchisesSnap] = await Promise.all([
          getDocs(collection(db, "Payments")),
          getDocs(collection(db, "Investors")),
          getDocs(collection(db, "Franchises")),
        ]);

        setPayments(paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setInvestors(investorsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setFranchises(franchisesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Erro ao carregar financeiro:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFinanceData();
  }, []);

  const familyPayments = useMemo(
    () => payments.filter((p) => p.type === "family_payment" && p.status === "paid"),
    [payments]
  );

  const totalRevenue = useMemo(
    () => familyPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [familyPayments]
  );

  const investorReturns = useMemo(
    () => payments.filter((p) => p.type === "investor_return"),
    [payments]
  );

  const totalReturns = useMemo(
    () => investorReturns.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [investorReturns]
  );

  const franchiseCommissions = useMemo(
    () => payments.filter((p) => p.type === "franchise_commission"),
    [payments]
  );

  const totalCommissions = useMemo(
    () => franchiseCommissions.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [franchiseCommissions]
  );

  const totalInvested = useMemo(
    () => investors.reduce((sum, i) => sum + (Number(i.total_invested) || 0), 0),
    [investors]
  );

  const netResult = totalRevenue - totalReturns - totalCommissions;

  const categoryData = useMemo(
    () => [
      { name: "Receita Famílias", value: totalRevenue, color: "#22c55e" },
      { name: "Retornos Investidores", value: totalReturns, color: "#3b82f6" },
      { name: "Comissões Franquias", value: totalCommissions, color: "#f59e0b" },
    ],
    [totalRevenue, totalReturns, totalCommissions]
  );

  const latestPayments = useMemo(() => payments.slice(0, 10), [payments]);

  if (loading) {
    return <p className="text-slate-500">Carregando financeiro...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão Financeira</h1>
          <p className="text-slate-600">Visão geral das finanças</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita Total" value={totalRevenue} icon={TrendingUp} />
        <StatCard title="Investimentos Captados" value={totalInvested} icon={DollarSign} />
        <StatCard title="Saídas" value={totalReturns + totalCommissions} icon={TrendingDown} positive={false} />
        <StatCard title="Resultado Líquido" value={netResult} icon={BarChart3} positive={netResult >= 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição Financeira</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center">
          <div className="h-72">
            <MiniDonutChart
              data={categoryData}
              labelKey="name"
              valueKey="value"
              centerLabel="Movimentação"
              centerValue={totalRevenue + totalReturns + totalCommissions}
              valueFormatter={moneyBRL}
            />
          </div>

          <div className="space-y-3">
            {categoryData.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{item.name}</div>
                      <div className="text-sm text-slate-500">
                        {totalRevenue + totalReturns + totalCommissions > 0
                          ? `${((item.value / (totalRevenue + totalReturns + totalCommissions)) * 100).toFixed(1)}% do total`
                          : "Sem movimentação"}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900 whitespace-nowrap">{moneyBRL(item.value)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimentações Recentes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Tipo</th>
                <th className="py-2 text-right">Valor</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {latestPayments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td>
                    <Badge>{p.type}</Badge>
                  </td>
                  <td className="text-right">{moneyBRL(p.amount || 0)}</td>
                  <td>
                    <Badge>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, positive = true }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between mb-2">
          <Icon className="w-6 h-6 text-slate-400" />
          {positive ? (
            <ArrowUpRight className="w-4 h-4 text-green-600" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-600" />
          )}
        </div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-bold">{moneyBRL(value)}</p>
      </CardContent>
    </Card>
  );
}

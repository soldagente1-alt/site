import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { format } from "date-fns";
import {
  Calendar,
  Download,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { MiniAreaCompareChart } from "../../components/ui/light-charts";

function moneyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default function FranchiseFinance() {
  const [userData, setUserData] = useState(null);
  const [franchiseData, setFranchiseData] = useState(null);
  const [families, setFamilies] = useState([]);
  const [period, setPeriod] = useState("6");

  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const uData = userSnap.data();
      setUserData(uData);

      if (!uData.franchiseId) return;

      const franchiseRef = doc(db, "franchises", uData.franchiseId);
      const franchiseSnap = await getDoc(franchiseRef);
      if (franchiseSnap.exists()) {
        setFranchiseData({ id: franchiseSnap.id, ...franchiseSnap.data() });
      }

      const q = query(collection(db, "families"), where("franchiseId", "==", uData.franchiseId));
      const snap = await getDocs(q);
      setFamilies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [auth, db]);

  const commissionRate = franchiseData?.commissionRate || 10;
  const totalKitValue = useMemo(
    () => families.reduce((acc, f) => acc + (Number(f.kit_value) || 0), 0),
    [families]
  );
  const totalCommission = (totalKitValue * commissionRate) / 100;
  const paidCommission = franchiseData?.totalCommission || 0;
  const pendingCommission = totalCommission - paidCommission;

  const commissionData = [
    { month: "Jul", valor: 1650 },
    { month: "Ago", valor: 2200 },
    { month: "Set", valor: 2750 },
    { month: "Out", valor: 3300 },
    { month: "Nov", valor: 3850 },
    { month: "Dez", valor: 4400 },
  ];

  const commissionHistory = [
    { id: 1, family: "Maria Silva", kit_value: 5500, commission: 550, date: "2024-12-01", status: "paid" },
    { id: 2, family: "João Santos", kit_value: 5500, commission: 550, date: "2024-11-15", status: "paid" },
    { id: 3, family: "Ana Oliveira", kit_value: 5500, commission: 550, date: "2024-11-01", status: "paid" },
    { id: 4, family: "Carlos Lima", kit_value: 5500, commission: 550, date: "2024-10-20", status: "pending" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-slate-600">Comissões e repasses da sua franquia</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
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
        <MetricCard label="Total de Comissões" value={moneyBRL(totalCommission)} tone="green" />
        <MetricCard label="Comissões Pagas" value={moneyBRL(paidCommission)} />
        <MetricCard label="Comissões Pendentes" value={moneyBRL(pendingCommission)} tone="amber" />
        <MetricCard label="Taxa de Comissão" value={`${commissionRate}%`} tone="purple" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução das Comissões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-64">
            <MiniAreaCompareChart
              data={commissionData}
              xKey="month"
              valueFormatter={moneyBRL}
              series={[{ key: "valor", label: "Comissão", color: "#10b981", fillOpacity: 0.18 }]}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {commissionData.map((item) => (
              <div key={item.month} className="rounded-2xl border border-slate-200 px-3 py-2">
                <div className="text-slate-500">{item.month}</div>
                <div className="font-semibold text-slate-900">{moneyBRL(item.valor)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Comissões</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Família</th>
                <th className="py-2 text-right">Kit</th>
                <th className="py-2 text-right">Comissão</th>
                <th className="py-2 text-left">Data</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissionHistory.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2 font-medium text-slate-900">{item.family}</td>
                  <td className="py-2 text-right">{moneyBRL(item.kit_value)}</td>
                  <td className="py-2 text-right">{moneyBRL(item.commission)}</td>
                  <td className="py-2">{format(new Date(item.date), "dd/MM/yyyy")}</td>
                  <td className="py-2">
                    <Badge variant={item.status === "paid" ? "default" : "secondary"}>
                      {item.status === "paid" ? (
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Pago</span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pendente</span>
                      )}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="bg-sky-50 border-sky-200">
        <CardContent className="p-6 flex gap-4">
          <Calendar className="w-6 h-6 text-sky-600 shrink-0" />
          <p className="text-sm text-sky-700">
            Os repasses são realizados até o dia 10 do mês seguinte à confirmação da instalação.
            {userData?.franchiseId ? "" : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }) {
  const toneMap = {
    default: "bg-white border-slate-200 text-slate-900",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-600",
    purple: "bg-purple-50 border-purple-200 text-purple-600",
  };

  return (
    <Card className={toneMap[tone] || toneMap.default}>
      <CardContent className="p-4">
        <p className="text-sm opacity-80">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

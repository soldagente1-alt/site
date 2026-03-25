import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../api/firebaseDb";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  Sun,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

export default function InvestorContracts() {
  const [investor, setInvestor] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [loading, setLoading] = useState(true);

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      // Buscar investidor vinculado ao usuário
      const investorSnap = await getDocs(
        query(collection(db, "investors"), where("user_id", "==", user.uid))
      );

      if (investorSnap.empty) {
        setLoading(false);
        return;
      }

      const investorData = {
        id: investorSnap.docs[0].id,
        ...investorSnap.docs[0].data(),
      };

      setInvestor(investorData);

      // Buscar investimentos
      const investmentsSnap = await getDocs(
        query(
          collection(db, "investments"),
          where("investor_id", "==", investorData.id),
          orderBy("created_at", "desc")
        )
      );

      const mappedContracts = investmentsSnap.docs.map((docSnap, index) => {
        const inv = docSnap.data();

        return {
          id: docSnap.id,
          number: `INV-${new Date().getFullYear()}-${String(index + 1).padStart(4, "0")}`,
          type: "Contrato de Investimento",
          kits: inv.kits_quantity || 0,
          amount: inv.amount || 0,
          date: inv.created_at,
          signed: inv.contract_signed || false,
          status: inv.status || "pending",
        };
      });

      setContracts(mappedContracts);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return null;

  /* =========================
     CALCULATIONS
  ========================= */
  const signedCount = contracts.filter((c) => c.signed).length;
  const pendingCount = contracts.length - signedCount;
  const totalAmount = contracts.reduce((acc, c) => acc + (c.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Contratos</h1>
        <p className="text-slate-600">Gerencie seus contratos de investimento</p>
      </div>

      {/* SUMMARY */}
      <div className="grid sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={CheckCircle2}
          label="Contratos Assinados"
          value={signedCount}
          color="green"
        />
        <SummaryCard
          icon={Clock}
          label="Pendentes"
          value={pendingCount}
          color="amber"
        />
        <SummaryCard
          icon={DollarSign}
          label="Valor Total Contratado"
          value={`R$ ${totalAmount.toLocaleString("pt-BR")}`}
          color="sky"
        />
      </div>

      {/* CONTRACT LIST */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Meus Contratos
          </CardTitle>
        </CardHeader>

        <CardContent>
          {contracts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum contrato encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="border rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-500" />
                      </div>

                      <div>
                        <h3 className="font-semibold">{contract.type}</h3>
                        <p className="text-sm text-slate-500">{contract.number}</p>

                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Sun className="w-3 h-3 text-amber-500" />
                            {contract.kits} kits
                          </span>

                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-green-500" />
                            R$ {contract.amount.toLocaleString("pt-BR")}
                          </span>

                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-500" />
                            {contract.date
                              ? format(
                                  contract.date.toDate(),
                                  "dd/MM/yyyy",
                                  { locale: ptBR }
                                )
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Badge
                      className={
                        contract.signed
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }
                    >
                      {contract.signed ? "Assinado" : "Pendente"}
                    </Badge>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedContract(contract)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Visualizar
                    </Button>

                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Baixar PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedContract?.type}
            </DialogTitle>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
                <Info label="Número do Contrato" value={selectedContract.number} />
                <Info
                  label="Data"
                  value={
                    selectedContract.date
                      ? format(
                          selectedContract.date.toDate(),
                          "dd 'de' MMMM 'de' yyyy",
                          { locale: ptBR }
                        )
                      : "-"
                  }
                />
                <Info label="Quantidade de Kits" value={selectedContract.kits} />
                <Info
                  label="Valor"
                  value={`R$ ${selectedContract.amount.toLocaleString("pt-BR")}`}
                />
              </div>

              {selectedContract.signed && (
                <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  Contrato assinado digitalmente
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>

                {!selectedContract.signed && (
                  <Button className="flex-1 bg-sky-500 hover:bg-sky-600">
                    Assinar Digitalmente
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================
   HELPERS
========================= */

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 bg-${color}-100 rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}-600`} />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

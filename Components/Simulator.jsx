import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  ArrowRight,
  ArrowLeft,
  TrendingDown,
  Calculator,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";

function brl(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function safeNumber(value, fallback = 0) {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export default function Simulator() {
  const [currentBillStr, setCurrentBillStr] = useState("200");
  const [showResults, setShowResults] = useState(false);

  const CONTRACT_MONTHS = 120;
  const KIT_MONTHLY = 189.9;
  const GRID_FEE = 50;
  const MONTHLY_SOL_TOTAL = KIT_MONTHLY + GRID_FEE;

  const bill = useMemo(() => {
    const v = safeNumber(currentBillStr, 0);
    return v < 0 ? 0 : v;
  }, [currentBillStr]);

  const calc = useMemo(() => {
    const currentMonthly = bill;
    const solMonthlyDuring = MONTHLY_SOL_TOTAL;
    const solMonthlyAfter = GRID_FEE;

    const diffMonthly = currentMonthly - solMonthlyDuring;

    const totalCurrent10y = currentMonthly * CONTRACT_MONTHS;
    const totalSol10y = solMonthlyDuring * CONTRACT_MONTHS;

    const totalCurrent25y = currentMonthly * (25 * 12);
    const totalSol25y = totalSol10y + solMonthlyAfter * (15 * 12);

    const savings10y = totalCurrent10y - totalSol10y;
    const savings25y = totalCurrent25y - totalSol25y;

    return {
      currentMonthly,
      solMonthlyDuring,
      solMonthlyAfter,
      diffMonthly,
      totalCurrent10y,
      totalSol10y,
      totalCurrent25y,
      totalSol25y,
      savings10y,
      savings25y,
    };
  }, [bill]);

  const handleSimulate = () => setShowResults(true);

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-5xl mx-auto mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para início
        </Link>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Calculator className="w-4 h-4" />
            Simulador de Economia
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Descubra sua Economia com Energia Solar
          </h1>
          <p className="text-lg text-slate-600">
            Digite sua conta de luz e compare com o Sol da Gente em{" "}
            <strong>10 e 25 anos</strong>.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="max-w-xl mx-auto">
                <CardContent className="p-8">
                  <div className="mb-8">
                    <Label className="text-lg font-medium text-slate-900 mb-4 block">
                      Quanto você paga de luz por mês?
                    </Label>

                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-slate-500">R$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={currentBillStr}
                        onChange={(e) => setCurrentBillStr(e.target.value)}
                        placeholder="Ex.: 230 ou 230,50"
                        className="text-3xl font-bold h-16 text-center"
                      />
                    </div>

                    <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <p className="text-sm text-slate-700">
                        No Sol da Gente, durante o contrato você paga:
                      </p>

                      <div className="text-sm text-slate-700">
                        <div className="flex items-center justify-between">
                          <span>Parcela do kit</span>
                          <strong>{brl(KIT_MONTHLY)}/mês</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Taxa fixa</span>
                          <strong>{brl(GRID_FEE)}/mês</strong>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
                          <span>Total mensal (de fato)</span>
                          <strong className="text-slate-900">
                            {brl(MONTHLY_SOL_TOTAL)}/mês
                          </strong>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500">
                        Depois do contrato: <strong>{brl(GRID_FEE)}/mês</strong>{" "}
                        (taxa mínima).
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleSimulate}
                    className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-lg"
                  >
                    Ver Minha Economia
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid lg:grid-cols-3 gap-6 mb-8">
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-red-700 font-medium">
                          Conta de Luz Atual
                        </p>
                        <p className="text-xs text-red-600">Concessionária</p>
                      </div>
                    </div>

                    <p className="text-4xl font-bold text-red-700 mb-2">
                      {brl(calc.currentMonthly)}
                    </p>
                    <p className="text-sm text-red-600">por mês</p>

                    <div className="mt-4 pt-4 border-t border-red-200 space-y-1">
                      <p className="text-sm text-red-700">
                        Em 10 anos: <strong>{brl(calc.totalCurrent10y)}</strong>
                      </p>
                      <p className="text-sm text-red-700">
                        Em 25 anos: <strong>{brl(calc.totalCurrent25y)}</strong>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-green-600 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                    SOL DA GENTE
                  </div>

                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <Sun className="w-5 h-5 text-green-700" />
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-medium">
                          Durante 10 anos
                        </p>
                        <p className="text-xs text-green-600">
                          Contrato 120 meses
                        </p>
                      </div>
                    </div>

                    <p className="text-4xl font-bold text-green-700 mb-2">
                      {brl(calc.solMonthlyDuring)}
                    </p>
                    <p className="text-sm text-green-700">
                      por mês (kit Essencial + taxa Concessionária)
                    </p>

                    <div className="mt-4 pt-4 border-t border-green-200 space-y-1">
                      <p className="text-sm text-green-700">
                        Total 10 anos: <strong>{brl(calc.totalSol10y)}</strong>
                      </p>

                      {calc.diffMonthly >= 0 ? (
                        <p className="text-xs text-green-700">
                          Diferença mensal:{" "}
                          <strong>economiza {brl(calc.diffMonthly)}</strong>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700">
                          Diferença mensal:{" "}
                          <strong>
                            fica {brl(Math.abs(calc.diffMonthly))} a mais
                          </strong>
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-sm text-amber-800 font-medium">
                          Depois do contrato
                        </p>
                        <p className="text-xs text-amber-700">Taxa mínima</p>
                      </div>
                    </div>

                    <p className="text-4xl font-bold text-amber-800 mb-2">
                      {brl(calc.solMonthlyAfter)}
                    </p>
                    <p className="text-sm text-amber-700">por mês</p>

                    <div className="mt-4 pt-4 border-t border-amber-200 space-y-2">
                      <p className="text-xs text-amber-700">
                        Em 25 anos (10 anos contrato + 15 anos taxa):{" "}
                        <strong>{brl(calc.totalSol25y)}</strong>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-8 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <TrendingDown className="w-8 h-8" />
                    <h3 className="text-2xl font-bold">Comparativo de Totais</h3>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="bg-white/20 rounded-xl p-4">
                      <p className="text-amber-100 text-sm">
                        Diferença mensal (hoje)
                      </p>
                      <p className="text-3xl font-bold">
                        {calc.diffMonthly >= 0
                          ? brl(calc.diffMonthly)
                          : `-${brl(Math.abs(calc.diffMonthly))}`}
                      </p>
                      <p className="text-xs text-amber-100 mt-2">
                        {calc.diffMonthly >= 0
                          ? "Economia mensal"
                          : "A mais no mês (transparente)"}
                      </p>
                    </div>

                    <div className="bg-white/20 rounded-xl p-4">
                      <p className="text-amber-100 text-sm">
                        Diferença em 10 anos
                      </p>
                      <p className="text-3xl font-bold">
                        {brl(calc.savings10y)}
                      </p>
                      <p className="text-xs text-amber-100 mt-2">
                        Conta atual: <strong>{brl(calc.totalCurrent10y)}</strong>{" "}
                        • Sol: <strong>{brl(calc.totalSol10y)}</strong>
                      </p>
                    </div>

                    <div className="bg-white/20 rounded-xl p-4">
                      <p className="text-amber-100 text-sm">
                        Diferença em 25 anos
                      </p>
                      <p className="text-3xl font-bold">
                        {brl(calc.savings25y)}
                      </p>
                      <p className="text-xs text-amber-100 mt-2">
                        Conta atual: <strong>{brl(calc.totalCurrent25y)}</strong>{" "}
                        • Sol: <strong>{brl(calc.totalSol25y)}</strong>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-8">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    O que você ganha com o Sol da Gente:
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      "Sem entrada",
                      "Parcela fixa do kit: R$ 189,90/mês",
                      "Taxa fixa: R$ 35 a R$ 50/mês",
                      "Total mensal transparente: R$ 239,90/mês no contrato",
                      "Depois do contrato: R$ 35 a R$ 50/mês (taxa mínima)",
                      "Acompanhamento e suporte",
                    ].map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-slate-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowResults(false)}
                  className="h-12"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Simular novamente
                </Button>

                <Button
                  className="h-12 bg-amber-500 hover:bg-amber-600 px-8"
                  asChild
                >
                  <Link to="/waitlist">
                    Entrar na fila de espera
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
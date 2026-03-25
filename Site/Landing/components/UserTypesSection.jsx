import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight, Home, Wallet } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export default function UserTypesSection({ tracking }) {
  const { handleFamilyRegisterClick, handleInvestorRegisterClick } = tracking;

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Faça parte do Sol da Gente</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Formas diferentes de participar, com a mesma base: clareza, estrutura e visão de longo prazo.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-amber-400 transition-colors">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
                <Home className="w-8 h-8 text-amber-600" />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-3">Famílias</h3>

              <p className="text-slate-600 mb-6">
                Um caminho mais organizado para quem quer entrar na energia solar com acompanhamento, regra clara e previsibilidade.
              </p>

              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Pré-fila com posição
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Jornada com regras objetivas
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Instalação e homologação na sequência da fila
                </li>
              </ul>

              <Button className="w-full bg-amber-500 hover:bg-amber-600" asChild>
                <Link
                  to={createPageUrl("FamilyRegister")}
                  state={{ fromLanding: true, method: "email" }}
                  onClick={() => handleFamilyRegisterClick("family_card")}
                >
                  Quero participar
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-sky-400 transition-colors">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center mb-6">
                <Wallet className="w-8 h-8 text-sky-600" />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-3">Investidores</h3>

              <p className="text-slate-600 mb-6">
                Participação em um modelo com estrutura, previsibilidade e propósito, ligado à expansão da energia solar.
              </p>

              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Retorno previsto em modelo estruturado
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Transparência e acompanhamento
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Impacto econômico e social
                </li>
              </ul>

              <Button className="w-full bg-sky-500 hover:bg-sky-600" asChild>
                <Link to={createPageUrl("investorregister")} onClick={() => handleInvestorRegisterClick("investor_card")}>
                  Quero investir
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Scale, Shield } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export default function QueueOverviewSection({ tracking }) {
  const { handleWaitlistClick, handleSectionClick } = tracking;

  return (
    <section id="fila" className="pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-amber-50">
            <CardContent className="p-7">
              <p className="text-sm font-semibold text-amber-700 bg-amber-100 inline-flex px-3 py-1 rounded-full">
                Fila do Sol • Grupo de 40
              </p>

              <h3 className="text-2xl font-bold text-slate-900 mt-3">Você entra sabendo como funciona</h3>

              <p className="text-slate-600 mt-2">
                Ao entrar, você acompanha sua posição e o status do grupo. Quando sua vaga estiver pronta para ativação, terá <b>48 horas</b> para confirmar.
              </p>

              <div className="mt-5">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Capacidade do grupo</span>
                  <span className="font-semibold text-slate-900">40 famílias</span>
                </div>

                <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-amber-400 to-amber-500 animate-pulse" />
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  A fila foi pensada para ser simples, objetiva e transparente.
                </p>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white" asChild>
                  <Link to={createPageUrl("waitlist")} onClick={() => handleWaitlistClick("fila_card")}>
                    Entrar na Pré-fila
                  </Link>
                </Button>

                <Button variant="outline" asChild>
                  <Link to={createPageUrl("Fila")} onClick={() => handleSectionClick("fila_app", "fila_card")}>
                    Ver Fila
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-slate-900 text-white">
            <CardContent className="p-7">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Scale className="w-6 h-6 text-amber-400" />
              </div>

              <h3 className="text-2xl font-bold mt-4">Não é consórcio</h3>

              <p className="text-slate-300 mt-2">
                Aqui você não depende de sorteio nem assembleia. O avanço acontece com <b className="text-white">fila organizada e regra clara</b>.
              </p>

              <ul className="mt-5 space-y-3">
                <li className="flex items-start gap-2 text-slate-200">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 mt-0.5" />
                  <span><b>Sem sorteio</b> e sem contemplação.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-200">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 mt-0.5" />
                  <span><b>Sem assembleia</b> para definir seu avanço.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-200">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 mt-0.5" />
                  <span><b>Com posição e regra objetiva</b> para toda a jornada.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-sky-50">
            <CardContent className="p-7">
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-sky-700" />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mt-4">Regras rápidas</h3>

              <p className="text-slate-600 mt-2">
                Tudo foi desenhado para reduzir dúvida e aumentar previsibilidade.
              </p>

              <ul className="mt-5 space-y-3">
                <li className="flex items-start gap-2 text-slate-600">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
                  <span><b>Inscrição</b> gera posição inicial.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-600">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
                  <span><b>Ativação em 48h</b> confirma a vaga quando o grupo abrir.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-600">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
                  <span><b>Vencimento fixo</b> ajuda sua organização.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-600">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
                  <span><b>120 meses</b> na estrutura do contrato.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

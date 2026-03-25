import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export default function FaqSection({ faqItems, tracking }) {
  const { handleWaitlistClick, handleSimulatorClick } = tracking;

  return (
    <section id="duvidas" className="py-20 px-4 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Dúvidas rápidas</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Respostas diretas para você entender a proposta com mais segurança.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {faqItems.map((item) => (
            <Card key={item.q} className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <p className="font-semibold text-slate-900">{item.q}</p>
                <p className="text-slate-600 mt-2 leading-relaxed">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" asChild>
            <Link to={createPageUrl("waitlist")} onClick={() => handleWaitlistClick("faq")}>
              Entrar na Pré-fila
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link to={createPageUrl("Simulator")} onClick={() => handleSimulatorClick("faq")}>
              Simular Economia
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

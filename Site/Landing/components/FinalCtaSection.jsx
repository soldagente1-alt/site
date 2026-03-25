import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";

export default function FinalCtaSection({ tracking }) {
  const { handleWaitlistClick, handleSimulatorClick } = tracking;

  return (
    <section className="py-16 px-4 bg-gradient-to-r from-amber-500 to-amber-600">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Entre com clareza. Acompanhe com confiança.</h2>

        <p className="text-lg sm:text-xl text-amber-100 mb-8 max-w-3xl mx-auto">
          Pré-fila com posição, ativação em 48 horas quando o grupo abrir e uma jornada organizada até a instalação.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-orange-500 hover:bg-orange-600 text-white h-14 px-10 text-lg shadow-lg shadow-orange-300/30"
            asChild
          >
            <Link to={createPageUrl("waitlist")} onClick={() => handleWaitlistClick("cta_final")}>
              Entrar na Pré-fila Grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-14 px-10 text-lg border-white text-white bg-transparent hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link to={createPageUrl("Simulator")} onClick={() => handleSimulatorClick("cta_final")}>
              Simular Economia
            </Link>
          </Button>
        </div>

        <p className="text-sm text-amber-100/90 mt-6">
          Você entra sabendo como funciona, com documentos públicos e canais oficiais disponíveis.
        </p>
      </div>
    </section>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, CheckCircle2, Play } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";

export default function HeroSection({ tracking }) {
  const { handleWaitlistClick, handleSimulatorClick, handleSectionClick } = tracking;

  return (
    <section className="pt-32 pb-20 px-4 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BadgeCheck className="w-4 h-4" />
              Pré-fila com regras claras e canais oficiais
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Energia solar com{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-600">
                fila organizada
              </span>
              , regra clara e entrada acessível
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 mb-9 leading-relaxed max-w-2xl">
              Entre na pré-fila, acompanhe sua posição, ative sua vaga quando o grupo abrir e siga uma jornada mais previsível até a instalação.
            </p>

            <div className="relative z-10 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white h-12 px-6 text-base w-full sm:w-auto shadow-lg shadow-orange-200 ring-1 ring-orange-300/40"
                asChild
              >
                <Link to={createPageUrl("waitlist")} onClick={() => handleWaitlistClick("hero")}>
                  Entrar na Pré-fila
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base border-2 border-slate-200 text-slate-700 hover:border-amber-300 w-full sm:w-auto"
                asChild
              >
                <Link to={createPageUrl("Simulator")} onClick={() => handleSimulatorClick("hero")}>
                  Simular Economia
                </Link>
              </Button>

              <Button size="lg" variant="ghost" className="h-12 px-6 text-base text-slate-700 w-full sm:w-auto" asChild>
                <a href="#como-funciona" onClick={() => handleSectionClick("como_funciona", "hero")}>
                  <Play className="w-4 h-4 mr-2" />
                  Ver Como Funciona
                </a>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-8 mt-10 pt-8 border-t border-slate-200">
              <div>
                <p className="text-3xl font-bold text-slate-900">40</p>
                <p className="text-sm text-slate-500">Famílias por grupo</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">48h</p>
                <p className="text-sm text-slate-500">Para ativar a vaga</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">120</p>
                <p className="text-sm text-slate-500">Meses do contrato</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="relative bg-gradient-to-br from-amber-100 to-sky-100 rounded-3xl p-6 lg:p-10">
              <picture>
                <source srcSet="/Images/hero-solar.webp" type="image/webp" />
                <img
                  src="/Images/hero-solar.jpg"
                  alt="Energia solar do Sol da Gente"
                  className="rounded-2xl shadow-2xl w-full h-full object-cover"
                  loading="eager"
                  fetchpriority="high"
                  decoding="async"
                />
              </picture>

              <div className="absolute bottom-3 left-3 md:-bottom-6 md:-left-6 bg-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 max-w-[240px] border border-slate-100">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Jornada previsível</p>
                  <p className="text-sm text-slate-500">Posição, ativação e acompanhamento</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

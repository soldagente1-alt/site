import React from "react";
import { Link } from "react-router-dom";
import { Sun } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";

export default function Navbar({ tracking }) {
  const { handleSectionClick, handleSimulatorClick, handleLoginClick, handleWaitlistClick } = tracking;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-lg border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
              <Sun className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-800">Sol da Gente</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link
              to={createPageUrl("Fila")}
              className="text-slate-600 hover:text-slate-900 text-sm font-medium"
              onClick={() => handleSectionClick("fila", "navbar")}
            >
              Fila
            </Link>
            <a
              href="#como-funciona"
              className="text-slate-600 hover:text-slate-900 text-sm font-medium"
              onClick={() => handleSectionClick("como_funciona", "navbar")}
            >
              Como Funciona
            </a>
            <a
              href="#beneficios"
              className="text-slate-600 hover:text-slate-900 text-sm font-medium"
              onClick={() => handleSectionClick("beneficios", "navbar")}
            >
              Benefícios
            </a>
            <Link
              to={createPageUrl("Simulator")}
              className="text-slate-600 hover:text-slate-900 text-sm font-medium"
              onClick={() => handleSimulatorClick("navbar")}
            >
              Simulador
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to={createPageUrl("firebaseLogin")} onClick={() => handleLoginClick("navbar")}>
                Entrar
              </Link>
            </Button>

            <Button className="bg-amber-500 hover:bg-amber-600 text-white" asChild>
              <Link to={createPageUrl("waitlist")} onClick={() => handleWaitlistClick("navbar")}>
                Entrar na fila
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { FileText, Lock, Mail, MapPin, Phone, Scale, Sun } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";

export default function FooterSection({ ano, tracking }) {
  const {
    handleSectionClick,
    handleSimulatorClick,
    handlePrivacyClick,
    handleTermsClick,
    handleFamilyRegisterClick,
    handleInvestorRegisterClick,
    handleContactClick,
    trackCTA,
  } = tracking;

  return (
    <footer className="bg-slate-900 text-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center">
                <Sun className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl">Sol da Gente</span>
            </div>

            <p className="text-slate-400 text-sm">
              Energia solar com mais clareza, previsibilidade e organização para quem quer entrar do jeito certo.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>
                <a href="#como-funciona" className="hover:text-white" onClick={() => handleSectionClick("como_funciona", "footer")}>
                  Como Funciona
                </a>
              </li>
              <li>
                <Link to={createPageUrl("Simulator")} className="hover:text-white" onClick={() => handleSimulatorClick("footer")}>
                  Simulador
                </Link>
              </li>
              <li>
                <a href="#duvidas" className="hover:text-white" onClick={() => handleSectionClick("duvidas", "footer")}>
                  Dúvidas rápidas
                </a>
              </li>
              <li>
                <Link to={createPageUrl("privacelgpd")} className="hover:text-white" onClick={() => handlePrivacyClick("footer_links")}>
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("waitlist-terms")} className="hover:text-white" onClick={() => handleTermsClick("footer_links")}>
                  Termos
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Participar</h4>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>
                <Link to={createPageUrl("FamilyRegister")} className="hover:text-white" onClick={() => handleFamilyRegisterClick("footer")}>
                  Famílias
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("investorregister")} className="hover:text-white" onClick={() => handleInvestorRegisterClick("footer")}>
                  Investidores
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("franchiseregister")} className="hover:text-white" onClick={() => trackCTA("franchise_register", "footer")}>
                  Franqueados
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contato</h4>
            <ul className="space-y-3 text-slate-400 text-sm">
              <li>
                <a href="tel:+5575992302620" className="flex items-center gap-2 hover:text-white" onClick={() => handleContactClick("phone", "footer")}>
                  <Phone className="w-4 h-4" />
                  (75) 99230-2620
                </a>
              </li>
              <li>
                <a href="mailto:contato@soldagente.com.br" className="flex items-center gap-2 hover:text-white" onClick={() => handleContactClick("email", "footer")}>
                  <Mail className="w-4 h-4" />
                  contato@soldagente.com.br
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Feira de Santana
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-slate-500 text-sm">
          <p>© {ano} Sol da Gente. Todos os direitos reservados.</p>

          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2">
              <Scale className="w-4 h-4" />
              CNPJ 45.141.739/0001-51
            </span>

            <span className="hidden md:inline text-slate-700">•</span>

            <Link
              to={createPageUrl("privacelgpd")}
              className="hover:text-white inline-flex items-center gap-2"
              onClick={() => handlePrivacyClick("footer_bottom")}
            >
              <FileText className="w-4 h-4" />
              Privacidade
            </Link>

            <span className="hidden md:inline text-slate-700">•</span>

            <Link
              to={createPageUrl("waitlist-terms")}
              className="hover:text-white inline-flex items-center gap-2"
              onClick={() => handleTermsClick("footer_bottom")}
            >
              <Scale className="w-4 h-4" />
              Termos
            </Link>

            <span className="hidden md:inline text-slate-700">•</span>

            <span className="inline-flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Dados protegidos
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { Building2, FileText, Lock, Mail, Phone, Scale } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export default function TrustBlockSection({ tracking }) {
  const { handlePrivacyClick, handleTermsClick, handleContactClick, handleWaitlistClick } = tracking;

  return (
    <section className="py-14 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <Card className="border border-slate-200 shadow-lg bg-gradient-to-br from-white to-slate-50">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <Building2 className="w-4 h-4" />
                  Canais oficiais e dados institucionais
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Transparência antes de qualquer decisão</h2>

                <p className="text-slate-600 mt-3 leading-relaxed">
                  O Sol da Gente está em fase de abertura comercial, com canais oficiais, política de privacidade, termos públicos e comunicação direta para quem quer entender a proposta com segurança.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" asChild>
                  <Link to={createPageUrl("privacelgpd")} onClick={() => handlePrivacyClick("trust_block_top")}>
                    <FileText className="w-4 h-4 mr-2" />
                    Política de Privacidade
                  </Link>
                </Button>

                <Button variant="outline" asChild>
                  <Link to={createPageUrl("waitlist-terms")} onClick={() => handleTermsClick("trust_block_top")}>
                    <Scale className="w-4 h-4 mr-2" />
                    Termos
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-500 mb-4">Canais oficiais</p>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl border bg-white p-5">
                  <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">Nome empresarial</p>
                  <p className="text-slate-900 font-semibold mt-2">Sol da Gente</p>
                </div>

                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
                  <p className="text-xs font-semibold tracking-wide uppercase text-amber-700">CNPJ</p>
                  <p className="text-slate-900 font-bold mt-2 text-lg">45.141.739/0001-51</p>
                </div>

                <div className="rounded-2xl border bg-white p-5">
                  <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">Cidade-base</p>
                  <p className="text-slate-900 font-semibold mt-2">Feira de Santana</p>
                </div>

                <div className="rounded-2xl border bg-white p-5">
                  <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">E-mail oficial</p>
                  <a
                    href="mailto:contato@soldagente.com.br"
                    className="mt-2 inline-flex items-center gap-2 text-slate-900 font-semibold hover:text-amber-600"
                    onClick={() => handleContactClick("email", "trust_block")}
                  >
                    <Mail className="w-4 h-4" />
                    contato@soldagente.com.br
                  </a>
                </div>

                <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-5">
                  <p className="text-xs font-semibold tracking-wide uppercase text-green-700">WhatsApp oficial</p>
                  <a
                    href="https://wa.me/5575992302620"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-slate-900 font-bold hover:text-green-600"
                    onClick={() => handleContactClick("whatsapp", "trust_block")}
                  >
                    <Phone className="w-4 h-4" />
                    (75) 99230-2620
                  </a>
                </div>

                <div className="rounded-2xl border bg-white p-5">
                  <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">Documentos públicos</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link
                      to={createPageUrl("privacelgpd")}
                      className="text-sm font-semibold text-slate-900 hover:text-amber-600"
                      onClick={() => handlePrivacyClick("trust_block_cards")}
                    >
                      Privacidade
                    </Link>

                    <Link
                      to={createPageUrl("waitlist-terms")}
                      className="text-sm font-semibold text-slate-900 hover:text-amber-600"
                      onClick={() => handleTermsClick("trust_block_cards")}
                    >
                      Termos
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-slate-900 text-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-semibold">Canal oficial, documentos públicos e contato direto</p>
                  <p className="text-sm text-slate-300">
                    Antes de qualquer cadastro, você pode conferir dados institucionais, política de privacidade e termos de uso.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white" asChild>
                  <Link to={createPageUrl("waitlist")} onClick={() => handleWaitlistClick("trust_block_bottom")}>
                    Entrar na Pré-fila
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="border-slate-600 text-white bg-transparent hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <a
                    href="https://wa.me/5575992302620"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleContactClick("whatsapp", "trust_block_bottom")}
                  >
                    Falar no WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

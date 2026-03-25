import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Lock } from "lucide-react";
import { createPageUrl } from "../../../utils/createPageUrl";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export default function HowItWorksSection({ steps, tracking }) {
  const { handlePrivacyClick } = tracking;

  return (
    <section id="como-funciona" className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Como funciona a Fila do Sol</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Uma jornada em 4 passos, com mais clareza desde a entrada até a instalação.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <Card className="relative h-full border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-slate-50 to-white">
                <CardContent className="p-6">
                  <span className="text-5xl font-bold text-amber-200">{step.number}</span>
                  <h3 className="text-xl font-semibold text-slate-900 mt-4 mb-2">{step.title}</h3>
                  <p className="text-slate-600">{step.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-12">
          <div className="rounded-2xl border bg-slate-50 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center">
                <Lock className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Privacidade e LGPD</p>
                <p className="text-slate-600 text-sm">
                  Seus dados são tratados com segurança, clareza e política pública disponível.
                </p>
              </div>
            </div>

            <Button variant="outline" asChild>
              <Link to={createPageUrl("privacelgpd")} onClick={() => handlePrivacyClick("lgpd_bloco")}>
                <FileText className="w-4 h-4 mr-2" />
                Ler Política de Privacidade
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

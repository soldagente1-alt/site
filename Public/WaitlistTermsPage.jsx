// WaitlistTermsPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, FileText, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

export default function WaitlistTermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border px-3 py-1 rounded-full text-sm text-slate-700">
              <FileText className="w-4 h-4" />
              Termos da Fila • v1
            </div>
            <h1 className="text-2xl font-bold mt-3">Termos da Fila de Espera</h1>
            <p className="text-sm text-slate-600 mt-1">
              Estes termos descrevem as regras públicas da fila, aplicadas igualmente a todos.
            </p>
          </div>

          <Link to="/waitlist">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Princípio de Justiça e Sustentabilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              A fila existe para organizar a demanda, formar grupos por região e garantir previsibilidade operacional.
              <strong> Prioridade é para quem está em dia.</strong>
            </p>

            <div className="p-4 bg-slate-50 border rounded-xl">
              <p className="font-semibold text-slate-900">1) Ordem da fila</p>
              <p className="mt-1">
                A ordem padrão é por <strong>inscrição</strong>: quem entra primeiro, é chamado primeiro.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border rounded-xl">
              <p className="font-semibold text-slate-900">2) Ativação do grupo e prazo de 48h</p>
              <p className="mt-1">
                Quando o seu grupo for <strong>ativado</strong>, você terá <strong>48 horas</strong> para pagar a{" "}
                <strong>primeira mensalidade</strong> e manter sua posição/convite no grupo.
              </p>
              <p className="mt-2">
                <strong>Não pagou em 48h:</strong> perde a posição e vai para o <strong>fim da fila</strong>.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border rounded-xl">
              <p className="font-semibold text-slate-900">3) Atraso em parcelas futuras</p>
              <p className="mt-1">
                Se houver atraso em mensalidades posteriores (após entrada/ativação), o participante poderá ser movido
                para o <strong>fim da fila</strong> (ou perder prioridade em grupos futuros), para preservar a saúde do projeto.
              </p>
            </div>

{/* ✅ O que acontece em caso de atraso (detalhado) */}
<div className="p-4 bg-slate-50 border rounded-xl">
  <p className="font-semibold text-slate-900">O que acontece em caso de atraso</p>
  <p className="text-sm text-slate-700 mt-1">
    A fila é um compromisso. Para garantir justiça e sustentabilidade, seguimos uma régua clara e igual para todos.
  </p>

  {/* Ativação do grupo (regra de 48h) */}
  <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
    <p className="font-semibold text-slate-900">Ativação do grupo</p>
    <p className="text-sm text-slate-700 mt-1">
      Quando o seu grupo for <strong>ativado</strong>, você tem <strong>48 horas</strong> para pagar a{" "}
      <strong>primeira mensalidade</strong> e manter sua posição.
    </p>
    <p className="text-sm text-slate-700 mt-2">
      <strong>Não pagou em 48h:</strong> perde a prioridade e vai para o <strong>fim da fila</strong>.
    </p>
  </div>

  {/* Régua D+ */}
  <div className="mt-3 space-y-2">
    <div className="p-3 bg-white rounded-xl border">
      <p className="font-semibold text-slate-900">D+3 — Lembrete 1</p>
      <p className="text-sm text-slate-700 mt-1">
        Aviso automático no WhatsApp/app com link/2ª via de pagamento e orientações para regularizar.
      </p>
    </div>

    <div className="p-3 bg-white rounded-xl border">
      <p className="font-semibold text-slate-900">D+7 — Lembrete 2 + contato humano</p>
      <p className="text-sm text-slate-700 mt-1">
        Reforço de cobrança e tentativa de contato humano (WhatsApp/telefone) para entender o motivo e orientar.
      </p>
    </div>

    <div className="p-3 bg-white rounded-xl border">
      <p className="font-semibold text-slate-900">D+15 — Aviso formal de impacto na prioridade</p>
      <p className="text-sm text-slate-700 mt-1">
        Aviso formal de que o atraso passa a impactar a <strong>prioridade</strong> no processo (fila/grupo) e pode
        ocorrer <strong>rebaixamento de posição</strong>.
      </p>
    </div>

    <div className="p-3 bg-white rounded-xl border">
      <p className="font-semibold text-slate-900">D+30 — Perda de prioridade / rebaixamento</p>
      <p className="text-sm text-slate-700 mt-1">
        O cadastro pode ser marcado como <strong>inadimplente</strong> e o participante perde prioridade no andamento.
        Se estiver em fase de fila/grupo, pode ir para o <strong>fim da fila</strong> até regularização.
      </p>
    </div>

    <div className="p-3 bg-white rounded-xl border">
      <p className="font-semibold text-slate-900">D+90 — Encaminhamento para tratativa final</p>
      <p className="text-sm text-slate-700 mt-1">
        Tratativa final com cobrança/renegociação e medidas previstas nos termos/contrato aplicável ao estágio do processo.
      </p>
    </div>
  </div>

  <p className="text-xs text-slate-500 mt-3">
    Observação: o objetivo da régua é avisar, orientar e preservar o projeto saudável. A prioridade é sempre de quem
    mantém os pagamentos em dia.
  </p>
</div>

            <div className="p-4 bg-slate-50 border rounded-xl">
              <p className="font-semibold text-slate-900">5) Comunicação e LGPD</p>
              <p className="mt-1">
                Ao entrar na fila, você autoriza contato para atualizações e aceita a Política de Privacidade (LGPD).
              </p>
              <p className="mt-2">
                Consulte:{" "}
                <a href="/lgpd" className="underline" target="_blank" rel="noreferrer">
                  Política de Privacidade (LGPD)
                </a>
                .
              </p>
            </div>

            <div className="text-xs text-slate-500">
              Estes termos podem ser atualizados por versão. A versão aceita é registrada no seu cadastro de fila.
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 flex-wrap">
          <Link to="/waitlist">
            <Button className="bg-amber-500 hover:bg-amber-600">Voltar para a fila</Button>
          </Link>
          <a href="/lgpd" target="_blank" rel="noreferrer">
            <Button variant="outline">Ver LGPD</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
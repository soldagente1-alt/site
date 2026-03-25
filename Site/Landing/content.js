import React from "react";
import { Shield, TrendingUp, Zap, Users } from "lucide-react";

export const landingBenefits = [
  {
    icon: Shield,
    title: "Fila organizada e regra clara",
    description: "Você entra sabendo como funciona: posição, ativação, vencimento e avanço da instalação.",
  },
  {
    icon: TrendingUp,
    title: "Previsibilidade no lugar da incerteza",
    description: "Uma jornada pensada para dar mais controle financeiro e menos susto com energia.",
  },
  {
    icon: Zap,
    title: "Acesso mais possível à energia solar",
    description: "Um caminho mais acessível para quem quer sair do improviso e entrar com organização.",
  },
  {
    icon: Users,
    title: "Modelo com impacto real",
    description: "Energia limpa com estrutura, clareza e foco em ampliar o acesso para mais famílias.",
  },
];

export const landingSteps = [
  {
    number: "01",
    title: "Entre na pré-fila",
    description: "Você se inscreve grátis e já acompanha sua posição inicial.",
  },
  {
    number: "02",
    title: "Ative em 48h",
    description: "Quando o grupo abrir, você confirma sua vaga dentro do prazo.",
  },
  {
    number: "03",
    title: "Pague com previsibilidade",
    description: "Depois da ativação, você escolhe um vencimento fixo para organizar sua rotina.",
  },
  {
    number: "04",
    title: "Acompanhe até instalar",
    description: "A jornada segue com fila organizada, atualização e avanço até a instalação.",
  },
];

export const landingFaqItems = [
  {
    q: "Quando eu começo a pagar?",
    a: (
      <>
        Você pode entrar na pré-fila <b>sem custo de inscrição</b>. Quando o grupo abrir, você terá <b>48 horas</b> para ativar sua vaga pagando a primeira mensalidade.
      </>
    ),
  },
  {
    q: "Isso é consórcio?",
    a: (
      <>
        <b>Não.</b> Aqui não existe sorteio, assembleia nem contemplação. A instalação segue uma <b>fila com regras objetivas</b> e posição acompanhável.
      </>
    ),
  },
  {
    q: "O que acontece se eu atrasar?",
    a: (
      <>
        Manter os pagamentos em dia ajuda a preservar sua organização na jornada. O atraso pode gerar <b>perda de prioridade</b>, conforme as regras da fila.
      </>
    ),
  },
  {
    q: "Eu escolho a data de pagamento?",
    a: (
      <>
        Sim. Após a ativação, você escolhe um vencimento fixo, como <b>dia 5, 10 ou 15</b>, para manter previsibilidade.
      </>
    ),
  },
  {
    q: "O contrato é de 120 meses?",
    a: (
      <>
        Sim. O modelo considera <b>120 meses</b>. O que é pago antes da instalação entra na composição da jornada, com regra clara e acompanhamento.
      </>
    ),
  },
];

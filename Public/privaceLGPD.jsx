// src/pages/Public/PrivacidadeLGPD.jsx
import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, FileText, Mail, Phone, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

export default function PrivaceLGPD() {
  const POLICY_VERSION = "2026-02-15";
  const LAST_UPDATE = "15/02/2026";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">Política de Privacidade (LGPD)</div>
              <div className="text-xs text-slate-500">
                Versão: <span className="font-medium">{POLICY_VERSION}</span> • Atualização:{" "}
                <span className="font-medium">{LAST_UPDATE}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700">Documento público</Badge>
            <Link to="/">
              <Button variant="outline" className="rounded-xl">Voltar</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Intro */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              Visão geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>
              Esta Política de Privacidade descreve como <strong>Sol da Gente</strong> (“nós”) coleta, usa,
              armazena e compartilha seus dados pessoais, conforme a <strong>Lei nº 13.709/2018 (LGPD)</strong>.
            </p>
            <p className="text-sm text-slate-600">
              Ao utilizar nossos serviços e/ou ao aceitar esta política no cadastro, você concorda com as práticas
              descritas aqui, dentro das bases legais previstas na LGPD.
            </p>
          </CardContent>
        </Card>

        {/* Definitions */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>1) Definições importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-slate-700">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Dados pessoais:</strong> informações que identificam ou podem identificar você (ex.: nome, CPF,
                telefone).
              </li>
              <li>
                <strong>Dados pessoais sensíveis:</strong> dados sobre origem racial/étnica, religião, saúde etc.
                (em regra, nós <strong>não</strong> solicitamos esse tipo de dado).
              </li>
              <li>
                <strong>Titular:</strong> você, pessoa a quem os dados se referem.
              </li>
              <li>
                <strong>Controlador:</strong> quem decide sobre o tratamento dos dados (nós).
              </li>
              <li>
                <strong>Operador:</strong> quem trata dados em nosso nome (ex.: provedores de tecnologia).
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Data we collect */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>2) Quais dados coletamos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>Podemos coletar:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Identificação e contato:</strong> nome, CPF, telefone, e-mail.
              </li>
              <li>
                <strong>Endereço:</strong> para avaliação e instalação (rua, número, cidade, estado).
              </li>
              <li>
                <strong>Dados do projeto:</strong> informações necessárias para vistoria, engenharia, instalação e homologação.
              </li>
              <li>
                <strong>Dados financeiros operacionais:</strong> plano, valor de parcela, vencimentos, pagamentos (sem armazenar dados de cartão, se aplicável).
              </li>
              <li>
                <strong>Dados de navegação:</strong> logs técnicos, informações de dispositivo e segurança (quando aplicável).
              </li>
            </ul>
            <p className="text-sm text-slate-600">
              Você pode optar por não fornecer alguns dados, mas isso pode impedir o andamento do processo.
            </p>
          </CardContent>
        </Card>

        {/* Purposes */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>3) Para que usamos seus dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-slate-700">
            <ul className="list-disc pl-5 space-y-2">
              <li>Cadastro, autenticação e gestão do seu perfil.</li>
              <li>Análise e aprovação de documentação.</li>
              <li>Vistoria técnica, engenharia, instalação e acompanhamento do projeto.</li>
              <li>Homologação junto à concessionária (quando aplicável).</li>
              <li>Gestão financeira: geração de parcelas, cobranças, recibos e controle de pagamentos.</li>
              <li>Suporte e comunicação (WhatsApp, e-mail, notificações).</li>
              <li>Segurança, prevenção a fraude e melhoria contínua do serviço.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Legal basis */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>4) Bases legais (LGPD)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>
              Tratamos dados pessoais com base, principalmente, em:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Execução de contrato</strong> e procedimentos preliminares (para viabilizar o kit e o processo).
              </li>
              <li>
                <strong>Cumprimento de obrigação legal/regulatória</strong> (ex.: registros e exigências aplicáveis).
              </li>
              <li>
                <strong>Legítimo interesse</strong> (ex.: segurança, prevenção a fraude, melhoria do serviço).
              </li>
              <li>
                <strong>Consentimento</strong> quando necessário (ex.: comunicações específicas, se aplicável).
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Sharing */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>5) Compartilhamento de dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>Podemos compartilhar dados apenas quando necessário, com:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Prestadores de serviço</strong> (tecnologia, armazenamento, comunicação, suporte).
              </li>
              <li>
                <strong>Equipes técnicas</strong> (vistoria, instalação, engenharia) vinculadas ao processo.
              </li>
              <li>
                <strong>Concessionária</strong> para fins de homologação e procedimentos relacionados (quando aplicável).
              </li>
              <li>
                <strong>Autoridades</strong> mediante obrigação legal ou ordem competente.
              </li>
            </ul>
            <p className="text-sm text-slate-600">
              Não vendemos seus dados pessoais.
            </p>
          </CardContent>
        </Card>

        {/* Storage and retention */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>6) Armazenamento e segurança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>
              Adotamos medidas técnicas e organizacionais de segurança, como controle de acesso, registros e proteção
              contra acesso não autorizado.
            </p>
            <p>
              Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas e obrigações legais,
              e depois os eliminamos ou anonimizamos quando possível.
            </p>
          </CardContent>
        </Card>

        {/* Rights */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>7) Seus direitos como titular</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>Você pode solicitar, nos termos da LGPD:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Confirmação e acesso aos dados.</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
              <li>Anonimização, bloqueio ou eliminação (quando aplicável).</li>
              <li>Portabilidade (quando aplicável).</li>
              <li>Informações sobre compartilhamento.</li>
              <li>Revogação de consentimento (quando o tratamento se basear nele).</li>
            </ul>
            <p className="text-sm text-slate-600">
              Algumas solicitações podem ser limitadas por obrigação legal, segurança ou necessidade contratual.
            </p>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>8) Cookies e logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>
              Podemos usar cookies e logs técnicos para manter sua sessão, melhorar performance e segurança.
              Você pode gerenciar cookies no seu navegador (quando aplicável).
            </p>
          </CardContent>
        </Card>

        {/* Changes */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>9) Mudanças nesta política</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>
              Podemos atualizar esta Política. Quando houver mudanças relevantes, indicaremos a nova versão e data.
            </p>
            <div className="text-sm text-slate-600">
              Versão atual: <strong>{POLICY_VERSION}</strong> • Atualizada em: <strong>{LAST_UPDATE}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Contact / DPO */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>10) Contato do Encarregado (DPO)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-700">
            <p>
              Para exercer seus direitos ou tirar dúvidas sobre privacidade e dados pessoais, entre em contato:
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <Mail className="w-4 h-4" /> E-mail
                </div>
                <div className="text-sm text-slate-600 mt-1">dpo@soldagente.com.br</div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <Phone className="w-4 h-4" /> Telefone/WhatsApp
                </div>
                <div className="text-sm text-slate-600 mt-1">+55 (75) 99230-2620</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/firebaseLogin">
                <Button variant="outline" className="rounded-xl">Entrar</Button>
              </Link>
              <a
                href="https://www.gov.br/anpd/pt-br"
                target="_blank"
                rel="noreferrer"
                className="inline-flex"
              >
                <Button variant="outline" className="rounded-xl">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  ANPD (referência)
                </Button>
              </a>
                <Link to="/">
                    <Button variant="outline" className="rounded-xl">Voltar</Button>
                </Link>
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-slate-500 pb-10">
          Este documento é um modelo operacional para o seu produto e deve ser revisado pelo jurídico conforme a realidade
          da empresa, contratos e fornecedores.
        </div>
      </div>
    </div>
  );
}

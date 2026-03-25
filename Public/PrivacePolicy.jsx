// src/pages/public/PrivacyPolicy.jsx
// (ajuste o caminho conforme seu projeto)

import React, { useMemo } from "react";

/**
 * Política de Privacidade (LGPD) — Sol da Gente
 * Opção A (SPA React): página pública /privacidade
 *
 * ✅ Pronta para salvar como PrivacyPolicy.jsx
 * ✅ Texto em PT-BR
 * ✅ Estrutura clara e “publicável”
 *
 * Dica: mantenha a versão aqui e reaproveite no app (para validar aceite).
 */
const POLICY_VERSION = "2026-02-14"; // 👈 atualize quando mudar o texto
const LAST_UPDATED = "14/02/2026"; // 👈 data humana

export default function PrivacyPolicy() {
  const company = useMemo(
    () => ({
      name: "Sol da Gente",
      email: "privacidade@seudominio.com.br", // 👈 troque
      dpoEmail: "dpo@seudominio.com.br", // 👈 troque (ou repita o e-mail)
      website: "https://seudominio.com.br", // 👈 troque
    }),
    []
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-slate-900">Política de Privacidade (LGPD)</h1>
          <p className="text-slate-600 mt-2">
            Versão <span className="font-semibold">{POLICY_VERSION}</span> • Atualizada em{" "}
            <span className="font-semibold">{LAST_UPDATED}</span>
          </p>
          <p className="text-slate-600 mt-3">
            Esta Política de Privacidade explica como o{" "}
            <span className="font-semibold">{company.name}</span> coleta, usa, armazena e protege
            seus dados pessoais em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de
            Dados — LGPD).
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Destaque */}
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Resumo rápido</h2>
          <ul className="mt-3 list-disc pl-5 text-slate-700 space-y-2">
            <li>
              Coletamos apenas dados necessários para cadastro, execução do serviço, suporte e
              obrigações legais.
            </li>
            <li>
              Você pode solicitar acesso, correção, portabilidade e exclusão (quando aplicável).
            </li>
            <li>
              Aplicamos medidas técnicas e organizacionais para proteger seus dados.
            </li>
          </ul>
        </div>

        {/* 1. Controlador */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">1) Quem somos (Controlador)</h2>
          <p className="text-slate-700 mt-3">
            O <span className="font-semibold">{company.name}</span> atua como <strong>Controlador</strong>{" "}
            dos dados pessoais tratados no âmbito da plataforma, sendo responsável por decidir sobre
            as finalidades e os meios de tratamento, nos termos da LGPD.
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <Info label="Site" value={company.website} />
            <Info label="E-mail (Privacidade)" value={company.email} />
            <Info label="E-mail (DPO/Encarregado)" value={company.dpoEmail} />
            <Info label="Versão da Política" value={POLICY_VERSION} />
          </div>
          <p className="text-xs text-slate-500 mt-3">
            * Substitua os dados de contato acima pelos oficiais da sua operação.
          </p>
        </section>

        {/* 2. Dados coletados */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">2) Quais dados coletamos</h2>
          <p className="text-slate-700 mt-3">
            Podemos coletar os seguintes dados pessoais, conforme necessário para operar o serviço:
          </p>

          <div className="mt-4 grid gap-4">
            <Block
              title="2.1 Dados cadastrais"
              items={[
                "Nome completo",
                "CPF (quando aplicável)",
                "Telefone/WhatsApp",
                "E-mail",
                "Endereço (rua, número, cidade/UF)",
              ]}
            />
            <Block
              title="2.2 Dados do serviço e operação"
              items={[
                "Plano selecionado e condições",
                "Grupo/associação e status do pipeline",
                "Data de vencimento escolhida (dia de vencimento)",
                "Registros de pagamento (valores, vencimentos, status)",
                "Informações técnicas do projeto (quando aplicável)",
              ]}
            />
            <Block
              title="2.3 Dados de uso e logs (quando aplicável)"
              items={[
                "Data/hora de acesso",
                "Informações do dispositivo/navegador (user-agent)",
                "Registros de eventos para segurança e auditoria",
              ]}
            />
            <p className="text-slate-700">
              <strong>Dados sensíveis:</strong> não solicitamos dados pessoais sensíveis (ex.: saúde,
              religião, biometria) para a operação padrão do serviço. Caso seja necessário em
              situação específica, trataremos com base legal adequada e transparência.
            </p>
          </div>
        </section>

        {/* 3. Finalidades */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">3) Para quais finalidades usamos os dados</h2>
          <ul className="mt-3 list-disc pl-5 text-slate-700 space-y-2">
            <li>Permitir seu cadastro e autenticação na plataforma.</li>
            <li>Gerenciar seu plano, grupo, contrato, instalação e homologação.</li>
            <li>Gerar e controlar parcelas, cobranças e registros financeiros.</li>
            <li>Atender solicitações de suporte e comunicação operacional.</li>
            <li>Cumprir obrigações legais, regulatórias e de auditoria.</li>
            <li>Prevenir fraudes e melhorar a segurança do serviço.</li>
          </ul>
        </section>

        {/* 4. Bases legais */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">4) Bases legais (LGPD)</h2>
          <p className="text-slate-700 mt-3">
            Tratamos dados pessoais com base nas hipóteses legais previstas na LGPD, conforme o
            contexto:
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-700 space-y-2">
            <li>
              <strong>Execução de contrato</strong> e procedimentos preliminares (art. 7º, V).
            </li>
            <li>
              <strong>Cumprimento de obrigação legal/regulatória</strong> (art. 7º, II).
            </li>
            <li>
              <strong>Legítimo interesse</strong> do controlador, quando aplicável e com avaliação
              de impactos (art. 7º, IX).
            </li>
            <li>
              <strong>Consentimento</strong>, quando necessário (art. 7º, I) — por exemplo, para
              comunicações específicas.
            </li>
          </ul>
        </section>

        {/* 5. Compartilhamento */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">5) Compartilhamento de dados</h2>
          <p className="text-slate-700 mt-3">
            Podemos compartilhar dados pessoais com terceiros apenas quando necessário para operar
            o serviço, cumprir a lei ou proteger direitos, por exemplo:
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-700 space-y-2">
            <li>Provedores de infraestrutura e hospedagem (ex.: serviços em nuvem).</li>
            <li>Serviços de autenticação, e-mail e comunicação (quando utilizados).</li>
            <li>Parceiros técnicos/operacionais (ex.: equipe técnica para visita/instalação).</li>
            <li>Autoridades públicas, mediante obrigação legal.</li>
          </ul>
          <p className="text-slate-700 mt-3">
            Exigimos que fornecedores adotem medidas de segurança compatíveis e firmamos contratos
            com cláusulas de proteção de dados quando aplicável.
          </p>
        </section>

        {/* 6. Armazenamento e retenção */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">6) Armazenamento e retenção</h2>
          <p className="text-slate-700 mt-3">
            Armazenamos dados em ambientes com controles de segurança. Mantemos os dados pelo tempo
            necessário para as finalidades desta Política e para cumprimento de obrigações legais e
            contratuais. Após o prazo, os dados podem ser excluídos ou anonimizados, salvo hipóteses
            legais de conservação.
          </p>
        </section>

        {/* 7. Segurança */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">7) Segurança da informação</h2>
          <p className="text-slate-700 mt-3">
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo controles
            de acesso, registro de eventos, criptografia em trânsito quando suportado e boas práticas
            de desenvolvimento. Ainda assim, nenhum sistema é 100% imune; em caso de incidente,
            seguiremos procedimentos de resposta e comunicação conforme a LGPD.
          </p>
        </section>

        {/* 8. Direitos do titular */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">8) Seus direitos como titular</h2>
          <p className="text-slate-700 mt-3">
            Você pode solicitar, nos termos da LGPD:
          </p>
          <ul className="mt-3 list-disc pl-5 text-slate-700 space-y-2">
            <li>Confirmação da existência de tratamento.</li>
            <li>Acesso aos dados.</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
            <li>Anonimização, bloqueio ou eliminação (quando aplicável).</li>
            <li>Portabilidade (quando aplicável).</li>
            <li>Informação sobre compartilhamento.</li>
            <li>Revogação de consentimento (quando aplicável).</li>
          </ul>
          <p className="text-slate-700 mt-3">
            Para exercer seus direitos, entre em contato por{" "}
            <strong>{company.email}</strong> (ou DPO: <strong>{company.dpoEmail}</strong>).
          </p>
        </section>

        {/* 9. Cookies (se SPA) */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">9) Cookies e tecnologias similares</h2>
          <p className="text-slate-700 mt-3">
            A plataforma pode utilizar cookies/armazenamento local para manter sua sessão e melhorar a
            experiência. Quando utilizarmos ferramentas adicionais (ex.: analytics), apresentaremos
            transparência e, quando necessário, mecanismos de consentimento.
          </p>
        </section>

        {/* 10. Alterações */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">10) Alterações nesta Política</h2>
          <p className="text-slate-700 mt-3">
            Podemos atualizar esta Política periodicamente. A versão vigente estará sempre disponível
            nesta página. Quando mudanças forem relevantes, poderemos solicitar novo aceite.
          </p>
        </section>

        {/* Footer */}
        <div className="text-xs text-slate-500 text-center py-6">
          © {new Date().getFullYear()} {company.name}. Política de Privacidade — versão {POLICY_VERSION}.
        </div>
      </div>
    </div>
  );
}

/* =========================
   UI helpers
========================= */
function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 border px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 break-words">{value || "—"}</div>
    </div>
  );
}

function Block({ title, items = [] }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="font-semibold text-slate-900">{title}</div>
      <ul className="mt-2 list-disc pl-5 text-slate-700 space-y-1">
        {items.map((t, idx) => (
          <li key={`${title}-${idx}`}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

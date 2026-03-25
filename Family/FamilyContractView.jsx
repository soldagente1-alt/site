import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ArrowLeft, Download, ExternalLink, FileText, Loader2, Printer } from "lucide-react";

const GOV_SIGN_URL = "https://assinador.iti.br/";
const DISABLE_SELECTION = true;
const functions = getFunctions(getApp(), "us-central1");
const registerPrintCallable = httpsCallable(functions, "familyContractRegisterPrint");

const COL_FAMILY = "Family";
const COL_GROUP = "Group";
const COL_PLANS = "Familyplans";
const COL_PAYMENTS = "Payments";

const STAGE_ORDER = [
  "cadastro",
  "plano",
  "visita",
  "grupo",
  "contrato",
  "projeto_eletrico",
  "instalacao",
  "homologacao",
  "ativo",
];

function stageIndex(stage) {
  const s = String(stage || "").trim().toLowerCase();
  const idx = STAGE_ORDER.indexOf(s);
  return idx >= 0 ? idx : -1;
}

function safe(v, fallback = "________________") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function parseMoneyToNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function moneyBRL(v) {
  const n = parseMoneyToNumber(v) ?? 0;
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function toDateAny(ts) {
  if (!ts) return null;
  try {
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.toMillis === "function") return new Date(ts.toMillis());
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function fmtBR(date) {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date);
  } catch {
    try {
      return date.toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  }
}

function fmtBRDate(date) {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date);
  } catch {
    try {
      return date.toLocaleDateString("pt-BR");
    } catch {
      return "—";
    }
  }
}

function addMonths(date, months) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date();
  const m = Number(months || 0);
  if (!Number.isFinite(m) || !m) return d;

  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function endOfDay(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function paymentDocId(familyId, installmentNumber) {
  const n = String(installmentNumber).padStart(4, "0");
  return `${familyId}_${n}`;
}

function formatAddressFromFamily(family) {
  const addr = family?.address || {};
  const parts = [
    addr?.street,
    addr?.number ? `nº ${addr.number}` : "",
    addr?.neighborhood,
    addr?.city ? `${addr.city}/${addr.state || ""}` : "",
    addr?.zip ? `CEP ${addr.zip}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

function statusNormalize(s = "") {
  return String(s || "").trim().toLowerCase();
}

function isRejectedStatus(s) {
  const v = statusNormalize(s);
  return v === "refused" || v === "rejected" || v === "denied";
}

function isValidatedStatus(s) {
  const v = statusNormalize(s);
  return v === "validated" || v === "approved";
}

function isSignedStatus(contract) {
  const v = statusNormalize(contract?.status);
  return v === "signed_uploaded" || !!contract?.signed_storage_path;
}

function contractUiStatus(contract) {
  const st = statusNormalize(contract?.status);

  if (!contract) return "none";
  if (isValidatedStatus(st)) return "validated";
  if (isRejectedStatus(st)) return "refused";
  if (isSignedStatus(contract)) return "signed_uploaded";
  if (!st || st === "pending_signature") return "pending_signature";

  return st;
}

function normalizePagesArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const s = value.trim();
    return s ? [s] : [];
  }
  return [];
}

function extractSnapshotPages(source) {
  if (!source || typeof source !== "object") return [];

  const candidates = [
    source.template_snapshot_pages,
    source.render_snapshot_pages,
    source.snapshot_pages,
    source.body_pages,
    source.contract_pages,
    source.template_snapshot?.body_pages,
    source.template_snapshot?.pages,
    source.render_snapshot?.body_pages,
    source.render_snapshot?.pages,
    source.snapshot?.body_pages,
    source.snapshot?.pages,
  ];

  for (const candidate of candidates) {
    const pages = normalizePagesArray(candidate);
    if (pages.length) return pages;
  }

  return [];
}

async function resolveStoredContractUrl(contract) {
  if (!contract) return null;

  const directUrl = [
    contract?.validated_url,
    contract?.final_url,
    contract?.signed_url,
    contract?.generated_url,
  ]
    .map((v) => String(v || "").trim())
    .find(Boolean);

  if (directUrl) return directUrl;

  const storagePath = [
    contract?.validated_storage_path,
    contract?.final_storage_path,
    contract?.signed_storage_path,
    contract?.generated_storage_path,
  ]
    .map((v) => String(v || "").trim())
    .find(Boolean);

  if (!storagePath) return null;

  return getDownloadURL(storageRef(storage, storagePath));
}

function openUrlInBrowser(url) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const CONTRACT_BODY_SECTIONS_BASE = [
  String.raw`CONTRATO DE ADESÃO AO PROGRAMA SOL DA GENTE
(ENERGIA SOLAR SOCIAL – PARTICIPANTE)

CONTRATADA: Sol da Gente, pessoa jurídica de direito privado, inscrita no CNPJ sob nº [CNPJ], com sede em [ENDEREÇO COMPLETO], neste ato representada por [NOME DO REPRESENTANTE], CPF nº [CPF].

CONTRATANTE (PROPRIETÁRIA DO IMÓVEL): [NOME COMPLETO], CPF nº [CPF], telefone [TELEFONE], e-mail [E-MAIL], residente e domiciliada em [ENDEREÇO COMPLETO].

As partes acima qualificadas têm entre si justo e contratado o presente Contrato de Adesão ao Programa Sol da Gente (“Contrato”), mediante as cláusulas e condições a seguir:

CLÁUSULA 1 – DEFINIÇÕES
• “Programa” ou “Programa Sol da Gente”: iniciativa de energia solar social operada pela CONTRATADA, que inclui avaliação técnica, implantação do Kit Solar conforme plano, manutenção preventiva básica e suporte, nos termos deste Contrato.
• “Plano”: modalidade escolhida pela CONTRATANTE, com contribuição mensal, características técnicas e serviços descritos no ANEXO I.
• “Kit Solar”: conjunto de equipamentos (módulos, inversor, estrutura, proteções e demais itens) especificados no ANEXO I, instalados no imóvel da CONTRATANTE.
• “Aceite Digital”: manifestação inequívoca de concordância com este Contrato por assinatura eletrônica, aceite em aplicativo, ou confirmação por meio digital definido pela CONTRATADA.
• “Inadimplência”: atraso de pagamento sem pedido formal de cancelamento.
• “Desistência”: cancelamento solicitado expressamente pela CONTRATANTE por escrito/digital.
• “Distribuidora”: concessionária responsável pela rede de energia e procedimentos de acesso/homologação, quando aplicável.`,

  String.raw`CLÁUSULA 2 – DAS PARTES, DO OBJETO E DA ADESÃO
2.1. O presente Contrato tem por objeto a adesão da CONTRATANTE ao Programa, para implantação de solução de energia solar social no imóvel indicado, mediante contribuição mensal, avaliação técnica, instalação do Kit Solar e suporte conforme este Contrato e o ANEXO I.
2.2. O Plano escolhido, o Valor de Referência do Kit Solar, os serviços inclusos e itens não inclusos constam do ANEXO I, parte integrante e vinculante deste Contrato.
2.3. A CONTRATANTE declara, sob as penas da lei, ser PROPRIETÁRIA do imóvel onde será realizada a instalação, localizado em [ENDEREÇO DO IMÓVEL], e que possui legitimidade para contratar a implantação do Kit Solar. Não é permitida contratação por locatário/ocupante. A CONTRATADA poderá solicitar documentos comprobatórios de titularidade.
2.4. A adesão e o início das etapas operacionais (vistoria, projeto, compra/reserva de equipamentos, instalação e/ou homologação) poderão ocorrer após Aceite Digital e/ou assinatura deste Contrato e do ANEXO I.

CLÁUSULA 3 – TRANSPARÊNCIA, ECONOMIA E NÃO PROMESSA ABSOLUTA
3.1. A CONTRATANTE declara ciência de que a economia na conta de energia varia conforme hábitos de consumo, equipamentos utilizados, incidência solar, condições do imóvel, condições da rede, regras da Distribuidora e uso correto do sistema.
3.2. A CONTRATADA não garante “conta zero” em todos os casos, comprometendo-se a entregar e instalar o Kit Solar conforme especificação do Plano e orientar o uso eficiente, dentro das boas práticas técnicas.

CLÁUSULA 4 – PRAZO E VIGÊNCIA
4.1. Este Contrato terá vigência de [PRAZO_MESES] (meses), contados a partir da assinatura/aceite digital.
4.2. O início efetivo das etapas técnicas e operacionais poderá depender de análise de viabilidade e documentos (Cláusula 8), sem que isso altere a vigência pactuada, salvo se houver reprogramação formal entre as partes.`,

  String.raw`CLÁUSULA 5 – CONTRIBUIÇÃO, FORMA DE PAGAMENTO E ENCARGOS
5.1. A CONTRATANTE pagará a contribuição mensal do Plano descrito no ANEXO I, no valor de [VALOR_MENSAL], por meio de (i) BOLETO ou (ii) PIX, com vencimento no dia [DIA] de cada mês, salvo ajuste informado no ANEXO I.
5.2. O não recebimento do boleto/QR Code não isenta o pagamento. A CONTRATANTE deverá solicitar 2ª via pelos canais oficiais.
5.3. Em caso de atraso, poderá incidir multa de 2% (dois por cento), juros de 1% (um por cento) ao mês e correção monetária, conforme permitido em lei.
5.4. A CONTRATANTE autoriza a CONTRATADA a emitir cobranças mensais e enviar comunicações relativas a pagamento e execução contratual pelos canais definidos neste Contrato.

CLÁUSULA 6 – NOTIFICAÇÕES, ATRASOS, DESISTÊNCIA E INADIMPLÊNCIA
6.1. Notificação 1 (cobrança amigável): com 10 (dez) dias de atraso, a CONTRATADA poderá enviar 1ª notificação por WhatsApp/e-mail/aplicativo, concedendo 7 (sete) dias para regularização.
6.2. Notificação 2 (constituição em mora): com 30 (trinta) dias de atraso, a CONTRATADA enviará 2ª notificação, concedendo 7 (sete) dias finais para pagamento e informando consequências contratuais.
6.3. Atraso superior a 60 (sessenta) dias poderá ensejar suspensão de benefícios/serviços não emergenciais, sem prejuízo da cobrança.`,

  String.raw`6.4. Atraso superior a 90 (noventa) dias, após as notificações, poderá caracterizar INADIMPLÊNCIA GRAVE, autorizando rescisão do Contrato e retirada do Kit Solar quando instalado e tecnicamente possível, sem reembolso automático, observado o regramento de cancelamento desta contratação (Cláusula 12).
6.5. Desistência: considera-se DESISTÊNCIA quando a CONTRATANTE solicitar cancelamento por escrito/digital. Inadimplência: considera-se INADIMPLÊNCIA quando houver atraso sem pedido formal de cancelamento. Os efeitos e valores aplicáveis seguem a Cláusula 12.
6.6. A CONTRATANTE compromete-se a permitir o acesso da equipe técnica ao imóvel em data previamente agendada para ações necessárias (manutenção/retirada), sob pena de adoção das medidas cabíveis e cobrança de deslocamentos frustrados, quando aplicável.

CLÁUSULA 7 – INSTALAÇÃO, ACESSO AO IMÓVEL E SEGURANÇA
7.1. A instalação ocorrerá conforme agenda operacional da CONTRATADA, respeitando critérios técnicos, segurança elétrica, disponibilidade de equipamentos e condições climáticas.
7.2. A CONTRATANTE deverá garantir acesso ao imóvel, inclusive ao padrão/quadros elétricos, e disponibilizar responsável maior de idade no local durante a execução.
7.3. Se houver riscos à segurança (ex.: estrutura comprometida, rede elétrica irregular, animais soltos, acesso inseguro), a CONTRATADA poderá suspender a execução até a regularização, sem caracterizar descumprimento.
7.4. Intervenções e adequações elétricas/estruturais não previstas no ANEXO I, quando necessárias, serão de responsabilidade da CONTRATANTE, salvo contratação específica e formal por aditivo.

CLÁUSULA 8 – VIABILIDADE TÉCNICA E DOCUMENTAÇÃO (CONDIÇÃO PARA IMPLANTAÇÃO)
8.1. A implantação do Kit Solar depende de vistoria técnica e viabilidade elétrica/estrutural do imóvel, além de documentos e informações necessárias para o procedimento junto à Distribuidora, quando aplicável.
8.2. Caso seja identificada inviabilidade técnica ou documental, a CONTRATADA poderá: (i) propor adequações (custos da CONTRATANTE), (ii) oferecer migração de plano, ou (iii) rescindir sem instalação, aplicando-se a política de cancelamento por fase (Cláusula 12).`,

  String.raw`CLÁUSULA 9 – USO CORRETO, GARANTIAS E RESPONSABILIDADES
9.1. A CONTRATANTE compromete-se a não realizar alterações no sistema, não permitir intervenção de terceiros não autorizados e utilizar o Kit Solar conforme orientações técnicas fornecidas.
9.2. Garantias: (i) a garantia dos equipamentos segue os termos do fabricante; (ii) a garantia de instalação/serviço, quando aplicável, seguirá o prazo de [PRAZO_MESES] meses contado do aceite da instalação, cobrindo defeitos de execução e conexões feitas pela CONTRATADA, excluídos mau uso, eventos de força maior, surtos externos e intervenções de terceiros.
9.3. O uso indevido, intervenção de terceiros, violação de componentes, alteração de configuração e descumprimento de orientações podem acarretar perda de garantia e riscos elétricos, eximindo a CONTRATADA de responsabilidade.
9.4. A CONTRATANTE é responsável por manter o imóvel em condições adequadas (telhado/estrutura, aterramento e padrão elétrico regular), incluindo adequações necessárias apontadas em vistoria, quando não inclusas no ANEXO I.

CLÁUSULA 10 – MANUTENÇÃO E SUPORTE
10.1. A CONTRATADA prestará manutenção preventiva básica conforme o Plano contratado, de acordo com periodicidade e critérios operacionais.
10.2. Chamados corretivos decorrentes de mau uso, intervenções de terceiros, danos ao equipamento, sinistros e adequações elétricas necessárias poderão ser cobrados à parte, mediante orçamento.
10.3. A CONTRATADA poderá suspender atendimentos não emergenciais em caso de inadimplência, conforme Cláusula 6, sem prejuízo da continuidade de medidas de segurança quando necessárias.

CLÁUSULA 11 – PROPRIEDADE DO SISTEMA E AQUISIÇÃO AO FINAL DA VIGÊNCIA
11.1. Durante a vigência deste Contrato, o Kit Solar permanece como ativo de propriedade da CONTRATADA.
11.2. Ao término da vigência, estando a CONTRATANTE adimplente, poderá requerer a aquisição definitiva do Kit Solar mediante pagamento de valor simbólico equivalente a 6 (seis) parcelas do Plano vigente da CONTRATANTE à época do requerimento, quitadas à vista ou conforme forma de pagamento acordada. Após quitação, a CONTRATADA emitirá termo de transferência.
11.3. A transferência não prorroga garantias do fabricante, que seguem seus prazos e condições próprias.`,

  String.raw`CLÁUSULA 12 – CANCELAMENTO, DESISTÊNCIA, INADIMPLÊNCIA E REEMBOLSOS
12.1. Forma válida: o cancelamento/desistência somente será considerado válido mediante solicitação enviada pela CONTRATANTE aos canais oficiais (WhatsApp/e-mail/aplicativo), contendo nome e CPF. A data do cancelamento será a do protocolo/registro do envio.
12.2. As retenções e reembolsos seguem a fase do processo e custos incorridos, conforme itens abaixo:
12.2.1. Cancelamento antes da vistoria técnica: retenção administrativa de R$ 200,00. Havendo valores pagos além da retenção, o saldo será reembolsado em até 15 dias úteis via PIX.
12.2.2. Cancelamento após vistoria e/ou projeto e antes de compra/reserva/logística do kit: retenção fixa de R$ 700,00, correspondente a custos técnicos de vistoria e projeto, além de custos adicionais comprovadamente incorridos e previamente autorizados. Havendo valores pagos além da retenção, o saldo será reembolsado em até 15 dias úteis via PIX.
12.2.3. Cancelamento após compra/reserva do Kit Solar e/ou início de logística, e antes da instalação: retenção equivalente a 20% do Valor de Referência do Kit Solar (definido no ANEXO I), limitada ao teto de 6 (seis) parcelas do Plano (o que for menor), podendo ser acrescidos fretes efetivamente contratados e não reembolsáveis, quando comprovados.
12.2.4. Cancelamento após instalação (desistência pós-instalação): as parcelas já pagas não são reembolsáveis. A retirada do Kit Solar, quando solicitada por desistência, ficará condicionada ao pagamento de taxa fixa de R$ 800,00, destinada a cobrir desinstalação, logística e equipe técnica. Danos, peças faltantes ou avarias decorrentes de mau uso/intervenção de terceiros serão cobrados à parte, mediante orçamento e comprovação.
12.3. Inviabilidade técnica ou documental: (i) se não imputável à CONTRATANTE, as partes poderão migrar o Plano; não sendo possível, aplica-se cancelamento por fase, sem multa adicional; (ii) se imputável à CONTRATANTE (pendências do imóvel/documentos sob sua responsabilidade), aplica-se o cancelamento conforme a fase (12.2.2 ou 12.2.3).`,

  String.raw`12.4. Inadimplência grave: ultrapassados 90 dias de atraso, após as notificações da Cláusula 6, a CONTRATADA poderá rescindir o Contrato, promover a retirada do Kit quando instalado e tecnicamente possível, e cobrar valores em aberto e encargos legais, sem reembolso automático.
12.5. Direito de arrependimento: quando a adesão ocorrer por meio remoto, a CONTRATANTE poderá exercer arrependimento em até 7 dias, nos termos da legislação. Caso a CONTRATANTE solicite início imediato de serviços (vistoria/projeto) dentro desse prazo e depois se arrependa, poderá ser aplicada retenção de custos incorridos nos limites desta cláusula.
12.6. Reembolso: quando houver saldo a reembolsar, será realizado via PIX em até 15 dias úteis após apuração de valores e deduções aplicáveis.

CLÁUSULA 13 – LIMITAÇÃO DE RESPONSABILIDADE E FORÇA MAIOR
13.1. A CONTRATADA não se responsabiliza por: (i) variações tarifárias, alterações regulatórias, falhas/interrupções da rede da Distribuidora; (ii) eventos de caso fortuito/força maior (chuvas intensas, tempestades, descargas atmosféricas, greves, atos de terceiros, falta de materiais); (iii) mau uso, intervenções de terceiros, ou inadequações elétricas/estruturais não executadas pela CONTRATADA.
13.2. As partes concordam que não serão devidos lucros cessantes e/ou danos indiretos, exceto em caso de dolo ou culpa grave comprovada, observada a legislação aplicável.
13.3. Na ocorrência de força maior, prazos e obrigações afetados ficarão suspensos enquanto perdurar o evento.

CLÁUSULA 14 – PROTEÇÃO DE DADOS (LGPD)
14.1. A CONTRATADA tratará os dados pessoais da CONTRATANTE para fins de execução deste Contrato, cobrança, suporte, atendimento, segurança e, quando aplicável, procedimentos junto à Distribuidora e parceiros técnicos.
14.2. Os dados poderão ser compartilhados com prestadores de serviço estritamente necessários (instaladores, suporte, cobrança, parceiros técnicos), observados deveres de confidencialidade e segurança.
14.3. A CONTRATANTE poderá exercer seus direitos como titular (acesso, correção, revogação de consentimento quando aplicável) mediante contato em canal oficial de atendimento da CONTRATADA.
14.4. Os dados serão retidos pelo período necessário ao cumprimento de obrigações legais/contratuais.`,

  String.raw`CLÁUSULA 15 – COMUNICAÇÕES, INTEGRIDADE E ADITIVOS
15.1. As comunicações oficiais poderão ocorrer por WhatsApp, e-mail e/ou aplicativo informados pela CONTRATANTE. A CONTRATANTE compromete-se a manter seus dados atualizados.
15.2. Este Contrato e seus anexos representam o acordo integral entre as partes. Qualquer alteração de Plano, escopo, valores ou condições somente terá validade mediante aditivo escrito/digital.
15.3. A nulidade de alguma disposição não afetará as demais, que permanecerão válidas.

CLÁUSULA 16 – TRANSFERÊNCIA DE TITULARIDADE (IMÓVEL) E CESSÃO
16.1. A CONTRATANTE poderá solicitar transferência deste Contrato para novo proprietário do imóvel, mediante análise cadastral e aceite do novo titular, podendo haver taxa administrativa de transferência, se prevista pela CONTRATADA.
16.2. A CONTRATADA poderá ceder ou transferir direitos de recebíveis a terceiros (ex.: instituição financeira), sem prejuízo do cumprimento das obrigações do Programa, mediante comunicação à CONTRATANTE.

CLÁUSULA 17 – RESPONSABILIDADE SOLIDÁRIA
A CONTRATADA poderá exigir a indicação de um segundo responsável solidário residente no imóvel (cônjuge, companheiro(a) ou parente direto), que responderá conjuntamente pelas obrigações financeiras e contratuais enquanto perdurar a vigência deste Contrato.

CLÁUSULA 18 – VÍNCULO FUNCIONAL DO EQUIPAMENTO AO IMÓVEL
O Kit Solar permanecerá funcionalmente vinculado ao imóvel indicado neste Contrato durante toda a vigência, não podendo ser removido, transferido ou alterado sem autorização expressa da CONTRATADA, sendo considerado parte integrante da funcionalidade elétrica do imóvel enquanto vigente este instrumento.`,

  String.raw`CLÁUSULA 19 – COMUNICAÇÃO DE MUDANÇA DE IMÓVEL
A comunicação de venda, locação ou transferência de titularidade do imóvel deverá ocorrer com antecedência mínima de 30 (trinta) dias, permanecendo o titular original responsável pelas obrigações contratuais até a formalização da transferência aceita pela CONTRATADA.

CLÁUSULA 20 – RETIRADA DO EQUIPAMENTO POR ABANDONO
Em caso de abandono contratual ou inadimplência grave superior a 90 dias, a CONTRATADA poderá promover a retirada do Kit Solar mediante agendamento técnico e, quando necessário, autorização judicial, obrigando-se a CONTRATANTE a permitir o acesso ao imóvel.

CLÁUSULA 21 – ATRASO RECORRENTE
O atraso recorrente superior a 3 (três) ocorrências dentro de um período de 12 (doze) meses poderá ensejar revisão de forma de pagamento, exigência de garantia adicional ou migração obrigatória para modalidade de cobrança automática.

CLÁUSULA 22 – SEGURO E COMUNICAÇÃO DE DANOS
A CONTRATANTE compromete-se a comunicar imediatamente qualquer ocorrência de furto, roubo, vandalismo, incêndio ou dano ao Kit Solar. Recomenda-se a contratação de seguro residencial que contemple o sistema solar.

CLÁUSULA 23 – FALECIMENTO DO TITULAR
Em caso de falecimento da CONTRATANTE, os herdeiros ou residentes poderão solicitar a transferência do contrato no prazo de até 90 (noventa) dias, mantendo-se as condições vigentes. Na ausência de manifestação, poderá ocorrer cancelamento conforme fase contratual.

CLÁUSULA 24 – COBRANÇA AUTOMÁTICA
A CONTRATADA poderá disponibilizar modalidade de cobrança automática recorrente via PIX ou débito, mediante autorização expressa da CONTRATANTE.

CLÁUSULA 25 – FORO
Fica eleito o foro do domicílio da CONTRATANTE, observada a legislação aplicável, para dirimir dúvidas oriundas deste Contrato.

E, por estarem de acordo, as partes aceitam/assinam digitalmente o presente Contrato.`,
];

function replaceAllLiteral(text, needle, replacement) {
  if (!needle) return text;
  return String(text).split(needle).join(replacement);
}

function fillContractadaBlock(pageText, contractor) {
  const pattern = /CONTRATADA:[\s\S]*?\n\nCONTRATANTE \(PROPRIETÁRIA DO IMÓVEL\):/;

  const companyName = safe(contractor?.companyName);
  const cnpj = safe(contractor?.cnpj);
  const address = safe(contractor?.address);
  const responsibleName = safe(contractor?.responsibleName);
  const responsibleCpf = safe(contractor?.responsibleCpf);

  const contractadaLine =
    `CONTRATADA: ${companyName}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${cnpj}, com sede em ${address}, neste ato representada por ${responsibleName}, CPF nº ${responsibleCpf}.\n\n` +
    `CONTRATANTE (PROPRIETÁRIA DO IMÓVEL):`;

  if (!pattern.test(pageText)) return pageText;
  return pageText.replace(pattern, contractadaLine);
}

function fillContractanteBlock(pageText, filled) {
  const pattern = /CONTRATANTE \(PROPRIETÁRIA DO IMÓVEL\):[\s\S]*?\[ENDEREÇO COMPLETO\]\./;

  const replacement =
    `CONTRATANTE (PROPRIETÁRIA DO IMÓVEL): ${filled.nome}, CPF nº ${filled.cpf}, telefone ${filled.telefone}, e-mail ${filled.email}, residente e domiciliada em ${filled.enderecoCompleto}.`;

  if (!pattern.test(pageText)) return pageText;
  return pageText.replace(pattern, replacement);
}

function applyFill(pageText, filled, contractor, extra) {
  let t = String(pageText || "");

  if (t.includes("CONTRATADA:")) t = fillContractadaBlock(t, contractor);
  if (t.includes("CONTRATANTE (PROPRIETÁRIA DO IMÓVEL):")) {
    t = fillContractanteBlock(t, filled);
  }

  if (filled.enderecoImovel && t.includes("[ENDEREÇO DO IMÓVEL]")) {
    t = replaceAllLiteral(t, "[ENDEREÇO DO IMÓVEL]", filled.enderecoImovel);
  }

  if (filled.diaVencimento && t.includes("[DIA]")) {
    t = replaceAllLiteral(t, "[DIA]", String(filled.diaVencimento));
  }

  const pairs = [
    ["[PRAZO_MESES]", extra?.prazoMeses],
    ["[VALOR_MENSAL]", extra?.valorMensal],
    ["[PLANO_NOME]", extra?.planoNome],
    ["[DATA_INICIO]", extra?.dataInicio],
    ["[DATA_FIM]", extra?.dataFim],
    ["[VENCIMENTO_ENTRADA]", extra?.vencimentoEntrada],
  ];

  pairs.forEach(([token, value]) => {
    if (value && t.includes(token)) {
      t = replaceAllLiteral(t, token, String(value));
    }
  });

  return t;
}

function normalizeSpaces(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function parsePageToBlocks(pageText) {
  const lines = String(pageText || "").replace(/\r/g, "").split("\n");

  const blocks = [];
  let para = [];
  let list = [];

  const flushPara = () => {
    const t = normalizeSpaces(para.join(" "));
    if (t) blocks.push({ type: "p", text: t });
    para = [];
  };

  const flushList = () => {
    if (list.length) blocks.push({ type: "ul", items: list.slice() });
    list = [];
  };

  const pushHeading = (level, text) => {
    flushPara();
    flushList();
    blocks.push({ type: level, text: normalizeSpaces(text) });
  };

  for (let raw of lines) {
    const line = String(raw || "").trim();

    if (!line) {
      flushPara();
      flushList();
      continue;
    }

    if (line === "CONTRATO DE ADESÃO AO PROGRAMA SOL DA GENTE") {
      pushHeading("h1", line);
      continue;
    }

    if (line.startsWith("(ENERGIA SOLAR SOCIAL")) {
      pushHeading("h2", line);
      continue;
    }

    if (line.startsWith("CLÁUSULA ")) {
      pushHeading("h3", line);
      continue;
    }

    if (line.startsWith("•")) {
      flushPara();
      list.push(normalizeSpaces(line.replace(/^•\s*/, "")));
      continue;
    }

    if (/^\d+(?:\.\d+)+\./.test(line)) {
      flushList();
      flushPara();
      para.push(line);
      continue;
    }

    if (line.startsWith("CONTRATADA:") || line.startsWith("CONTRATANTE ")) {
      flushList();
      flushPara();
      blocks.push({ type: "p-strong", text: normalizeSpaces(line) });
      continue;
    }

    para.push(line);
  }

  flushPara();
  flushList();
  return blocks;
}

const BODY_PAGE_UNITS = 82;

function estimateBlockUnits(block) {
  if (!block) return 0;

  if (block.type === "h1") return 6;
  if (block.type === "h2") return 4;
  if (block.type === "h3") return 4;

  if (block.type === "ul") {
    const items = Array.isArray(block.items) ? block.items : [];
    return 2 + items.reduce((acc, item) => acc + 1 + Math.ceil(String(item || "").length / 220), 0);
  }

  const text = String(block.text || "");
  return 2 + Math.ceil(text.length / 255);
}

function paginateBlocks(blocks, maxUnitsPerPage = 75) {
  const safeBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  const pages = [];

  let current = [];
  let units = 0;

  for (let i = 0; i < safeBlocks.length; i += 1) {
    const block = safeBlocks[i];
    const nextUnits = estimateBlockUnits(block);
    const nextBlock = safeBlocks[i + 1] || null;
    const nextBlockUnits = estimateBlockUnits(nextBlock);
    const isHeading = ["h1", "h2", "h3"].includes(block?.type);

    if (isHeading && current.length && nextBlock && units + nextUnits + nextBlockUnits > maxUnitsPerPage) {
      pages.push(current);
      current = [];
      units = 0;
    }

    if (current.length && units + nextUnits > maxUnitsPerPage) {
      pages.push(current);
      current = [block];
      units = nextUnits;
      continue;
    }

    current.push(block);
    units += nextUnits;
  }

  if (current.length) pages.push(current);
  return pages;
}

function SummaryRow({ label, value }) {
  return (
    <div className="summaryRow">
      <div className="summaryLabel">{label}</div>
      <div className="summaryValue">{value || "—"}</div>
    </div>
  );
}

export default function FamilyContractView() {
  const { contractId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);

  const [family, setFamily] = useState(null);
  const [contract, setContract] = useState(null);
  const [contractor, setContractor] = useState(null);

  const [plan, setPlan] = useState(null);
  const [group, setGroup] = useState(null);
  const [payment1, setPayment1] = useState(null);

  const [agree, setAgree] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);
  const [downloadingStored, setDownloadingStored] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    return onSnapshot(
      doc(db, COL_FAMILY, user.uid),
      (snap) => setFamily(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (e) => {
        console.error(e);
        toast.error("Erro ao carregar dados da família.");
      }
    );
  }, [user]);

  useEffect(() => {
    if (!user || !contractId) return undefined;

    const ref = doc(db, "FamilyContracts", contractId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setContract(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() };

        if (data.family_id && data.family_id !== user.uid) {
          toast.error("Acesso negado a este contrato.");
          setContract(null);
          return;
        }

        setContract(data);
      },
      (err) => {
        console.error(err);
        toast.error("Erro ao carregar contrato.");
      }
    );

    return () => unsub();
  }, [user, contractId]);

  useEffect(() => {
    const ref = doc(db, "ContractorProfile", "primary");
    const unsub = onSnapshot(
      ref,
      (snap) => setContractor(snap.exists() ? snap.data() : null),
      () => setContractor(null)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const planId = String(family?.plan_id || family?.planId || family?.plan?.id || "").trim();
      if (!planId) {
        setPlan(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, COL_PLANS, planId));
        if (!cancelled) setPlan(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.warn("Falha ao carregar plano:", e);
        if (!cancelled) setPlan(null);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [family?.plan_id, family?.planId, family?.plan?.id]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const gid = String(family?.group_id || family?.open_group_id || family?.groupId || "").trim();
      if (!gid) {
        setGroup(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, COL_GROUP, gid));
        if (!cancelled) setGroup(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.warn("Falha ao carregar grupo:", e);
        if (!cancelled) setGroup(null);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [family?.group_id, family?.open_group_id, family?.groupId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user?.uid) return;
      try {
        const pid = paymentDocId(user.uid, 1);
        const snap = await getDoc(doc(db, COL_PAYMENTS, pid));
        if (!cancelled) setPayment1(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.warn("Falha ao carregar pagamento 1:", e);
        if (!cancelled) setPayment1(null);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const versionLabel = useMemo(() => {
    return contract?.template_version || contract?.view_version || "v9.1";
  }, [contract]);

  const printedAtDate = useMemo(() => toDateAny(contract?.printed_at), [contract?.printed_at]);
  const printedAtText = useMemo(() => fmtBR(printedAtDate), [printedAtDate]);

  const uiStatus = useMemo(() => contractUiStatus(contract), [contract]);
  const validated = uiStatus === "validated";
  const awaitingApproval = uiStatus === "signed_uploaded";
  const refused = uiStatus === "refused";
  const canPrintFromView = !validated && !awaitingApproval;

  const planName = useMemo(() => {
    const candidates = [
      plan?.name,
      plan?.title,
      plan?.label,
      family?.plan_name,
      family?.plan_title,
      group?.plan_name,
      group?.plan_title,
      plan?.id,
      family?.plan_id,
    ];
    const picked = candidates.map((x) => String(x || "").trim()).find(Boolean);
    return picked || "Plano";
  }, [plan, family, group]);

  const termMonths = useMemo(() => {
    const candidates = [
      plan?.number_of_installments,
      plan?.installments,
      plan?.term_months,
      plan?.duration_months,
      family?.total_installments,
      group?.plan_installments,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return 120;
  }, [plan, family, group]);

  const monthlyAmount = useMemo(() => {
    const candidates = [
      plan?.monthly_payment,
      plan?.monthly_price,
      plan?.plan_monthly_price,
      plan?.price,
      plan?.value,
      family?.monthly_payment,
      family?.plan_monthly_price,
      group?.plan_monthly_price,
    ];
    for (const c of candidates) {
      const n = parseMoneyToNumber(c);
      if (n !== null && n > 0) return n;
    }
    return null;
  }, [plan, family, group]);

  const dueDay = useMemo(() => {
    const candidates = [
      family?.billing_day,
      family?.due_day,
      family?.billingDay,
      family?.dueDay,
      family?.plan?.billingDay,
      family?.plan?.dueDay,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n >= 1 && n <= 31) return Math.floor(n);
    }
    return null;
  }, [family]);

  const contractStartDate = useMemo(() => {
    const gAct = toDateAny(group?.activated_at);
    const pAt = printedAtDate;
    return gAct || pAt || new Date();
  }, [group?.activated_at, printedAtDate]);

  const contractEndDate = useMemo(() => addMonths(contractStartDate, termMonths), [contractStartDate, termMonths]);

  const activationDeadline = useMemo(() => {
    const famDeadline = toDateAny(family?.contract_window_deadline_at);
    if (famDeadline) return famDeadline;

    const grpDeadline = toDateAny(group?.activation_deadline_at);
    if (grpDeadline) return grpDeadline;

    const base = contractStartDate || new Date();
    const plus48 = new Date(base.getTime() + 48 * 60 * 60 * 1000);
    return endOfDay(plus48);
  }, [family?.contract_window_deadline_at, group?.activation_deadline_at, contractStartDate]);

  const activationDeadlineText = useMemo(() => fmtBR(activationDeadline), [activationDeadline]);

  const payment1DueDate = useMemo(() => {
    const d = payment1?.due_date;
    const dt = toDateAny(d);
    if (dt) return dt;

    try {
      const s = String(d || "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, da] = s.split("-").map((x) => Number(x));
        const dd = new Date(y, m - 1, da, 23, 59, 59, 999);
        return Number.isNaN(dd.getTime()) ? null : dd;
      }
    } catch {
      return null;
    }

    return null;
  }, [payment1?.due_date]);

  const filled = useMemo(() => {
    const f = family || {};
    const enderecoCompleto = formatAddressFromFamily(f) || "";
    const enderecoImovel =
      f?.installation_address ||
      f?.installationAddress ||
      f?.address_installation ||
      enderecoCompleto ||
      "";

    return {
      nome: safe(f?.full_name || f?.name),
      cpf: safe(f?.cpf),
      telefone: safe(f?.phone),
      email: safe(f?.email),
      enderecoCompleto: safe(enderecoCompleto),
      enderecoImovel: safe(enderecoImovel),
      diaVencimento: dueDay ? String(dueDay) : "—",
    };
  }, [family, dueDay]);

  const firstInstallmentText = useMemo(() => {
    return payment1DueDate ? fmtBR(payment1DueDate) : activationDeadlineText;
  }, [payment1DueDate, activationDeadlineText]);

  const extra = useMemo(() => {
    return {
      planoNome: planName,
      prazoMeses: String(termMonths || 120),
      valorMensal: monthlyAmount ? moneyBRL(monthlyAmount) : "—",
      dataInicio: fmtBRDate(contractStartDate),
      dataFim: fmtBRDate(contractEndDate),
      vencimentoEntrada: firstInstallmentText,
    };
  }, [
    planName,
    termMonths,
    monthlyAmount,
    contractStartDate,
    contractEndDate,
    firstInstallmentText,
  ]);

  const contractSourceSections = useMemo(() => {
    const fromSnapshot = extractSnapshotPages(contract);
    return fromSnapshot.length ? fromSnapshot : CONTRACT_BODY_SECTIONS_BASE;
  }, [contract]);

  const bodyPagesFilled = useMemo(() => {
    const allBlocks = contractSourceSections
      .map((sectionText) => applyFill(sectionText, filled, contractor, extra))
      .flatMap((sectionText) => parsePageToBlocks(sectionText));

    return paginateBlocks(allBlocks, BODY_PAGE_UNITS).filter((pageBlocks) => pageBlocks.length > 0);
  }, [contractSourceSections, filled, contractor, extra]);

  const totalPages = bodyPagesFilled.length + 2;

  const annexIncludedItems = useMemo(() => {
    return [
      "Avaliação técnica e vistoria de viabilidade do imóvel.",
      `Implantação do Kit Solar conforme o plano ${planName}.`,
      "Suporte operacional e manutenção preventiva básica, conforme regras do plano.",
      "Cobrança mensal por boleto ou PIX, com comunicação pelos canais oficiais.",
    ];
  }, [planName]);

  const annexExcludedItems = useMemo(() => {
    return [
      "Adequações elétricas, estruturais ou civis não previstas expressamente no plano.",
      "Correções decorrentes de mau uso, intervenção de terceiros ou dano externo ao sistema.",
      "Custos extraordinários fora do escopo contratual ou sem aditivo formal.",
      "Garantias adicionais além daquelas previstas pelo fabricante e pelo contrato.",
    ];
  }, []);

  const cancellationMatrix = useMemo(() => {
    return [
      {
        phase: "Antes da vistoria técnica",
        rule: "Retenção administrativa de R$ 200,00; saldo, se houver, reembolsado via PIX em até 15 dias úteis.",
      },
      {
        phase: "Após vistoria/projeto e antes da compra/logística",
        rule: "Retenção fixa de R$ 700,00, além de custos adicionais previamente autorizados e comprovados.",
      },
      {
        phase: "Após compra/reserva/logística e antes da instalação",
        rule: "Retenção de 20% do valor de referência do kit, limitada a 6 parcelas do plano, com acréscimo de fretes não reembolsáveis comprovados.",
      },
      {
        phase: "Após instalação",
        rule: "Parcelas pagas não são reembolsáveis; retirada condicionada à taxa de R$ 800,00, sem prejuízo de cobrança por danos ou peças faltantes.",
      },
    ];
  }, []);

  useEffect(() => {
    if (!printRequested) return;
    if (!contract?.printed_at) return;
    if (!canPrintFromView) return;

    const t = setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 350);

    return () => clearTimeout(t);
  }, [printRequested, contract?.printed_at, canPrintFromView]);

  async function handleDownloadStoredContract() {
    if (downloadingStored) return;

    setDownloadingStored(true);
    try {
      const storedUrl = await resolveStoredContractUrl(contract);

      if (!storedUrl) {
        toast.error("Não encontrei um arquivo salvo para este contrato.");
        return;
      }

      openUrlInBrowser(storedUrl);
      toast.success("Abrindo o arquivo salvo do contrato.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao baixar o contrato salvo.");
    } finally {
      setDownloadingStored(false);
    }
  }

  async function handleAgreeAndPrint() {
    if (!contract) return toast.error("Contrato inválido.");

    if (validated) {
      await handleDownloadStoredContract();
      return;
    }

    if (awaitingApproval) {
      toast.message("Este contrato já foi enviado e está aguardando aprovação.");
      return;
    }

    if (!agree) return toast.error("Marque a caixa de concordância para imprimir.");
    if (!user) return toast.error("Faça login novamente.");
    if (!contractId) return toast.error("Contrato inválido.");

    setPrinting(true);
    try {
      const result = await registerPrintCallable({ contractId });
      const payload = result?.data || {};

      if (payload?.ok === false) {
        if (payload?.code === "ALREADY_VALIDATED") {
          await handleDownloadStoredContract();
          return;
        }
        toast.message(payload?.message || "Este contrato não pode mais ser impresso.");
        return;
      }

      toast.success("Abrindo impressão… selecione Salvar como PDF.");
      setPrintRequested(true);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar/imprimir o contrato.");
    } finally {
      setPrinting(false);
    }
  }

  if (!authReady) return <div className="p-6">Carregando…</div>;
  if (!user) return <div className="p-6">Você precisa estar logado.</div>;
  if (!contractId) return <div className="p-6">Contrato inválido.</div>;

  const pipelineStage = String(family?.pipeline_stage || family?.pipeline?.stage || "").toLowerCase();
  const beforeContract = stageIndex(pipelineStage) !== -1 && stageIndex(pipelineStage) < stageIndex("contrato");
  const dueMissing = !dueDay;

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <style>{`
        .no-select { user-select: none; -webkit-user-select: none; }
        #contract-print-area { background: #eceff3; border-radius: 24px; padding: 18px 16px; }
        .page { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto 18px; box-sizing: border-box; background: #fff; color: #111827; border: 1px solid #d6dae1; border-radius: 18px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08); padding: 14mm 15mm 12mm; display: flex; flex-direction: column; font-family: "Times New Roman", Georgia, serif; overflow: hidden; }
        .pageHeader { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-bottom: 8px; font-size: 10.5px; color: #4b5563; }
        .pageHeaderTitle { display: flex; flex-direction: column; gap: 2px; }
        .pageBody { flex: 1 1 auto; overflow: hidden; }
        .pageFooter { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; border-top: 1px solid #d1d5db; padding-top: 6px; font-size: 10.3px; color: #4b5563; }
        .title { text-align: center; font-size: 17px; line-height: 1.3; margin: 2px 0 2px; letter-spacing: 0.55px; font-weight: 700; }
        .subtitle { text-align: center; font-size: 11.4px; line-height: 1.35; margin: 0 0 10px; letter-spacing: 0.5px; font-weight: 700; }
        .clauseTitle { font-size: 11.4px; line-height: 1.35; margin: 8px 0 4px; font-weight: 700; letter-spacing: 0.35px; text-transform: uppercase; break-after: avoid; }
        .para, .list li { font-size: 10.8px; line-height: 1.48; text-align: justify; color: #111827; orphans: 3; widows: 3; }
        .para { margin: 0 0 5px; text-indent: 7mm; break-inside: avoid; }
        .paraStrong { text-indent: 0; font-weight: 700; margin-bottom: 6px; }
        .list { margin: 0 0 8px 5mm; padding: 0 0 0 4mm; }
        .list li { margin: 0 0 5px; break-inside: avoid; }
        .annexTitle { text-align: center; font-size: 15px; margin: 2px 0 4px; letter-spacing: 0.55px; font-weight: 700; }
        .annexSubtitle { text-align: center; font-size: 10.8px; color: #4b5563; margin-bottom: 10px; }
        .summaryPanel { border: 1px solid #d1d5db; border-radius: 14px; padding: 10px 12px; margin-bottom: 10px; break-inside: avoid; }
        .summaryPanelTitle { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.35px; margin-bottom: 6px; }
        .summaryGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
        .summaryRow { border-bottom: 1px solid #eef2f7; padding-bottom: 5px; }
        .summaryLabel { font-size: 9.7px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.25px; margin-bottom: 2px; }
        .summaryValue { font-size: 10.9px; line-height: 1.35; color: #111827; font-weight: 700; }
        .summaryColumns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .summaryList { margin: 0; padding-left: 16px; }
        .summaryList li { font-size: 10.5px; line-height: 1.45; margin-bottom: 5px; text-align: left; }
        .matrixTable { width: 100%; border-collapse: collapse; }
        .matrixTable th, .matrixTable td { border: 1px solid #d1d5db; padding: 7px 8px; vertical-align: top; text-align: left; }
        .matrixTable th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; background: #f8fafc; }
        .matrixTable td { font-size: 10.25px; line-height: 1.4; }
        .mutedNote { font-size: 9.7px; line-height: 1.4; color: #6b7280; margin-top: 8px; }
        .sigLead { font-size: 10.9px; line-height: 1.5; color: #111827; margin-bottom: 10px; text-align: justify; }
        .sigGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .sigCard { border: 1px solid #d1d5db; border-radius: 16px; padding: 12px; min-height: 148px; display: flex; flex-direction: column; }
        .sigTitle { font-size: 11.2px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; margin-bottom: 6px; }
        .sigMeta { font-size: 10.5px; line-height: 1.45; color: #374151; }
        .sigBox { margin-top: auto; height: 86px; border: 1.6px solid #111827; border-radius: 12px; }
        .sigHint { margin-top: 6px; font-size: 9.5px; color: #6b7280; }
        .pageBreak { break-after: page; page-break-after: always; }
        .pageBreakLast { break-after: auto; page-break-after: auto; }
        @media print {
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #contract-print-area, #contract-print-area * { visibility: visible !important; }
          #contract-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; background: #fff !important; border-radius: 0 !important; }
          .topBar { display: none !important; }
          .page { width: 210mm !important; min-height: 297mm !important; height: 297mm !important; max-height: 297mm !important; margin: 0 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; padding: 13mm 14mm 11mm !important; overflow: hidden !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <Card className="topBar">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              <div>
                <div className="font-semibold">Contrato</div>
                <div className="text-xs text-slate-500">
                  Protocolo: <span className="font-mono">{contractId}</span> • Versão: {versionLabel}
                </div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <Button variant="outline" onClick={() => window.open(GOV_SIGN_URL, "_blank")}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Assinar no gov.br
              </Button>
            </div>
          </div>

          {(beforeContract || dueMissing) ? (
            <div className="rounded-xl border bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {beforeContract ? (
                <div>
                  <b>Atenção:</b> você ainda não chegou oficialmente na etapa <b>Contrato</b> no pipeline.
                  Você pode ler o documento, mas a etapa pode não estar liberada para assinatura/pagamento ainda.
                </div>
              ) : null}
              {dueMissing ? (
                <div className="mt-1">
                  <b>Dia de vencimento:</b> ainda não foi definido. Escolha o dia na tela de <b>Documentação</b>
                  para o contrato refletir corretamente o vencimento mensal.
                </div>
              ) : null}
            </div>
          ) : null}

          {validated && (
            <div className="rounded-xl border bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <b>Contrato validado:</b> este protocolo já foi fechado. O fluxo correto agora é baixar o PDF salvo no Storage.
            </div>
          )}

          {awaitingApproval && (
            <div className="rounded-xl border bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <b>Contrato enviado:</b> o arquivo já foi encaminhado para análise. Esta tela fica apenas para consulta enquanto a validação não é concluída.
            </div>
          )}

          {refused && (
            <div className="rounded-xl border bg-red-50 px-3 py-2 text-sm text-red-900">
              <b>Contrato recusado:</b> você pode revisar o documento, gerar nova impressão e reenviar o PDF corrigido.
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-slate-500">Plano</div>
              <div className="text-sm font-semibold text-slate-900">{planName}</div>
              <div className="text-xs text-slate-600 mt-1">
                Mensalidade: <b>{monthlyAmount ? moneyBRL(monthlyAmount) : "—"}</b> • Prazo: <b>{termMonths} meses</b>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-xs text-slate-500">Janela 48h (entrada)</div>
              <div className="text-sm font-semibold text-slate-900">{activationDeadlineText}</div>
              <div className="text-xs text-slate-600 mt-1">
                Vencimento limite considerado até <b>23:59</b> do segundo dia após a ativação.
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-xs text-slate-500">Impressão (servidor)</div>
              <div className="text-sm font-semibold text-slate-900">{printedAtText}</div>
              <div className="text-xs text-slate-600 mt-1">
                {validated ? "Contrato já finalizado e salvo." : "Clique em Concordo e imprimir e selecione Salvar como PDF."}
              </div>
            </div>
          </div>

          {!validated && !awaitingApproval && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1"
              />
              <div className="text-sm">
                <div className="font-semibold">
                  Concordo com o conteúdo e desejo imprimir para assinatura via gov.br
                </div>
                <div className="text-xs text-slate-500">
                  O sistema registra a data/hora no servidor.
                </div>
              </div>
            </label>
          )}

          <div className="flex gap-2 flex-wrap">
            {validated ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDownloadStoredContract}
                disabled={downloadingStored}
              >
                {downloadingStored ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Baixando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar contrato validado
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="bg-amber-500 hover:bg-amber-600"
                onClick={handleAgreeAndPrint}
                disabled={!agree || printing || !canPrintFromView}
              >
                {printing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Preparando…
                  </>
                ) : awaitingApproval ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2" />
                    Aguardando aprovação
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    Concordo e imprimir
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div id="contract-print-area" className={DISABLE_SELECTION ? "no-select" : ""}>
        {bodyPagesFilled.map((blocks, idx) => {
          const pageNumber = idx + 1;

          return (
            <section key={`body-${idx}`} className="page pageBreak">
              <div className="pageHeader">
                <div className="pageHeaderTitle">
                  <div><b>Sol da Gente</b> • Instrumento contratual</div>
                  <div>Versão visual: {versionLabel}</div>
                </div>
                <div>Protocolo: <span className="font-mono">{contractId}</span></div>
              </div>

              <div className="pageBody">
                {blocks.map((b, i) => {
                  if (b.type === "h1") return <h1 key={i} className="title">{b.text}</h1>;
                  if (b.type === "h2") return <h2 key={i} className="subtitle">{b.text}</h2>;
                  if (b.type === "h3") return <h3 key={i} className="clauseTitle">{b.text}</h3>;
                  if (b.type === "ul") {
                    return (
                      <ul key={i} className="list">
                        {b.items.map((it, k) => (
                          <li key={k}>{it}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (b.type === "p-strong") {
                    return (
                      <p key={i} className="para paraStrong">
                        {b.text}
                      </p>
                    );
                  }
                  return (
                    <p key={i} className="para">
                      {b.text}
                    </p>
                  );
                })}
              </div>

              <div className="pageFooter">
                <div>Data de impressão (servidor): {printedAtText}</div>
                <div>Página {pageNumber} de {totalPages}</div>
              </div>
            </section>
          );
        })}

        <section className="page pageBreak">
          <div className="pageHeader">
            <div className="pageHeaderTitle">
              <div><b>Sol da Gente</b> • Anexo contratual</div>
              <div>Quadro-resumo operacional e financeiro</div>
            </div>
            <div>Protocolo: <span className="font-mono">{contractId}</span></div>
          </div>

          <div className="pageBody">
            <h2 className="annexTitle">ANEXO I — QUADRO-RESUMO CONTRATUAL</h2>
            <div className="annexSubtitle">
              Leitura executiva do contrato. Em caso de divergência, prevalece o texto integral das cláusulas contratuais.
            </div>

            <div className="summaryPanel">
              <div className="summaryPanelTitle">Identificação essencial</div>
              <div className="summaryGrid">
                <SummaryRow label="Plano contratado" value={planName} />
                <SummaryRow label="Mensalidade" value={monthlyAmount ? moneyBRL(monthlyAmount) : "—"} />
                <SummaryRow label="Prazo de vigência" value={`${termMonths} meses`} />
                <SummaryRow label="Início contratual" value={fmtBRDate(contractStartDate)} />
                <SummaryRow label="Término previsto" value={fmtBRDate(contractEndDate)} />
                <SummaryRow label="Vencimento mensal" value={dueDay ? `Dia ${dueDay}` : "Não definido"} />
                <SummaryRow label="1ª parcela / entrada" value={firstInstallmentText} />
                <SummaryRow label="Imóvel de instalação" value={filled.enderecoImovel} />
              </div>
            </div>

            <div className="summaryColumns">
              <div className="summaryPanel">
                <div className="summaryPanelTitle">Serviços-base incluídos</div>
                <ul className="summaryList">
                  {annexIncludedItems.map((item, idx) => (
                    <li key={`inc-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="summaryPanel">
                <div className="summaryPanelTitle">Itens não incluídos salvo aditivo</div>
                <ul className="summaryList">
                  {annexExcludedItems.map((item, idx) => (
                    <li key={`exc-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="summaryPanel">
              <div className="summaryPanelTitle">Matriz resumida de cancelamento e retenções</div>
              <table className="matrixTable">
                <thead>
                  <tr>
                    <th>Fase</th>
                    <th>Regra resumida</th>
                  </tr>
                </thead>
                <tbody>
                  {cancellationMatrix.map((row, idx) => (
                    <tr key={`row-${idx}`}>
                      <td>{row.phase}</td>
                      <td>{row.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mutedNote">
                Direitos de arrependimento, hipóteses de inadimplência grave, força maior e demais efeitos jurídicos permanecem regidos pelo corpo do contrato.
              </div>
            </div>
          </div>

          <div className="pageFooter">
            <div>Resumo executivo do instrumento principal</div>
            <div>Página {totalPages - 1} de {totalPages}</div>
          </div>
        </section>

        <section className="page pageBreakLast">
          <div className="pageHeader">
            <div className="pageHeaderTitle">
              <div><b>Sol da Gente</b> • Assinaturas</div>
              <div>Assinatura eletrônica via gov.br</div>
            </div>
            <div>Protocolo: <span className="font-mono">{contractId}</span></div>
          </div>

          <div className="pageBody">
            <h2 className="annexTitle">ASSINATURAS</h2>
            <div className="sigLead">
              Após gerar o PDF, utilize o assinador oficial do gov.br para colher as assinaturas eletrônicas. O documento assinado deverá ser reenviado pelos canais oficiais do Programa para arquivamento contratual.
            </div>

            <div className="sigGrid">
              <div className="sigCard">
                <div className="sigTitle">Contratante</div>
                <div className="sigMeta">
                  <div><b>Nome:</b> {safe(family?.full_name || family?.name)}</div>
                  <div><b>CPF:</b> {safe(family?.cpf)}</div>
                  <div><b>E-mail:</b> {safe(family?.email)}</div>
                </div>
                <div className="sigBox" />
                <div className="sigHint">Espaço reservado para assinatura digital gov.br.</div>
              </div>

              <div className="sigCard">
                <div className="sigTitle">Contratada</div>
                <div className="sigMeta">
                  <div><b>Razão social:</b> {safe(contractor?.companyName)}</div>
                  <div><b>CNPJ:</b> {safe(contractor?.cnpj)}</div>
                  <div><b>Representante:</b> {safe(contractor?.responsibleName)}</div>
                  <div><b>CPF:</b> {safe(contractor?.responsibleCpf)}</div>
                </div>
                <div className="sigBox" />
                <div className="sigHint">Espaço reservado para assinatura digital gov.br.</div>
              </div>
            </div>
          </div>

          <div className="pageFooter">
            <div>Assinador oficial: {GOV_SIGN_URL}</div>
            <div>Página {totalPages} de {totalPages}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import {
  ArrowRight,
  Copy,
  Link as LinkIcon,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast, Toaster } from "sonner";

const WAITLIST_TERMS_URL = "/waitlist-terms";
const SUPPORT_WHATSAPP_RAW =
  (typeof process !== "undefined" &&
    process?.env &&
    (process.env.REACT_APP_SUPPORT_WHATSAPP || process.env.VITE_SUPPORT_WHATSAPP)) ||
  (typeof window !== "undefined" && window.__SUPPORT_WHATSAPP__) ||
  "";

const FUNCTIONS_REGION = "us-central1";

function safeStr(v) {
  return String(v || "").trim();
}
function onlyDigits(v = "") {
  return String(v).replace(/\D+/g, "");
}
function normalizeEmail(v = "") {
  return String(v || "").trim().toLowerCase();
}
function formatPhoneBR(input = "") {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length < 3) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
function normalizeSupportPhone(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}
function buildSupportWhatsAppLink(message) {
  const phone = normalizeSupportPhone(SUPPORT_WHATSAPP_RAW);
  if (!phone) return "";
  const text = encodeURIComponent(message || "Olá! Quero entrar na fila do Sol da Gente.");
  return `https://wa.me/${phone}?text=${text}`;
}
function buildWaitlistReferralLink(referralCode) {
  if (!referralCode) return "";
  try {
    const u = new URL(window.location.origin);
    u.pathname = "/waitlist";
    u.searchParams.set("ref", referralCode);
    return u.toString();
  } catch {
    return "";
  }
}
function fallbackCopyText(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}
function copyText(text, okMsg = "Copiado!") {
  const str = String(text || "");
  if (!str) return toast.message("Nada para copiar.");
  const done = () => toast.success(okMsg);

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(str).then(done).catch(() => {
      const ok = fallbackCopyText(str);
      if (ok) done();
      else toast.message("Não consegui copiar automaticamente.");
    });
    return;
  }

  const ok = fallbackCopyText(str);
  if (ok) done();
  else toast.message("Não consegui copiar automaticamente.");
}
function getFunctionsBase() {
  const projectId = auth?.app?.options?.projectId || db?.app?.options?.projectId || "";
  if (!projectId) throw new Error("Project ID não encontrado no Firebase.");
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net`;
}
async function callPublicFunction(path, body = {}) {
  const res = await fetch(`${getFunctionsBase()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data?.error || "Falha na operação.");
  return data;
}

export default function WaitListPage() {
  const navigate = useNavigate();

  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [availability, setAvailability] = useState(null);

  const [joinOpen, setJoinOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    neighborhood: "",
    bill_range: "200_400",
    property_type: "house",
    has_roof: "yes",
    notes: "",
    consent_whatsapp: true,
    consent_lgpd: false,
    consent_terms: false,
    referred_by_code: "",
  });

  async function refreshAvailability() {
    setLoadingAvailability(true);
    try {
      const data = await callPublicFunction("getPublicWaitlistSnapshot", {});
      setAvailability(data?.availability || null);
    } catch (e) {
      setAvailability(null);
    } finally {
      setLoadingAvailability(false);
    }
  }

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const ref = sp.get("ref");
      if (ref) {
        setForm((p) => ({ ...p, referred_by_code: p.referred_by_code || ref }));
      }
    } catch {}
    refreshAvailability();
  }, []);

  const isQueueOpen = useMemo(() => {
    return !!availability?.hasActivePlan;
  }, [availability]);

  const queueInfo = availability?.groupCapacity || {};
  const formReady = useMemo(() => {
    if (!isQueueOpen || submitting) return false;
    if (safeStr(form.full_name).length < 3) return false;
    if (!normalizeEmail(form.email).includes("@")) return false;
    if (![10, 11].includes(onlyDigits(form.phone).length)) return false;
    if (!safeStr(form.city)) return false;
    if (!safeStr(form.neighborhood)) return false;
    if (!form.consent_whatsapp || !form.consent_lgpd || !form.consent_terms) return false;
    return true;
  }, [form, isQueueOpen, submitting]);

  function openSupportWhatsApp(msg) {
    const link = buildSupportWhatsAppLink(msg);
    if (!link) {
      toast.message("WhatsApp do suporte não configurado.");
      return;
    }
    window.open(link, "_blank");
  }

  async function submitJoin() {
    if (!formReady) {
      toast.message("Preencha os campos e marque WhatsApp/LGPD/Termos.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await callPublicFunction("joinPublicWaitlist", {
        origin: window.location.origin,
        form: {
          ...form,
          email: normalizeEmail(form.email),
          phone: onlyDigits(form.phone),
          phone_formatted: formatPhoneBR(form.phone),
        },
      });

      setResult(data?.result || null);
      toast.success(data?.already ? "Você já estava na fila." : "Você entrou na fila!");
      await refreshAvailability();
      setJoinOpen(false);
    } catch (e) {
      toast.error(e?.message || "Não foi possível entrar na fila agora.");
    } finally {
      setSubmitting(false);
    }
  }

  const referralLink = useMemo(() => {
    return buildWaitlistReferralLink(result?.referral_code || "");
  }, [result]);

  const shareMsg = useMemo(() => {
    if (!result) return "";
    return [
      "Entrei na fila de espera do Sol da Gente ☀️",
      result.positionStr ? `Minha posição geral: #${result.positionStr}` : null,
      result.group_queue_position
        ? `Posição no grupo: #${result.group_queue_position} (${result.group_queue_role === "standby" ? "Lista de espera" : "Titular"})`
        : null,
      result.referral_code ? `Meu código: ${result.referral_code}` : null,
      referralLink ? `Link: ${referralLink}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }, [result, referralLink]);

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500">
          <div className="max-w-6xl mx-auto px-6 py-12 text-white">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-sm">
                  <Sparkles className="w-4 h-4" />
                  Fila de espera • Sol da Gente
                </div>

                <h1 className="text-3xl md:text-4xl font-bold mt-4 leading-tight">
                  Entre na fila e seja chamado primeiro quando abrirmos no seu bairro.
                </h1>

                <p className="mt-3 text-white/90">
                  Você entra na fila, vê sua posição e recebe um código de indicação para convidar outras famílias.
                </p>

                <div className="mt-6 flex gap-3 flex-wrap">
                  <Button
                    type="button"
                    className="!bg-white !text-amber-700 hover:!bg-white/90 !border !border-white/60 shadow-sm"
                    disabled={!isQueueOpen}
                    onClick={() => setJoinOpen(true)}
                  >
                    Quero entrar na fila <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  <Button
                    variant="outline"
                    className="bg-transparent text-white border border-white/60 hover:bg-white/10 hover:text-white"
                    onClick={() => openSupportWhatsApp("Olá! Quero entrar na fila de espera do Sol da Gente. Como funciona?")}
                  >
                    Falar no WhatsApp <MessageCircle className="w-4 h-4 ml-2" />
                  </Button>

                  <Button
                    variant="outline"
                    className="bg-transparent text-white border border-white/60 hover:bg-white/10 hover:text-white"
                    onClick={() => navigate("/")}
                  >
                    Voltar para o site
                  </Button>
                </div>

                <div className="mt-4 text-sm text-white/90">
                  {loadingAvailability
                    ? "Verificando disponibilidade da fila..."
                    : isQueueOpen
                      ? "Fila aberta agora ✅"
                      : "⚠️ Fila temporariamente fechada."}
                </div>
              </div>

              <div className="w-full sm:w-[420px] space-y-4">
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-900">Fila do grupo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingAvailability ? (
                      <p className="text-sm text-slate-600">Carregando dados do grupo...</p>
                    ) : !availability?.groupId ? (
                      <div className="p-4 bg-slate-50 rounded-xl border">
                        <p className="text-sm text-slate-700">
                          No momento, não há grupo disponível para inscrição.
                          <br />
                          <b>Você pode entrar na fila de espera</b> e, quando um novo grupo abrir, nós vamos te contactar.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500">Grupo</p>
                            <p className="font-semibold text-slate-900 truncate">{queueInfo.name || "Grupo"}</p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-slate-500">Inscrições</p>
                            <p className="text-2xl font-bold text-slate-900">
                              {queueInfo.used || 0}
                              <span className="text-sm font-semibold text-slate-500">/{queueInfo.total || 0}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600">
                          Titulares: <strong>{queueInfo.primaryUsed || 0}/{queueInfo.baseCapacity || 0}</strong> • Lista de espera: <strong>{queueInfo.standbyUsed || 0}</strong>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-slate-900">{result ? "Sua localização ✅" : "Sua posição aparece aqui"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!result ? (
                      <div className="text-sm text-slate-600">
                        Clique em <strong>“Quero entrar na fila”</strong> para ver sua posição e seu código.
                      </div>
                    ) : (
                      <>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                            <div className="text-xs text-amber-700">Posição geral</div>
                            <div className="text-2xl font-bold text-amber-800">#{result.positionStr}</div>
                          </div>
                          <div className="p-4 rounded-2xl bg-slate-50 border">
                            <div className="text-xs text-slate-500">Posição no grupo</div>
                            <div className="text-2xl font-bold text-slate-900">
                              {result.group_queue_position ? `#${result.group_queue_position}` : "Fila geral"}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              {result.group_queue_role === "standby" ? "Lista de espera" : result.group_queue_role === "primary" ? "Titular" : "—"}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500">Seu código de indicação</div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900 break-all">{result.referral_code}</div>
                          <Button variant="outline" className="h-9" onClick={() => copyText(result.referral_code, "Código copiado.")}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar
                          </Button>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" onClick={() => copyText(referralLink, "Link copiado.")}>
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Copiar link
                          </Button>
                          <Button variant="outline" onClick={() => copyText(shareMsg, "Mensagem copiada.")}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar mensagem
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Entrar na fila</DialogTitle>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: formatPhoneBR(e.target.value) }))} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.neighborhood} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Faixa de conta de energia</Label>
                  <Select value={form.bill_range} onValueChange={(v) => setForm((p) => ({ ...p, bill_range: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0_200">Até R$ 200</SelectItem>
                      <SelectItem value="200_400">R$ 200 a R$ 400</SelectItem>
                      <SelectItem value="400_700">R$ 400 a R$ 700</SelectItem>
                      <SelectItem value="700_plus">Acima de R$ 700</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo do imóvel</Label>
                  <Select value={form.property_type} onValueChange={(v) => setForm((p) => ({ ...p, property_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="house">Casa</SelectItem>
                      <SelectItem value="apartment">Apartamento</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Possui telhado?</Label>
                  <Select value={form.has_roof} onValueChange={(v) => setForm((p) => ({ ...p, has_roof: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                      <SelectItem value="not_sure">Não sei</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Código de indicação (opcional)</Label>
                  <Input value={form.referred_by_code} onChange={(e) => setForm((p) => ({ ...p, referred_by_code: e.target.value }))} />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={form.consent_whatsapp} onCheckedChange={(v) => setForm((p) => ({ ...p, consent_whatsapp: !!v }))} />
                <span>Aceito receber contato via WhatsApp.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={form.consent_lgpd} onCheckedChange={(v) => setForm((p) => ({ ...p, consent_lgpd: !!v }))} />
                <span>Aceito a Política de Privacidade (LGPD).</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={form.consent_terms} onCheckedChange={(v) => setForm((p) => ({ ...p, consent_terms: !!v }))} />
                <span>Li e aceito os <a className="underline" href={WAITLIST_TERMS_URL} target="_blank" rel="noreferrer">Termos da Fila</a>.</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancelar</Button>
              <Button disabled={!formReady} onClick={submitJoin}>
                {submitting ? "Enviando..." : "Entrar na fila"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

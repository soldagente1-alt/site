import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "../../utils/createPageUrl";
import { motion } from "framer-motion";
import { Sun, ArrowLeft, ArrowRight, User, MapPin, DollarSign } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

import { db } from "../../api/firebaseDb";
import { doc, getDoc } from "firebase/firestore";

function normalizeEmail(v = "") {
  return String(v || "").trim().toLowerCase();
}
function onlyDigits(v = "") {
  return String(v || "").replace(/\D+/g, "");
}

export default function FamilyRegister() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const leadId = sp.get("lead");
  const token = sp.get("token");

  const totalSteps = 3;
  const [step, setStep] = useState(1);

  const [loadingLead, setLoadingLead] = useState(false);
  const [leadOk, setLeadOk] = useState(null); // null=sem checar, false=inválido, true=ok

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    cpf: "",
    phone: "",
    address: {
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      zip_code: "",
    },
    monthly_income: "",
    current_energy_bill: "",
  });

  const states = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
    "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
  ];

  // valida/preenche do waitlist quando vier por link
  useEffect(() => {
    async function run() {
      if (!leadId || !token) {
        setLeadOk(null);
        return;
      }

      setLoadingLead(true);
      try {
        const ref = doc(db, "WaitlistLeads", String(leadId));
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setLeadOk(false);
          return;
        }

        const lead = snap.data() || {};
        const tokenOnLead = String(lead.preapprove_token || "");
        const isOk = !!tokenOnLead && tokenOnLead === String(token);

        setLeadOk(isOk);

        if (isOk) {
          setFormData((prev) => ({
            ...prev,
            full_name: lead.full_name || prev.full_name,
            email: lead.email || prev.email,
            phone: lead.phone_formatted || lead.phone || prev.phone,
            address: {
              ...prev.address,
              city: lead.city || prev.address.city,
              neighborhood: lead.neighborhood || prev.address.neighborhood,
            },
          }));
        }
      } catch (e) {
        console.error(e);
        setLeadOk(false);
      } finally {
        setLoadingLead(false);
      }
    }

    run();
  }, [leadId, token]);

  const handleChange = (field, value) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const formatCPF = (v) =>
    v.replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");

  const formatPhone = (v) =>
    v.replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");

  const formatCEP = (v) =>
    v.replace(/\D/g, "")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{3})\d+?$/, "$1");

  const isStep1Valid = useMemo(() => {
    const emailOk = normalizeEmail(formData.email).includes("@");
    return (
      formData.full_name.trim().length > 3 &&
      emailOk &&
      formData.cpf.replace(/\D/g, "").length === 11 &&
      onlyDigits(formData.phone).length >= 10
    );
  }, [formData.full_name, formData.email, formData.cpf, formData.phone]);

  // Se veio por link e token for inválido: trava e manda pro /waitlist
  if (leadId && token) {
    if (loadingLead) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-600">
          Carregando validação do convite...
        </div>
      );
    }
    if (leadOk === false) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white border rounded-2xl p-6">
            <div className="font-bold text-slate-900 text-lg">Convite inválido</div>
            <div className="text-sm text-slate-600 mt-2">
              Esse link não é válido ou expirou. Volte para a lista de espera e solicite novamente.
            </div>
            <Button className="mt-4 w-full bg-amber-500 hover:bg-amber-600" onClick={() => navigate("/waitlist")}>
              Ir para lista de espera
            </Button>
          </div>
        </div>
      );
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Header icon={<User />} title="Dados Pessoais" subtitle="Informações básicas do responsável" />

            <Field label="Nome Completo *">
              <Input
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder="Seu nome completo"
                className="h-12"
              />
            </Field>

            <Field label="E-mail *">
              <Input
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="voce@exemplo.com"
                className="h-12"
              />
            </Field>

            <Field label="CPF *">
              <Input
                value={formData.cpf}
                maxLength={14}
                onChange={(e) => handleChange("cpf", formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="h-12"
              />
            </Field>

            <Field label="Telefone *">
              <Input
                value={formData.phone}
                maxLength={15}
                onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                className="h-12"
              />
            </Field>

            <Button
              className="w-full h-12 mt-6 bg-amber-500 hover:bg-amber-600"
              onClick={() => setStep(2)}
              disabled={!isStep1Valid}
            >
              Continuar <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Header icon={<MapPin />} title="Endereço" subtitle="Onde o kit será instalado" />

            <div className="space-y-4">
              <div>
                <Label>CEP *</Label>
                <Input
                  value={formData.address.zip_code}
                  onChange={(e) => handleChange("address.zip_code", formatCEP(e.target.value))}
                  placeholder="00000-000"
                  maxLength={9}
                  className="h-12"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Rua *</Label>
                  <Input
                    value={formData.address.street}
                    onChange={(e) => handleChange("address.street", e.target.value)}
                    className="h-12"
                  />
                </div>
                <div>
                  <Label>Número *</Label>
                  <Input
                    value={formData.address.number}
                    onChange={(e) => handleChange("address.number", e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>

              <div>
                <Label>Bairro *</Label>
                <Input
                  value={formData.address.neighborhood}
                  onChange={(e) => handleChange("address.neighborhood", e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Cidade *</Label>
                  <Input
                    value={formData.address.city}
                    onChange={(e) => handleChange("address.city", e.target.value)}
                    className="h-12"
                  />
                </div>
                <div>
                  <Label>Estado *</Label>
                  <Select value={formData.address.state} onValueChange={(v) => handleChange("address.state", v)}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={() => setStep(3)}
                disabled={!formData.address.street || !formData.address.city || !formData.address.state}
              >
                Continuar
              </Button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Header icon={<DollarSign />} title="Financeiro" subtitle="Para calcular seu plano" />

            <Field label="Renda Familiar *">
              <Select value={formData.monthly_income} onValueChange={(v) => handleChange("monthly_income", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1500">Até 1.500</SelectItem>
                  <SelectItem value="2500">1.500 a 2.500</SelectItem>
                  <SelectItem value="4000">2.500 a 4.000</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Conta de Luz *">
              <Input
                type="number"
                value={formData.current_energy_bill}
                onChange={(e) => handleChange("current_energy_bill", e.target.value)}
              />
            </Field>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
              </Button>

              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={() =>
                  navigate("/criaracesso", {
                    state: {
                      role: "family",
                      payload: {
                        ...formData,
                        // ✅ NOVO: primeiro estado do pipeline salvo no Family na criação
                        pipeline_stage: "cadastro",
                      },
                      // ✅ passa para o CriarAcesso vincular o lead
                      waitlist: leadId && token ? { lead_id: leadId, token } : null,
                    },
                  })
                }
              >
                Finalizar Cadastro
              </Button>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-lg mx-auto">
        <Link to={createPageUrl("Landing")} className="inline-flex items-center gap-2 text-slate-600 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar para início
        </Link>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Sun className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Cadastro de Família</h1>
          <p>Passo {step} de {totalSteps}</p>

          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full ${i + 1 <= step ? "bg-amber-500 w-12" : "bg-slate-200 w-8"}`}
              />
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-6">{renderStep()}</CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ===== COMPONENTES AUX ===== */

function Header({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold mt-6">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  ArrowRight,
  CheckCircle2,
  MapPin,
  User,
} from "lucide-react";

import { Button } from "../../../src/components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../../src/components/ui/label";
import { Card, CardContent } from "../../../src/components/ui/card";

export default function FranchiseRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    owner_name: "",
    cpf_cnpj: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    region: "",
  });

  const handleChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const goToCreateAccess = () => {
    navigate("/CriarAcesso", {
      state: {
        role: "franchise",
        payload: formData,
      },
    });
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Header icon={<User />} title="Dados do Franqueado" subtitle="Informações básicas" />

            <InputField label="Nome da Franquia *" value={formData.name} onChange={(v) => handleChange("name", v)} />
            <InputField label="Nome do Proprietário *" value={formData.owner_name} onChange={(v) => handleChange("owner_name", v)} />
            <InputField label="CPF / CNPJ *" value={formData.cpf_cnpj} onChange={(v) => handleChange("cpf_cnpj", v)} />
            <InputField label="E-mail *" value={formData.email} onChange={(v) => handleChange("email", v)} />
            <InputField label="Telefone *" value={formData.phone} onChange={(v) => handleChange("phone", v)} />

            <Button
              className="w-full h-12 mt-6 bg-purple-500"
              onClick={() => setStep(2)}
              disabled={!formData.email || !formData.name}
            >
              Continuar <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Header icon={<MapPin />} title="Finalizar Cadastro" subtitle="Criar acesso à plataforma" />

            <Button
              className="w-full h-12 bg-purple-500"
              onClick={goToCreateAccess}
            >
              Finalizar Cadastro <CheckCircle2 className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardContent className="p-6">{renderStep()}</CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ===== Helpers ===== */

function Header({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, ...props }) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-12" {...props} />
    </div>
  );
}

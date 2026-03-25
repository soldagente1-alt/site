import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

const FUNCTIONS_REGION = "us-central1";

function useQueryParam(name) {
  return useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get(name);
    } catch {
      return null;
    }
  }, [name]);
}

function getFunctionsBase() {
  const projectId =
    auth?.app?.options?.projectId ||
    db?.app?.options?.projectId ||
    "";
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

  if (!res.ok) {
    throw new Error(data?.error || "Falha ao validar link.");
  }

  return data;
}

export default function PreapprovedPage() {
  const navigate = useNavigate();
  const token = useQueryParam("t");

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await callPublicFunction("validatePreapprovalLink", { token });

        if (!alive) return;
        setLead(data?.lead || null);
      } catch (e) {
        if (alive) {
          setLead(null);
          toast.error("Não consegui validar o link agora.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-slate-900">Link inválido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Este link não tem token de pré-aprovação.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            Pré-aprovação • Sol da Gente
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Validando link...
            </div>
          ) : !lead ? (
            <div className="text-sm text-slate-600">
              Não encontramos um lead válido para este token. Peça um novo link para o atendimento.
            </div>
          ) : (
            <>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-sm text-amber-900 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Você está pré-aprovado ✅
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  Vamos finalizar seu cadastro agora.
                </div>
              </div>

              <div className="text-sm text-slate-700">
                <div><strong>Nome:</strong> {lead.full_name || "—"}</div>
                <div><strong>E-mail:</strong> {lead.email || "—"}</div>
                <div><strong>WhatsApp:</strong> {lead.phone_formatted || lead.phone || "—"}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Ao continuar, seus dados serão usados para agilizar o cadastro.
                </div>
              </div>

              <Button
                className="w-full bg-amber-500 hover:bg-amber-600"
                onClick={() => {
                  navigate(`/familyregister?token=${encodeURIComponent(token)}&lead=${encodeURIComponent(lead.id)}`);
                }}
              >
                Continuar cadastro
              </Button>

              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                Voltar para o site
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

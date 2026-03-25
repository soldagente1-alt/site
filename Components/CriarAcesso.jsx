import { useState, useEffect } from "react";
import { FaGoogle, FaApple } from "react-icons/fa";
import { useNavigate, useLocation, Link } from "react-router-dom";

import {
  loginWithGoogle,
  loginWithApple,
  createUserWithEmail,
} from "../../api/authService";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

function normalizeEmail(v = "") {
  return String(v || "").trim().toLowerCase();
}

const FUNCTIONS_REGION = "us-central1";

function getFunctionsBase(firebaseUser) {
  const projectId =
    firebaseUser?.auth?.app?.options?.projectId ||
    auth?.app?.options?.projectId ||
    db?.app?.options?.projectId ||
    "";
  if (!projectId) throw new Error("Project ID não encontrado no Firebase.");
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net`;
}

async function callAuthedFunction(firebaseUser, path, body = {}) {
  const token = await firebaseUser.getIdToken();
  const res = await fetch(`${getFunctionsBase(firebaseUser)}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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
    throw new Error(data?.error || "Falha ao concluir cadastro.");
  }

  return data;
}

export default function CriarAcesso() {
  const navigate = useNavigate();
  const location = useLocation();

  const { role, payload, waitlist } = location.state || {};

  const [email, setEmail] = useState(payload?.email || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const POLICY_VERSION = "2026-02-15";

  useEffect(() => {
    if (!role || !payload) {
      navigate("/", { replace: true });
    }
  }, [role, payload, navigate]);

  if (!role || !payload) return null;

  async function handleAuth(authFn) {
    if (role === "family" && !lgpdAccepted) {
      alert("Para continuar, você precisa aceitar a Política de Privacidade (LGPD).");
      return;
    }

    try {
      setLoading(true);

      const result = await authFn();
      const firebaseUser = result.user;

      const effectiveEmail = normalizeEmail(firebaseUser.email || email || payload?.email);

      const data = await callAuthedFunction(firebaseUser, "completePublicSignup", {
        role,
        payload,
        waitlist: waitlist || null,
        emailHint: effectiveEmail,
        lgpdAccepted: !!lgpdAccepted,
        policyVersion: POLICY_VERSION,
      });

      const routes = {
        family: "/family",
        investor: "/investor",
        franchise: "/franchise",
      };

      navigate(data?.route || routes[role] || "/");
    } catch (err) {
      console.error("Erro ao criar acesso:", err);
      alert("Erro ao criar acesso: " + (err?.message || "erro"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-500">
          <picture>
            <source srcSet="/Images/img_login.webp" type="image/webp" />
            <img
              src="/Images/img_login.jpg"
              alt="Sol da Gente"
              className="..."
              loading="eager"
              decoding="async"
            />
          </picture>
        </div>

        <div className="p-10 flex flex-col justify-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-slate-500 hover:text-amber-600 mb-6 w-fit"
          >
            ← Voltar para o início
          </button>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            Criar acesso
          </h2>
          <p className="text-slate-500 mb-6">
            Finalize seu cadastro para continuar
          </p>

          <input
            className="border rounded-xl p-3 w-full mb-3 bg-slate-50"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="border rounded-xl p-3 w-full mb-3 bg-slate-50"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {role === "family" && (
            <div className="mb-4">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-amber-600"
                  checked={lgpdAccepted}
                  onChange={(e) => setLgpdAccepted(e.target.checked)}
                />
                <span className="leading-relaxed">
                  Li e aceito a{" "}
                  <Link
                    to="/privacidade"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-700 hover:text-amber-800 underline"
                  >
                    Política de Privacidade (LGPD)
                  </Link>
                  .
                </span>
              </label>

              {!lgpdAccepted && (
                <div className="mt-2 text-xs text-amber-700">
                  Para criar seu acesso, é obrigatório aceitar a Política de Privacidade.
                </div>
              )}
            </div>
          )}

          <button
            disabled={loading || (role === "family" && !lgpdAccepted)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-semibold mb-4 disabled:opacity-50"
            onClick={() => handleAuth(() => createUserWithEmail(email, password))}
          >
            Criar acesso com e-mail
          </button>

          <div className="text-center text-sm text-slate-400 mb-4">
            ou continue com
          </div>

          <button
            disabled={loading || (role === "family" && !lgpdAccepted)}
            className="w-full border py-3 rounded-xl flex justify-center gap-2 mb-3 disabled:opacity-50"
            onClick={() => handleAuth(loginWithGoogle)}
          >
            <FaGoogle className="text-red-500" />
            Google
          </button>

          <button
            disabled={loading || (role === "family" && !lgpdAccepted)}
            className="w-full border py-3 rounded-xl flex justify-center gap-2 disabled:opacity-50"
            onClick={() => handleAuth(loginWithApple)}
          >
            <FaApple />
            Apple
          </button>

          <div className="mt-6 text-xs text-slate-500">
            Ao criar acesso, você confirma que leu e concorda com a{" "}
            <Link
              to="/privacidade"
              target="_blank"
              rel="noreferrer"
              className="text-amber-700 hover:text-amber-800 underline"
            >
              Política de Privacidade
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

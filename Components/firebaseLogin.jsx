//firebaseLogin.jsx
import { useState } from "react";
import { FaGoogle, FaApple } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import {
  loginWithEmail,
  loginWithGoogle,
  loginWithApple,
} from "../../api/authService";

const FUNCTIONS_REGION = "us-central1";

function getFunctionsBase(firebaseUser) {
  const projectId =
    firebaseUser?.auth?.app?.options?.projectId ||
    firebaseUser?.providerData?.[0]?.projectId ||
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
    throw new Error(data?.error || "Falha ao concluir login.");
  }

  return data;
}

export default function FirebaseLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  async function handleAuth(authFn) {
    try {
      const result = await authFn();
      const firebaseUser = result.user;

      const data = await callAuthedFunction(firebaseUser, "completePublicLogin", {
        emailHint: email || firebaseUser?.email || "",
      });

      const roleRoutes = {
        family: "/family",
        admin: "/admin",
        investor: "/investor",
        franchise: "/franchise",
      };

      navigate(data?.route || roleRoutes[data?.role] || "/");
    } catch (err) {
      console.error("Erro login:", err.message);
      alert("Falha no login: " + err.message);
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
            Entrar no Sol da Gente
          </h2>
          <p className="text-slate-500 mb-6">
            Acesse sua conta para continuar
          </p>

          <input
            className="border rounded-xl p-3 w-full mb-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="teste@teste.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="border rounded-xl p-3 w-full mb-4 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-semibold mb-4 transition"
            onClick={() =>
              handleAuth(() => loginWithEmail(email, password))
            }
          >
            Entrar
          </button>

          <div className="text-center text-sm text-slate-400 mb-4">
            ou continue com
          </div>

          <button
            className="w-full border py-3 rounded-xl flex justify-center items-center gap-2 mb-3 hover:bg-slate-50 transition"
            onClick={() => handleAuth(loginWithGoogle)}
          >
            <FaGoogle className="text-red-500" />
            Entrar com Google
          </button>

          <button
            className="w-full border py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-slate-50 transition"
            onClick={() => handleAuth(loginWithApple)}
          >
            <FaApple className="text-black" />
            Entrar com Apple
          </button>
        </div>
      </div>
    </div>
  );
}

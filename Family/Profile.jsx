import React, { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import {
  User,
  Save,
  Camera,
  Shield,
  Bell,
  Key,
  LogOut,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    user_type: "",
  });
  const [loading, setLoading] = useState(false);

  /* =========================
     LOAD USER (AUTH + DB)
  ========================= */
  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!snap.exists()) return;

      const data = snap.data();

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        ...data,
      });

      setFormData({
        full_name: data.full_name || "",
        phone: data.phone || "",
        user_type: data.user_type || "",
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar perfil");
    }
  }

  /* =========================
     SAVE PROFILE
  ========================= */
  async function handleSave() {
    if (!user) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        phone: formData.phone,
      });

      toast.success("Perfil atualizado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     LOGOUT
  ========================= */
  async function handleLogout() {
    await signOut(auth);
    window.location.href = "/";
  }

  const userTypeLabels = {
    family: "Participante / Família",
    investor: "Investidor",
    franchise: "Franqueado",
    admin: "Administrador",
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
        <p className="text-slate-600">
          Gerencie suas informações pessoais
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user?.avatar_url || ""} />
                <AvatarFallback className="bg-amber-100 text-amber-700 text-2xl">
                  {formData.full_name?.charAt(0) ||
                    user?.email?.charAt(0) ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white hover:bg-amber-600 transition">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {formData.full_name || "Usuário"}
              </h2>
              <p className="text-slate-500">{user?.email}</p>

              <span className="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                {userTypeLabels[formData.user_type] || "Usuário"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-slate-500" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label>Nome Completo</Label>
            <Input value={formData.full_name} disabled className="bg-slate-50" />
            <p className="text-xs text-slate-500 mt-1">
              O nome não pode ser alterado diretamente. Entre em contato com o
              suporte.
            </p>
          </div>

          <div>
            <Label>E-mail</Label>
            <Input value={user?.email || ""} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label>Telefone</Label>
            <Input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="(00) 00000-0000"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-500" />
            Notificações
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                Notificações por E-mail
              </p>
              <p className="text-sm text-slate-500">
                Receba atualizações no seu e-mail
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                Notificações por WhatsApp
              </p>
              <p className="text-sm text-slate-500">
                Receba lembretes pelo WhatsApp
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                Lembrete de Pagamento
              </p>
              <p className="text-sm text-slate-500">
                Receba lembretes antes do vencimento
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-500" />
            Segurança
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            <Key className="w-4 h-4 mr-2" />
            Alterar Senha
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

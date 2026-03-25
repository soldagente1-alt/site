// AdminNotifications.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  limit,
  getDocs,
} from "firebase/firestore";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import { Bell, Send, Users, Wallet, Building2, Plus, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";

import { toast } from "sonner";

/**
 * Coleções:
 * - Family/{uid}              (lista de famílias/usuários do app)
 * - AdminNotifications/{id}   (notificações broadcast por role)
 *
 * Modelo (AdminNotifications doc):
 * {
 *   title, message, type,
 *   target_role: "all" | "family" | "investor" | "franchise",
 *   target: { route, ticket_id?, ticket_number? },
 *   created_at,
 *   created_by? (opcional)
 * }
 *
 * Leitura/Não-lidas (no lado da família):
 * - Family/{uid}/NotificationReads/{notifId} { read_at }
 */

export default function AdminNotifications() {
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  const [showNewNotification, setShowNewNotification] = useState(false);
  const [sending, setSending] = useState(false);

  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    type: "general",

    // alvo por role (broadcast)
    target_role: "all",

    // rota destino (FamilyLayout vai navegar)
    route: "none", // none | /family/suporte | /family/payments | /family/contract

    // opcionais (se rota for suporte)
    ticket_id: "",
    ticket_number: "",
  });

  /* =========================
     LOAD USERS (Family)
  ========================= */
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(collection(db, "Family"));
        if (!mounted) return;

        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(list);
      } catch (err) {
        console.warn("Falha ao carregar Family:", err);
        setUsers([]);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     LOAD NOTIFICATIONS realtime (AdminNotifications)
     ✅ Admin vê todas as enviadas
  ========================= */
  useEffect(() => {
    setLoadingNotifs(true);

    const qy = query(
      collection(db, "AdminNotifications"),
      orderBy("created_at", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setNotifications(list);
        setLoadingNotifs(false);
      },
      (err) => {
        console.warn("Falha ao carregar AdminNotifications:", err);
        setNotifications([]);
        setLoadingNotifs(false);
      }
    );

    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, []);

  /* =========================
     STATS
  ========================= */
  const countByRole = (role) => {
    return users.filter((u) => String(u.role || "family").toLowerCase() === role).length;
  };

  /* =========================
     TYPE CONFIG
  ========================= */
  const typeConfig = {
    general: { label: "Geral", color: "bg-slate-100 text-slate-700" },
    payment: { label: "Pagamento", color: "bg-green-100 text-green-700" },
    group_update: { label: "Atualização de Grupo", color: "bg-purple-100 text-purple-700" },
    installation: { label: "Instalação", color: "bg-amber-100 text-amber-700" },
    contract: { label: "Contrato", color: "bg-blue-100 text-blue-700" },
  };

  const routeOptions = [
    { value: "none", label: "Sem redirecionamento" },
    { value: "/family/suporte", label: "Suporte (Tickets)" },
    { value: "/family/payments", label: "Financeiro (Payments)" },
    { value: "/family/contract", label: "Contrato" },
  ];

  const canSend = useMemo(() => {
    const t = String(newNotification.title || "").trim();
    const m = String(newNotification.message || "").trim();
    if (!t || !m) return false;
    return true;
  }, [newNotification]);

  /* =========================
     SEND NOTIFICATION (ONE DOC ONLY)
  ========================= */
  async function handleSendNotification() {
    if (!canSend) return;

    setSending(true);
    try {
      const payload = {
        title: String(newNotification.title || "").trim(),
        message: String(newNotification.message || "").trim(),
        type: newNotification.type || "general",

        // broadcast por role
        target_role: newNotification.target_role || "all",

        // destino (FamilyLayout usa isso para navegar)
        target: {
          route: newNotification.route || "none",
          ticket_id: String(newNotification.ticket_id || "").trim() || null,
          ticket_number: String(newNotification.ticket_number || "").trim() || null,
        },

        // auditoria (opcional)
        created_by: auth?.currentUser?.uid || null,

        created_at: serverTimestamp(),
      };

      await addDoc(collection(db, "AdminNotifications"), payload);

      toast.success("Notificação enviada!");
      setShowNewNotification(false);
      setNewNotification({
        title: "",
        message: "",
        type: "general",
        target_role: "all",
        route: "none",
        ticket_id: "",
        ticket_number: "",
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar notificação");
    } finally {
      setSending(false);
    }
  }

  function fmtWhen(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : null;
      if (!d) return "";
      return d.toLocaleString("pt-BR");
    } catch {
      return "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-slate-600">Envio de comunicados (AdminNotifications)</p>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600"
          onClick={() => setShowNewNotification(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Notificação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Stat icon={Users} label="Famílias" value={loadingUsers ? "—" : countByRole("family")} />
        <Stat icon={Wallet} label="Investidores" value={loadingUsers ? "—" : countByRole("investor")} />
        <Stat icon={Building2} label="Franqueados" value={loadingUsers ? "—" : countByRole("franchise")} />
        <Stat icon={Bell} label="Enviadas" value={loadingNotifs ? "—" : notifications.length} />
      </div>

      {/* Recent */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingNotifs ? (
            <p className="text-center text-slate-500 py-8">Carregando...</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Nenhuma notificação enviada</p>
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 10).map((n) => {
                const type = typeConfig[n.type] || typeConfig.general;
                const role = String(n.target_role || "all").toLowerCase();
                const targetRoute = n?.target?.route || "none";

                return (
                  <div key={n.id} className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium">{n.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${type.color}`}>
                        {type.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white border text-slate-700">
                        Alvo: {role === "all" ? "Todos" : role}
                      </span>
                      {targetRoute !== "none" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white border text-slate-700">
                          Ir para: {targetRoute}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-slate-600">{n.message}</p>

                    <div className="text-xs text-slate-500 mt-2">
                      {n.created_at ? `Enviada: ${fmtWhen(n.created_at)}` : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={showNewNotification} onOpenChange={setShowNewNotification}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Notificação</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={newNotification.title}
                onChange={(e) => setNewNotification((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex.: Atualização do suporte / Pagamento aprovado..."
              />
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea
                rows={4}
                value={newNotification.message}
                onChange={(e) => setNewNotification((p) => ({ ...p, message: e.target.value }))}
                placeholder="Escreva aqui..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <Label>Tipo</Label>
                <Select
                  value={newNotification.type}
                  onValueChange={(v) => setNewNotification((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target role */}
              <div>
                <Label>Enviar para</Label>
                <Select
                  value={newNotification.target_role}
                  onValueChange={(v) => setNewNotification((p) => ({ ...p, target_role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o alvo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="family">Famílias</SelectItem>
                    <SelectItem value="investor">Investidores</SelectItem>
                    <SelectItem value="franchise">Franqueados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Route */}
            <div>
              <Label>Redirecionamento</Label>
              <Select
                value={newNotification.route}
                onValueChange={(v) =>
                  setNewNotification((p) => ({
                    ...p,
                    route: v,
                    ...(v !== "/family/suporte" ? { ticket_id: "", ticket_number: "" } : {}),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a página destino" />
                </SelectTrigger>
                <SelectContent>
                  {routeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                A família ao clicar vai navegar para a rota escolhida.
              </p>
            </div>

            {/* Ticket (optional) */}
            {newNotification.route === "/family/suporte" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>ticket_id (opcional)</Label>
                  <Input
                    value={newNotification.ticket_id}
                    onChange={(e) => setNewNotification((p) => ({ ...p, ticket_id: e.target.value }))}
                    placeholder="Ex.: Firestore doc id"
                  />
                </div>
                <div>
                  <Label>ticket_number (opcional)</Label>
                  <Input
                    value={newNotification.ticket_number}
                    onChange={(e) =>
                      setNewNotification((p) => ({ ...p, ticket_number: e.target.value }))
                    }
                    placeholder="Ex.: 2026000001"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNotification(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              disabled={sending || !canSend}
              onClick={handleSendNotification}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Enviando
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <Icon className="w-8 h-8 mx-auto mb-2 text-slate-500" />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </CardContent>
    </Card>
  );
}

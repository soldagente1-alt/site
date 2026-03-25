import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

import { getFunctions, httpsCallable } from "firebase/functions";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";

import {
  LifeBuoy,
  Plus,
  Search,
  Wrench,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  RefreshCcw,
  Send,
  ExternalLink,
  Upload,
  Paperclip,
  Trash2,
  Camera,
  FolderOpen,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

const FamilyPdfPreview = lazy(() => import("../../components/FamilyPdfPreview"));

const TICKETS_COL = "FamilyTickets";
const functionsClient = getFunctions(undefined, "us-central1");
const createTicketCallable = httpsCallable(functionsClient, "familySupportCreateTicket");
const sendMessageCallable = httpsCallable(functionsClient, "familySupportSendMessage");
const closeTicketCallable = httpsCallable(functionsClient, "familySupportCloseTicket");
const reopenTicketCallable = httpsCallable(functionsClient, "familySupportReopenTicket");

const CATEGORY_OPTIONS = [
  { value: "maintenance", label: "Manutenção" },
  { value: "generation", label: "Geração / Produção" },
  { value: "billing", label: "Conta / Faturamento" },
  { value: "support", label: "Dúvida / Suporte" },
  { value: "contract", label: "Contrato / Documentos" },
  { value: "other", label: "Outros" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "open") return "Aberto";
  if (s === "in_progress") return "Em atendimento";
  if (s === "closed") return "Fechado";
  return s || "—";
}

function statusBadgeVariant(status) {
  const s = String(status || "").toLowerCase();
  if (s === "open") return { className: "bg-amber-100 text-amber-800 border border-amber-200" };
  if (s === "in_progress") return { className: "bg-blue-100 text-blue-800 border border-blue-200" };
  if (s === "closed") return { className: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  return { className: "bg-slate-100 text-slate-700 border border-slate-200" };
}

function priorityBadge(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "urgent") return { text: "Urgente", className: "bg-red-100 text-red-800 border border-red-200" };
  if (p === "high") return { text: "Alta", className: "bg-orange-100 text-orange-800 border border-orange-200" };
  if (p === "medium") return { text: "Média", className: "bg-slate-100 text-slate-700 border border-slate-200" };
  if (p === "low") return { text: "Baixa", className: "bg-slate-50 text-slate-600 border border-slate-200" };
  return { text: "—", className: "bg-slate-100 text-slate-700 border border-slate-200" };
}

function categoryLabel(category) {
  const c = String(category || "").toLowerCase();
  const map = {
    maintenance: "Manutenção",
    generation: "Geração / Produção",
    billing: "Conta / Faturamento",
    support: "Dúvida / Suporte",
    contract: "Contrato / Documentos",
    other: "Outros",
  };
  return map[c] || category || "—";
}

function formatWhen(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
    if (!d) return "";
    return d.toLocaleString("pt-BR");
  } catch {
    return "";
  }
}

function sanitizeFileName(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function isImageType(mime = "") {
  return ["image/jpeg", "image/png", "image/webp"].includes(String(mime || "").toLowerCase());
}

function isPdfType(mime = "", name = "") {
  const m = String(mime || "").toLowerCase();
  if (m === "application/pdf") return true;
  return String(name || "").toLowerCase().endsWith(".pdf");
}

function normalizeLinkAttachment(url) {
  const value = String(url || "").trim();
  if (!value) return null;
  return { type: "link", url: value };
}

export default function FamilySupportCenter() {
  const navigate = useNavigate();
  const location = useLocation();

  const [familyId, setFamilyId] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    category: "maintenance",
    priority: "medium",
    description: "",
    attachmentUrl1: "",
  });

  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentObjectUrl, setAttachmentObjectUrl] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);

  const filePickerRef = useRef(null);
  const cameraPickerRef = useRef(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  const lastDeepLinkKeyRef = useRef("");
  const openedFromDeepLinkRef = useRef(false);

  const messagesBoxRef = useRef(null);
  const replyInputRef = useRef(null);

  const baseTicketsQuery = useMemo(() => {
    if (!familyId) return null;
    return query(
      collection(db, TICKETS_COL),
      where("family_id", "==", familyId),
      orderBy("updated_at", "desc")
    );
  }, [familyId]);

  useEffect(() => {
    return () => {
      try {
        if (attachmentObjectUrl) URL.revokeObjectURL(attachmentObjectUrl);
      } catch (_) {}
    };
  }, [attachmentObjectUrl]);

  useEffect(() => {
    let unsubTickets = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFamilyId(null);
        setTickets([]);
        setSelectedTicket(null);
        setDetailOpen(false);
        setLoading(false);
        return;
      }

      setFamilyId(user.uid);
      setLoading(true);

      try {
        const qTickets = query(
          collection(db, TICKETS_COL),
          where("family_id", "==", user.uid),
          orderBy("updated_at", "desc")
        );

        unsubTickets = onSnapshot(
          qTickets,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setTickets(list);

            if (selectedTicket?.id) {
              const found = list.find((t) => t.id === selectedTicket.id);
              if (found) setSelectedTicket(found);
            }

            setLoading(false);
          },
          (err) => {
            console.warn("onSnapshot tickets falhou:", err);
            setLoading(false);
          }
        );
      } catch (e) {
        console.warn("Falha ao carregar tickets:", e);
        setLoading(false);
      }
    });

    return () => {
      try {
        unsubAuth?.();
      } catch (_) {}
      try {
        unsubTickets?.();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!familyId) return;

    const params = new URLSearchParams(location.search);
    const ticketId = (params.get("ticket") || "").trim();
    const ticketNumber = (params.get("ticket_number") || "").trim();

    if (!ticketId && !ticketNumber) return;

    const key = `${ticketId || ""}|${ticketNumber || ""}`;
    if (lastDeepLinkKeyRef.current === key) return;
    lastDeepLinkKeyRef.current = key;

    async function openById(id) {
      const local = tickets.find((t) => t.id === id);
      if (local) return local;

      try {
        const snap = await getDoc(doc(db, TICKETS_COL, id));
        if (!snap.exists()) return null;
        const data = snap.data();
        if (data?.family_id !== familyId) return null;
        return { id: snap.id, ...data };
      } catch (e) {
        console.warn("Falha openById:", e);
        return null;
      }
    }

    async function openByNumber(num) {
      const local = tickets.find((t) => String(t.ticket_number || "") === num);
      if (local) return local;

      try {
        const qy = query(
          collection(db, TICKETS_COL),
          where("family_id", "==", familyId),
          where("ticket_number", "==", num),
          limit(1)
        );
        const snap = await getDocs(qy);
        if (snap.empty) return null;
        const d = snap.docs[0];
        return { id: d.id, ...d.data() };
      } catch (e) {
        console.warn("Falha openByNumber:", e);
        return null;
      }
    }

    (async () => {
      let found = null;

      if (ticketId) found = await openById(ticketId);
      if (!found && ticketNumber) found = await openByNumber(ticketNumber);

      if (found) {
        openedFromDeepLinkRef.current = true;
        openTicket(found);
        navigate("/family/suporte", { replace: true });
      } else {
        toast.message("Não encontrei esse chamado (talvez não seja seu ou não exista).");
        navigate("/family/suporte", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, location.search, tickets]);

  async function refreshTickets() {
    if (!baseTicketsQuery) return [];
    setRefreshing(true);
    try {
      const snap = await getDocs(baseTicketsQuery);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTickets(list);
      toast.success("Chamados atualizados!");
      return list;
    } catch (err) {
      console.error("Erro no refresh:", err);
      toast.error("Não foi possível atualizar agora.");
      return [];
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let unsubMsg = null;

    async function run() {
      if (!detailOpen || !selectedTicket?.id || !familyId) {
        setMessages([]);
        return;
      }

      setMsgLoading(true);

      try {
        const qMsg = query(
          collection(db, TICKETS_COL, selectedTicket.id, "Messages"),
          orderBy("created_at", "asc")
        );

        unsubMsg = onSnapshot(
          qMsg,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setMessages(list);
            setMsgLoading(false);
          },
          (err) => {
            console.warn("onSnapshot messages falhou:", err);
            setMsgLoading(false);
          }
        );
      } catch (e) {
        console.warn("Falha ao carregar mensagens:", e);
        setMsgLoading(false);
      }
    }

    run();

    return () => {
      try {
        unsubMsg?.();
      } catch (_) {}
    };
  }, [detailOpen, selectedTicket?.id, familyId]);

  useEffect(() => {
    if (!detailOpen) return;
    if (!openedFromDeepLinkRef.current) return;

    const t = setTimeout(() => {
      scrollMessagesToBottom();
      focusReplyInput();
      openedFromDeepLinkRef.current = false;
    }, 50);

    return () => clearTimeout(t);
  }, [detailOpen, messages.length]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => String(t.status).toLowerCase() === "open").length;
    const inProgress = tickets.filter((t) => String(t.status).toLowerCase() === "in_progress").length;
    const closed = tickets.filter((t) => String(t.status).toLowerCase() === "closed").length;
    return { open, inProgress, closed, total: tickets.length };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const s = search.trim().toLowerCase();

    return tickets.filter((t) => {
      const st = String(t.status || "").toLowerCase();
      if (statusFilter !== "all" && st !== statusFilter) return false;

      if (!s) return true;
      const hay = `${t.ticket_number || ""} ${t.title || ""} ${t.description || ""} ${t.category || ""} ${t.priority || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [tickets, statusFilter, search]);

  const quickActions = [
    {
      icon: Wrench,
      title: "Manutenção / Equipamento",
      fill: { category: "maintenance", priority: "medium", title: "Preciso de manutenção no meu kit" },
    },
    {
      icon: AlertTriangle,
      title: "Queda de geração",
      fill: { category: "generation", priority: "high", title: "Minha geração caiu / parou" },
    },
    {
      icon: FileText,
      title: "Conta / Fatura",
      fill: { category: "billing", priority: "medium", title: "Dúvida sobre conta de luz / fatura" },
    },
  ];

  function handlePickAttachment(file) {
    if (!file) return;

    try {
      if (attachmentObjectUrl) URL.revokeObjectURL(attachmentObjectUrl);
    } catch (_) {}

    const MAX_MB = 15;
    const sizeMb = (file.size || 0) / (1024 * 1024);
    if (sizeMb > MAX_MB) {
      toast.error(`Arquivo muito grande. Máx ${MAX_MB}MB.`);
      return;
    }

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (file.type && !allowed.includes(file.type)) {
      toast.error("Formato não permitido. Envie PDF ou imagem (jpg/png/webp).");
      return;
    }

    setAttachmentFile(file);
    setAttachmentProgress(0);

    const url = URL.createObjectURL(file);
    setAttachmentObjectUrl(url);
  }

  function removeAttachment() {
    try {
      if (attachmentObjectUrl) URL.revokeObjectURL(attachmentObjectUrl);
    } catch (_) {}
    setAttachmentObjectUrl(null);
    setAttachmentFile(null);
    setAttachmentProgress(0);
  }

  async function uploadAttachmentFile(file, familyIdForPath) {
    if (!file) return null;

    setUploadingAttachment(true);
    setAttachmentProgress(0);

    const safe = sanitizeFileName(file.name || "anexo");
    const path = `support/attachments/${familyIdForPath}/${Date.now()}_${safe}`;
    const ref = storageRef(storage, path);

    const task = uploadBytesResumable(ref, file, {
      contentType: file.type || "application/octet-stream",
    });

    const url = await new Promise((resolve, reject) => {
      const unsub = task.on(
        "state_changed",
        (snap) => {
          if (!snap.totalBytes) return;
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setAttachmentProgress(pct);
        },
        (err) => {
          unsub?.();
          reject(err);
        },
        async () => {
          unsub?.();
          try {
            const dl = await getDownloadURL(task.snapshot.ref);
            resolve(dl);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    setUploadingAttachment(false);

    return {
      url,
      path,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }

  async function createTicket() {
    if (!familyId) {
      toast.error("Você precisa estar logado.");
      return;
    }

    const title = form.title.trim();
    const description = form.description.trim();

    if (!title || title.length < 6) {
      toast.error("Informe um título com pelo menos 6 caracteres.");
      return;
    }
    if (!description || description.length < 10) {
      toast.error("Descreva o problema com pelo menos 10 caracteres.");
      return;
    }

    setCreating(true);

    try {
      const attachments = [];
      const linkAttachment = normalizeLinkAttachment(form.attachmentUrl1);
      if (linkAttachment) attachments.push(linkAttachment);

      if (attachmentFile) {
        const meta = await uploadAttachmentFile(attachmentFile, familyId);
        if (meta?.url) attachments.push({ type: "file", ...meta });
      }

      const result = await createTicketCallable({
        title,
        description,
        category: form.category || "other",
        priority: form.priority || "medium",
        attachments,
      });

      const createdTicketId = String(result?.data?.ticketId || "").trim();

      toast.success("Chamado criado com sucesso!");
      setNewOpen(false);

      setForm({
        title: "",
        category: "maintenance",
        priority: "medium",
        description: "",
        attachmentUrl1: "",
      });
      removeAttachment();

      const list = await refreshTickets();
      if (createdTicketId) {
        const found = list.find((t) => t.id === createdTicketId) || tickets.find((t) => t.id === createdTicketId);
        if (found) openTicket(found);
      }
    } catch (err) {
      console.error("Erro ao criar chamado:", err);
      toast.error(err?.message || "Não foi possível criar o chamado.");
    } finally {
      setCreating(false);
      setUploadingAttachment(false);
    }
  }

  function openTicket(ticket) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
    setCloseNote("");
    setNewMessage("");
  }

  async function sendMessage() {
    if (!familyId || !selectedTicket?.id) return;

    const text = newMessage.trim();
    if (!text) return;

    setSendingMessage(true);

    try {
      await sendMessageCallable({
        ticketId: selectedTicket.id,
        text,
      });

      setNewMessage("");
      setTimeout(() => {
        scrollMessagesToBottom();
      }, 60);
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast.error("Não foi possível enviar sua mensagem.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function closeTicket() {
    if (!familyId || !selectedTicket?.id) return;

    const st = String(selectedTicket.status || "").toLowerCase();
    if (st === "closed") return;

    const note = closeNote.trim();
    if (note.length < 6) {
      toast.error("Informe um motivo curto (mín. 6 caracteres) para encerrar.");
      return;
    }

    setClosing(true);

    try {
      await closeTicketCallable({
        ticketId: selectedTicket.id,
        note,
      });

      toast.success("Chamado encerrado!");
      setCloseNote("");
    } catch (err) {
      console.error("Erro ao encerrar chamado:", err);
      toast.error("Não foi possível encerrar o chamado.");
    } finally {
      setClosing(false);
    }
  }

  async function reopenTicket() {
    if (!familyId || !selectedTicket?.id) return;

    const st = String(selectedTicket.status || "").toLowerCase();
    if (st !== "closed") return;

    setReopening(true);

    try {
      await reopenTicketCallable({
        ticketId: selectedTicket.id,
      });

      toast.success("Chamado reaberto!");
    } catch (err) {
      console.error("Erro ao reabrir chamado:", err);
      toast.error("Não foi possível reabrir o chamado.");
    } finally {
      setReopening(false);
    }
  }

  function scrollMessagesToBottom() {
    const el = messagesBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function focusReplyInput() {
    const input = replyInputRef.current;
    if (!input) return;
    input.focus();
  }

  const selectedIsClosed = String(selectedTicket?.status || "").toLowerCase() === "closed";

  const hasAttachment = !!attachmentFile;
  const attachmentIsImg = attachmentFile ? isImageType(attachmentFile.type) : false;
  const attachmentIsPdf = attachmentFile ? isPdfType(attachmentFile.type, attachmentFile.name) : false;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90">Central de Chamados</p>
          <h1 className="text-2xl font-bold">Suporte, manutenção e ocorrências</h1>
          <p className="text-sm opacity-90 mt-1">
            Abra um chamado, acompanhe o atendimento e registre tudo por aqui.
          </p>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <LifeBuoy className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard label="Total" value={stats.total} icon={FileText} />
        <MetricCard label="Abertos" value={stats.open} icon={AlertTriangle} />
        <MetricCard label="Em atendimento" value={stats.inProgress} icon={Clock} />
        <MetricCard label="Fechados" value={stats.closed} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-600" />
            Abrir chamado rápido
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3">
          {quickActions.map((qa) => (
            <button
              key={qa.title}
              className="text-left border rounded-xl p-4 hover:bg-slate-50 transition"
              onClick={() => {
                setForm((prev) => ({ ...prev, ...qa.fill }));
                setNewOpen(true);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <qa.icon className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{qa.title}</div>
                  <div className="text-xs text-slate-500">Clique para abrir</div>
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-slate-700" />
              Seus chamados
            </span>

            <div className="flex gap-2">
              <Button variant="outline" onClick={refreshTickets} disabled={refreshing || loading}>
                <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>

              <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => setNewOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo chamado
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-2 items-center w-full sm:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por título, categoria, descrição... (inclui nº do ticket)"
                  className="pl-9"
                />
              </div>

              <select
                className="border rounded-md px-3 py-2 text-sm bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="open">Abertos</option>
                <option value="in_progress">Em atendimento</option>
                <option value="closed">Fechados</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">{filteredTickets.length} exibidos</div>
          </div>

          {loading ? (
            <p className="text-slate-500 text-sm">Carregando chamados...</p>
          ) : filteredTickets.length === 0 ? (
            <div className="border rounded-xl p-6 text-sm text-slate-600 bg-slate-50">
              Você ainda não tem chamados nesse filtro.
              <div className="mt-3">
                <Button onClick={() => setNewOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Abrir meu primeiro chamado
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTickets.map((t) => {
                const st = statusBadgeVariant(t.status);
                const pr = priorityBadge(t.priority);

                return (
                  <button
                    key={t.id}
                    className="text-left border rounded-xl p-4 hover:bg-slate-50 transition"
                    onClick={() => openTicket(t)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{t.title}</span>

                          <Badge variant="secondary">
                            Ticket {t.ticket_number || t.id}
                          </Badge>

                          <Badge className={st.className}>{statusLabel(t.status)}</Badge>
                          <Badge className={pr.className}>{pr.text}</Badge>
                          <Badge variant="secondary">{categoryLabel(t.category)}</Badge>
                        </div>

                        <p className="text-sm text-slate-600 line-clamp-2">{t.description}</p>

                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                          <span>Criado: {formatWhen(t.created_at) || "—"}</span>
                          <span>Atualizado: {formatWhen(t.updated_at) || "—"}</span>
                          {t.last_message_at ? <span>Última mensagem: {formatWhen(t.last_message_at)}</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) {
            setForm({
              title: "",
              category: "maintenance",
              priority: "medium",
              description: "",
              attachmentUrl1: "",
            });
            removeAttachment();
            setUploadingAttachment(false);
            setCreating(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo chamado</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Prioridade</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex.: Inversor apitando / Falha na geração / Dúvida na conta..."
              />
            </div>

            <div>
              <Label>Descrição (quanto mais detalhes, melhor)</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px]"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descreva o problema, quando começou, se aparece erro, se tem foto, etc."
              />
              <p className="text-xs text-slate-500 mt-1">
                Dica: inclua dia/horário, mensagens de erro e o que você já tentou.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Link (opcional)</Label>
                <Input
                  value={form.attachmentUrl1}
                  onChange={(e) => setForm((p) => ({ ...p, attachmentUrl1: e.target.value }))}
                  placeholder="Ex.: https://... (Drive/WhatsApp/Imgur)"
                />
              </div>

              <div className="space-y-2">
                <Label>Anexo (PDF ou imagem) — 1 arquivo</Label>

                <input
                  ref={filePickerRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => handlePickAttachment(e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={creating || uploadingAttachment}
                />
                <input
                  ref={cameraPickerRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handlePickAttachment(e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={creating || uploadingAttachment}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => filePickerRef.current?.click()}
                    disabled={creating || uploadingAttachment}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Selecionar arquivo
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => cameraPickerRef.current?.click()}
                    disabled={creating || uploadingAttachment}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Tirar foto
                  </Button>
                </div>

                {hasAttachment ? (
                  <div className="border rounded-xl p-3 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Paperclip className="w-4 h-4" />
                        <div className="space-y-1">
                          <div className="font-medium break-all">{attachmentFile.name}</div>
                          <div className="text-xs text-slate-500">
                            {attachmentFile.type || "arquivo"} • {(attachmentFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="h-9"
                        onClick={removeAttachment}
                        disabled={creating || uploadingAttachment}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remover
                      </Button>
                    </div>

                    {attachmentObjectUrl ? (
                      <div className="mt-3 overflow-hidden rounded-xl border bg-white">
                        {attachmentIsImg ? (
                          <img
                            src={attachmentObjectUrl}
                            alt="Preview"
                            className="w-full h-44 object-cover"
                          />
                        ) : attachmentIsPdf ? (
                          <div className="p-3">
                            <div className="text-xs text-slate-600 mb-2">
                              Prévia do PDF (1ª página)
                            </div>
                            <Suspense
                              fallback={
                                <div className="text-sm text-slate-500 py-6 text-center">
                                  Carregando prévia do PDF...
                                </div>
                              }
                            >
                              <FamilyPdfPreview file={attachmentObjectUrl} />
                            </Suspense>
                          </div>
                        ) : (
                          <div className="p-4 text-sm text-slate-600 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Arquivo pronto para envio (sem prévia).
                          </div>
                        )}
                      </div>
                    ) : null}

                    {(uploadingAttachment || attachmentProgress > 0) ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                          <span>Upload do anexo</span>
                          <span>{attachmentProgress}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${attachmentProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Envie PDF ou imagem (máx 15MB). No celular, você pode tirar foto direto pela câmera.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setNewOpen(false)}
                disabled={creating || uploadingAttachment}
              >
                Cancelar
              </Button>

              <Button
                className="bg-amber-500 hover:bg-amber-600"
                onClick={createTicket}
                disabled={creating || uploadingAttachment}
              >
                {creating || uploadingAttachment ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-pulse" />
                    Criando...
                  </>
                ) : (
                  "Criar chamado"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedTicket(null);
            setMessages([]);
            setNewMessage("");
            setCloseNote("");
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhes do chamado</DialogTitle>
          </DialogHeader>

          {!selectedTicket ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-xl p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-lg">{selectedTicket.title}</span>
                      <Badge className={statusBadgeVariant(selectedTicket.status).className}>
                        {statusLabel(selectedTicket.status)}
                      </Badge>
                      <Badge className={priorityBadge(selectedTicket.priority).className}>
                        {priorityBadge(selectedTicket.priority).text}
                      </Badge>
                      <Badge variant="secondary">{categoryLabel(selectedTicket.category)}</Badge>
                    </div>

                    <p className="text-sm text-slate-700">{selectedTicket.description}</p>

                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Ticket: <strong>{selectedTicket.ticket_number || selectedTicket.id}</strong>
                      </span>
                      <span>Criado: {formatWhen(selectedTicket.created_at) || "—"}</span>
                      <span>Atualizado: {formatWhen(selectedTicket.updated_at) || "—"}</span>
                    </div>

                    {Array.isArray(selectedTicket.attachments) && selectedTicket.attachments.length > 0 ? (
                      <div className="text-xs text-slate-600 mt-2">
                        <p className="font-medium mb-1">Anexos:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {selectedTicket.attachments.map((a, i) => {
                            const url = typeof a === "string" ? a : a?.url;
                            const label = typeof a === "string" ? a : a?.name || a?.url;
                            if (!url) return null;

                            return (
                              <li key={i}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline break-all"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {label}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {selectedIsClosed && selectedTicket.close_note ? (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
                        <div className="flex items-center gap-2 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Encerrado
                        </div>
                        <div className="text-xs mt-1">
                          Motivo: <strong>{selectedTicket.close_note}</strong>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 min-w-[220px]">
                    {!selectedIsClosed ? (
                      <div className="border rounded-xl p-3 bg-white space-y-2">
                        <div className="text-sm font-medium text-slate-900">Encerrar chamado</div>
                        <Input
                          value={closeNote}
                          onChange={(e) => setCloseNote(e.target.value)}
                          placeholder="Motivo curto (ex.: resolvido)"
                          disabled={closing}
                        />
                        <Button variant="outline" className="w-full" onClick={closeTicket} disabled={closing}>
                          {closing ? (
                            <>Encerrando...</>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-2" />
                              Encerrar
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-slate-500">Se precisar depois, você pode reabrir.</p>
                      </div>
                    ) : (
                      <div className="border rounded-xl p-3 bg-white space-y-2">
                        <div className="text-sm font-medium text-slate-900">Chamado fechado</div>
                        <Button className="w-full" onClick={reopenTicket} disabled={reopening}>
                          {reopening ? (
                            <>Reabrindo...</>
                          ) : (
                            <>
                              <RefreshCcw className="w-4 h-4 mr-2" />
                              Reabrir
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-slate-500">Reabrir volta para “Aberto”.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Conversa do chamado
                  </div>
                  <div className="text-xs text-slate-500">
                    {msgLoading ? "Carregando..." : `${messages.length} mensagem(ns)`}
                  </div>
                </div>

                <div ref={messagesBoxRef} className="max-h-[360px] overflow-auto space-y-2 pr-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem mensagens ainda.</p>
                  ) : (
                    messages.map((m) => {
                      const role = String(m.author_role || "system").toLowerCase();
                      const isFamily = role === "family";
                      const isAdmin = role === "admin";
                      const bubble = isFamily
                        ? "bg-amber-50 border-amber-200"
                        : isAdmin
                        ? "bg-blue-50 border-blue-200"
                        : "bg-slate-50 border-slate-200";

                      const label = isFamily ? "Você" : isAdmin ? "Equipe" : "Sistema";

                      return (
                        <div key={m.id} className={`border rounded-xl p-3 ${bubble}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-slate-700">{label}</div>
                            <div className="text-[11px] text-slate-500">{formatWhen(m.created_at)}</div>
                          </div>
                          <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{m.text}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t pt-3">
                  <Label>Nova mensagem</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      ref={replyInputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={selectedIsClosed ? "Chamado fechado. Reabra para enviar mensagens." : "Escreva aqui..."}
                      disabled={sendingMessage || selectedIsClosed}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage();
                      }}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={sendingMessage || selectedIsClosed || !newMessage.trim()}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Enviar
                    </Button>
                  </div>

                  {selectedIsClosed ? (
                    <p className="text-xs text-slate-500 mt-2">
                      Este chamado está fechado. Para conversar novamente, clique em <strong>Reabrir</strong>.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="font-bold text-2xl">{value}</p>
        </div>
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}

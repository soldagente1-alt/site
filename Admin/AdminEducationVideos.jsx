import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import {
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Eye,
  EyeOff,
  Search,
  ArrowUpDown,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "sonner";

const COL = "Family_Educations";

const emptyForm = {
  order: 1,
  category: "",
  active: true,
  title: "",
  description: "",
  duration: "",
  thumbnail: "",
  video_url: "",
};

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminEducationVideos() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);

  const [videos, setVideos] = useState([]);

  // filtros
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | active | inactive
  const [categoryFilter, setCategoryFilter] = useState("all");

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // edição/criação
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  /* =========================
     AUTH
  ========================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
    });
    return () => {
      try { unsub?.(); } catch (_) {}
    };
  }, []);

  /* =========================
     LOAD
  ========================= */
  async function loadAll() {
    setLoading(true);
    try {
      const qy = query(collection(db, COL), orderBy("order", "asc"));
      const snap = await getDocs(qy);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => safeNum(a.order, 9999) - safeNum(b.order, 9999));
      setVideos(list);
    } catch (err) {
      console.error("Erro ao carregar vídeos:", err);
      toast.error("Erro ao carregar vídeos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  /* =========================
     DERIVED
  ========================= */
  const categories = useMemo(() => {
    const set = new Set();
    videos.forEach((v) => {
      if (v?.category) set.add(String(v.category));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [videos]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    return videos.filter((v) => {
      const okSearch =
        !s ||
        String(v.title || "").toLowerCase().includes(s) ||
        String(v.description || "").toLowerCase().includes(s) ||
        String(v.category || "").toLowerCase().includes(s);

      const okActive =
        activeFilter === "all"
          ? true
          : activeFilter === "active"
          ? v.active === true
          : v.active === false;

      const okCat =
        categoryFilter === "all"
          ? true
          : String(v.category || "") === String(categoryFilter);

      return okSearch && okActive && okCat;
    });
  }, [videos, search, activeFilter, categoryFilter]);

  /* =========================
     MODAL CONTROL
  ========================= */
  function openNew() {
    setEditingId(null);

    const nextOrder = videos.length
      ? Math.max(...videos.map((v) => safeNum(v.order, 0))) + 1
      : 1;

    setForm({
      ...emptyForm,
      order: nextOrder,
      active: true,
    });

    setOpenModal(true);
  }

  function openEdit(video) {
    setEditingId(video.id);
    setForm({
      order: safeNum(video.order, 1),
      category: video.category || "",
      active: video.active === true,
      title: video.title || "",
      description: video.description || "",
      duration: video.duration || "",
      thumbnail: video.thumbnail || "",
      video_url: video.video_url || "",
    });
    setOpenModal(true);
  }

  function closeModal() {
    setOpenModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  /* =========================
     CRUD
  ========================= */
  async function saveVideo() {
    if (saving) return;

    if (!String(form.title || "").trim()) {
      toast.error("Informe o título.");
      return;
    }
    if (!String(form.category || "").trim()) {
      toast.error("Informe a categoria.");
      return;
    }
    const ord = safeNum(form.order, NaN);
    if (!Number.isFinite(ord)) {
      toast.error("Order precisa ser um número.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        order: ord,
        category: String(form.category || "").trim(),
        active: !!form.active,
        title: String(form.title || "").trim(),
        description: String(form.description || "").trim(),
        duration: String(form.duration || "").trim(),
        thumbnail: String(form.thumbnail || "").trim(),
        video_url: String(form.video_url || "").trim(),
        updated_at: serverTimestamp(),
      };

      if (!editingId) {
        await addDoc(collection(db, COL), {
          ...payload,
          created_by: uid || null,
          create_date: serverTimestamp(),
        });
        toast.success("Vídeo cadastrado!");
      } else {
        await updateDoc(doc(db, COL, editingId), payload);
        toast.success("Vídeo atualizado!");
      }

      closeModal();
      await loadAll();
    } catch (err) {
      console.error("Erro ao salvar vídeo:", err);
      toast.error("Erro ao salvar vídeo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(video) {
    try {
      await updateDoc(doc(db, COL, video.id), {
        active: !(video.active === true),
        updated_at: serverTimestamp(),
      });
      toast.success(video.active ? "Vídeo desativado" : "Vídeo ativado");
      await loadAll();
    } catch (err) {
      console.error("Erro ao alternar active:", err);
      toast.error("Erro ao atualizar status.");
    }
  }

  async function removeVideo(video) {
    const ok = window.confirm(`Excluir o vídeo:\n\n${video.title || "(sem título)"}\n\nTem certeza?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, COL, video.id));
      toast.success("Vídeo excluído!");
      await loadAll();
    } catch (err) {
      console.error("Erro ao excluir:", err);
      toast.error("Erro ao excluir vídeo.");
    }
  }

  if (loading) return <p>Carregando vídeos...</p>;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Vídeos</h1>
          <p className="text-slate-600">
            Gerencie os vídeos da Central de Aprendizado (collection <code>{COL}</code>).
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAll}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button className="bg-amber-500 hover:bg-amber-600" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo vídeo
          </Button>
        </div>
      </div>

      {/* FILTERS */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, descrição ou categoria..."
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                onClick={() => setActiveFilter("all")}
              >
                Todos
              </Button>
              <Button
                variant={activeFilter === "active" ? "default" : "outline"}
                onClick={() => setActiveFilter("active")}
              >
                Ativos
              </Button>
              <Button
                variant={activeFilter === "inactive" ? "default" : "outline"}
                onClick={() => setActiveFilter("inactive")}
              >
                Inativos
              </Button>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-slate-400" />
                <select
                  className="border rounded-md px-2 py-2 text-sm bg-white"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Todas categorias</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Total: <strong>{filtered.length}</strong> (de {videos.length})
          </div>
        </CardContent>
      </Card>

      {/* LIST */}
      <Card>
        <CardHeader>
          <CardTitle>Vídeos</CardTitle>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Order</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Status</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Categoria</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Título</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Duração</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-500">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Nenhum vídeo encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-700">{safeNum(v.order, 0)}</td>

                    <td className="py-3 px-4">
                      {v.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Ativo</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700">Inativo</Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-sm text-slate-700">{v.category || "-"}</td>

                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{v.title || "-"}</p>
                      {v.description ? (
                        <p className="text-xs text-slate-500 line-clamp-1">{v.description}</p>
                      ) : (
                        <p className="text-xs text-slate-400">Sem descrição</p>
                      )}
                    </td>

                    <td className="py-3 px-4 text-sm text-slate-700">{v.duration || "-"}</td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(v)}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => toggleActive(v)}>
                          {v.active ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-1" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              Ativar
                            </>
                          )}
                        </Button>

                        <Button variant="destructive" size="sm" onClick={() => removeVideo(v)}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* MODAL CREATE/EDIT */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar vídeo" : "Novo vídeo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Order</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                  placeholder="Ex: 1"
                />
              </div>

              <div>
                <Label>Duração</Label>
                <Input
                  value={form.duration}
                  onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                  placeholder="Ex: 03:20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  placeholder="Ex: Básico"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant={form.active ? "default" : "outline"}
                  onClick={() => setForm((p) => ({ ...p, active: true }))}
                >
                  Ativo
                </Button>
                <Button
                  type="button"
                  variant={!form.active ? "default" : "outline"}
                  onClick={() => setForm((p) => ({ ...p, active: false }))}
                >
                  Inativo
                </Button>
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Como funciona o seu kit solar"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <textarea
                className="w-full min-h-[90px] border rounded-md px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descreva o conteúdo..."
              />
            </div>

            <div>
              <Label>Thumbnail (URL)</Label>
              <Input
                value={form.thumbnail}
                onChange={(e) => setForm((p) => ({ ...p, thumbnail: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div>
              <Label>Video URL (YouTube/Vimeo/MP4/Storage URL)</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                placeholder="https://..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Campo: <code>video_url</code> (necessário pro player tocar)
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => closeModal()} disabled={saving}>
              Cancelar
            </Button>

            <Button className="bg-amber-500 hover:bg-amber-600" onClick={saveVideo} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar vídeo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

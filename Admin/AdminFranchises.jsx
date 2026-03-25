import React, { useEffect, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import {
  Building2,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Phone,
  Download,
  MoreVertical,
  MapPin
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../../components/ui/dropdown-menu";

export default function AdminFranchises() {
  const [franchises, setFranchises] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFranchise, setSelectedFranchise] = useState(null);

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) return;

      const snap = await getDocs(collection(db, "franchises"));
      setFranchises(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  /* =========================
     UPDATE STATUS
  ========================= */
  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "franchises", id), { status });

    setFranchises(prev =>
      prev.map(f => (f.id === id ? { ...f, status } : f))
    );
  };

  /* =========================
     FILTERS
  ========================= */
  const filteredFranchises = franchises.filter(f => {
    const matchSearch =
      f.name?.toLowerCase().includes(search.toLowerCase()) ||
      f.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.city?.toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      statusFilter === "all" || f.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const statusConfig = {
    pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
    approved: { label: "Aprovado", color: "bg-blue-100 text-blue-700" },
    active: { label: "Ativo", color: "bg-green-100 text-green-700" },
    suspended: { label: "Suspenso", color: "bg-red-100 text-red-700" }
  };

  const totalFamilies = franchises.reduce(
    (a, f) => a + (f.total_families || 0),
    0
  );
  const totalKits = franchises.reduce(
    (a, f) => a + (f.kits_installed || 0),
    0
  );

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Franquias</h1>
          <p className="text-slate-600">
            {franchises.length} franquias cadastradas
          </p>
        </div>

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* STATS */}
      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard title="Total" value={franchises.length} />
        <StatCard
          title="Ativas"
          value={franchises.filter(f => f.status === "active").length}
        />
        <StatCard title="Famílias" value={totalFamilies} />
        <StatCard title="Kits Instalados" value={totalKits} />
      </div>

      {/* FILTERS */}
      <Card>
        <CardContent className="p-4 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Buscar por nome, proprietário ou cidade..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* TABLE */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="p-3 text-left">Franquia</th>
                <th className="p-3 text-left">Local</th>
                <th className="p-3 text-right">Famílias</th>
                <th className="p-3 text-right">Grupos</th>
                <th className="p-3 text-right">Kits</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredFranchises.map(f => {
                const status = statusConfig[f.status] || statusConfig.pending;

                return (
                  <tr key={f.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-slate-500">
                        {f.owner_name}
                      </p>
                    </td>
                    <td className="p-3 text-sm text-slate-600">
                      <MapPin className="inline w-3 h-3 mr-1" />
                      {f.city} - {f.state}
                    </td>
                    <td className="p-3 text-right">{f.total_families || 0}</td>
                    <td className="p-3 text-right">{f.active_groups || 0}</td>
                    <td className="p-3 text-right">{f.kits_installed || 0}</td>
                    <td className="p-3">
                      <Badge className={status.color}>{status.label}</Badge>
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedFranchise(f)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>

                          {f.status === "pending" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(f.id, "approved")}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                          )}

                          {f.status === "approved" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(f.id, "active")}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                              Ativar
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `https://wa.me/55${f.phone?.replace(/\D/g, "")}`,
                                "_blank"
                              )
                            }
                          >
                            <Phone className="w-4 h-4 mr-2" />
                            WhatsApp
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* MODAL */}
      <Dialog
        open={!!selectedFranchise}
        onOpenChange={() => setSelectedFranchise(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Franquia</DialogTitle>
          </DialogHeader>

          {selectedFranchise && (
            <div className="space-y-4">
              <p><b>Nome:</b> {selectedFranchise.name}</p>
              <p><b>Proprietário:</b> {selectedFranchise.owner_name}</p>
              <p><b>Email:</b> {selectedFranchise.email}</p>
              <p><b>Telefone:</b> {selectedFranchise.phone}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================
   SMALL STAT CARD
========================= */
function StatCard({ title, value }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-slate-500">{title}</p>
      </CardContent>
    </Card>
  );
}

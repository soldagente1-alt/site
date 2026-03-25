import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Filter,
  Plus,
  Eye,
  Phone,
  MapPin,
  CheckCircle2,
  Clock
} from 'lucide-react';

import { auth } from '../../api/firebaseAuth';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../api/firebaseDb';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';

export default function FranchiseFamilies() {
  const [families, setFamilies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      /** 🔹 Buscar famílias */
      const familiesQuery = query(
        collection(db, 'families'),
        where('franchiseId', '==', user.uid)
      );
      const familiesSnap = await getDocs(familiesQuery);
      const familiesData = familiesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFamilies(familiesData);

      /** 🔹 Buscar grupos */
      const groupsQuery = query(
        collection(db, 'groups'),
        where('franchiseId', '==', user.uid)
      );
      const groupsSnap = await getDocs(groupsQuery);
      setGroups(
        groupsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar famílias', error);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig = {
    pending: {
      label: 'Pendente',
      color: 'bg-yellow-100 text-yellow-700',
      icon: Clock
    },
    approved: {
      label: 'Aprovado',
      color: 'bg-blue-100 text-blue-700',
      icon: CheckCircle2
    },
    in_group: {
      label: 'Em grupo',
      color: 'bg-purple-100 text-purple-700',
      icon: Users
    },
    active: {
      label: 'Kit ativo',
      color: 'bg-green-100 text-green-700',
      icon: CheckCircle2
    },
    completed: {
      label: 'Quitado',
      color: 'bg-emerald-100 text-emerald-700',
      icon: CheckCircle2
    }
  };

  const filteredFamilies = families.filter(family => {
    const matchesSearch =
      family.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      family.cpf?.includes(search) ||
      family.phone?.includes(search);

    const matchesStatus =
      statusFilter === 'all' || family.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getGroupName = groupId => {
    const group = groups.find(g => g.id === groupId);
    return group?.name || '-';
  };

  if (loading) {
    return <p className="text-slate-500">Carregando famílias...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Famílias</h1>
          <p className="text-slate-600">
            Gerencie as famílias cadastradas na sua região
          </p>
        </div>
        <Button className="bg-purple-500 hover:bg-purple-600">
          <Plus className="w-4 h-4 mr-2" />
          Nova Família
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Stat title="Total" value={families.length} />
        <Stat
          title="Pendentes"
          value={families.filter(f => f.status === 'pending').length}
          color="text-yellow-600"
        />
        <Stat
          title="Em Grupo"
          value={families.filter(f => f.status === 'in_group').length}
          color="text-purple-600"
        />
        <Stat
          title="Ativos"
          value={
            families.filter(
              f => f.status === 'active' || f.status === 'completed'
            ).length
          }
          color="text-green-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CPF ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="in_group">Em grupo</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="completed">Quitados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Users className="inline w-5 h-5 mr-2 text-purple-500" />
            Famílias ({filteredFamilies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFamilies.length === 0 ? (
            <p className="text-center text-slate-500 py-12">
              Nenhuma família encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {filteredFamilies.map((family, i) => {
                const status =
                  statusConfig[family.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={family.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border rounded-xl p-4"
                  >
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold">{family.full_name}</p>
                        <p className="text-sm text-slate-500">
                          CPF: {family.cpf}
                        </p>
                        <div className="flex gap-4 text-sm mt-2 text-slate-600">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {family.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {family.address?.city}
                          </span>
                          {family.groupId && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {getGroupName(family.groupId)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedFamily(family)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog
        open={!!selectedFamily}
        onOpenChange={() => setSelectedFamily(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Família</DialogTitle>
          </DialogHeader>

          {selectedFamily && (
            <div className="space-y-3">
              <p>
                <strong>Nome:</strong> {selectedFamily.full_name}
              </p>
              <p>
                <strong>Telefone:</strong> {selectedFamily.phone}
              </p>
              <p>
                <strong>CPF:</strong> {selectedFamily.cpf}
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://wa.me/55${selectedFamily.phone.replace(/\D/g, '')}`,
                    '_blank'
                  )
                }
              >
                WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* 🔹 Stat Component */
function Stat({ title, value, color = 'text-slate-900' }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-sm text-slate-500">{title}</p>
      </CardContent>
    </Card>
  );
}

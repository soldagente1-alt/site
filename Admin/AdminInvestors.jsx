import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../api/firebaseDb';
import {
  Wallet, Search, Filter, Eye, CheckCircle2,
  Phone, Download, MoreVertical
} from 'lucide-react';

import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

import { toast } from 'sonner';

export default function AdminInvestors() {
  const [investors, setInvestors] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvestors();
  }, []);

  const loadInvestors = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'investor')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvestors(data);
    } catch (err) {
      toast.error('Erro ao carregar investidores');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, 'users', id), { status });
      toast.success('Status atualizado');
      loadInvestors();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const statusConfig = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
    active: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
    inactive: { label: 'Inativo', color: 'bg-slate-100 text-slate-700' }
  };

  const filteredInvestors = investors.filter(inv => {
    const text =
      inv.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.cpf_cnpj?.includes(search) ||
      inv.email?.toLowerCase().includes(search.toLowerCase());

    const statusOk = statusFilter === 'all' || inv.status === statusFilter;
    return text && statusOk;
  });

  const totalInvested = investors.reduce((acc, i) => acc + (i.total_invested || 0), 0);
  const totalKits = investors.reduce((acc, i) => acc + (i.kits_funded || 0), 0);

  if (loading) {
    return <p className="text-center text-slate-500">Carregando investidores...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Investidores</h1>
          <p className="text-slate-600">{investors.length} investidores cadastrados</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="bg-sky-50 border-sky-200">
          <CardContent className="p-4 flex gap-3 items-center">
            <Wallet className="w-8 h-8 text-sky-500" />
            <div>
              <p className="text-2xl font-bold text-sky-700">
                R$ {totalInvested.toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-sky-600">Total Investido</p>
            </div>
          </CardContent>
        </Card>

        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{investors.length}</p>
          <p className="text-sm text-slate-500">Total</p>
        </CardContent></Card>

        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {investors.filter(i => i.status === 'active').length}
          </p>
          <p className="text-sm text-slate-500">Ativos</p>
        </CardContent></Card>

        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{totalKits}</p>
          <p className="text-sm text-slate-500">Kits Financiados</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ ou email..."
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
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Investidor</th>
                <th className="px-4 py-3 text-left">Contato</th>
                <th className="px-4 py-3 text-right">Investido</th>
                <th className="px-4 py-3 text-right">Kits</th>
                <th className="px-4 py-3 text-right">Retorno/mês</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestors.map(inv => {
                const status = statusConfig[inv.status] || statusConfig.pending;
                return (
                  <tr key={inv.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{inv.full_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <p>{inv.email}</p>
                      <p className="text-slate-500">{inv.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      R$ {(inv.total_invested || 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right">{inv.kits_funded || 0}</td>
                    <td className="px-4 py-3 text-right text-green-600">
                      R$ {(inv.monthly_return || 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={status.color}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedInvestor(inv)}>
                            <Eye className="w-4 h-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          {inv.status === 'pending' && (
                            <DropdownMenuItem onClick={() => updateStatus(inv.id, 'active')}>
                              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => window.open(`https://wa.me/55${inv.phone}`, '_blank')}
                          >
                            <Phone className="w-4 h-4 mr-2" /> WhatsApp
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

      {/* Modal */}
      <Dialog open={!!selectedInvestor} onOpenChange={() => setSelectedInvestor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Investidor</DialogTitle>
          </DialogHeader>
          {selectedInvestor && (
            <div className="space-y-3">
              <p><strong>Nome:</strong> {selectedInvestor.full_name}</p>
              <p><strong>Email:</strong> {selectedInvestor.email}</p>
              <p><strong>Telefone:</strong> {selectedInvestor.phone}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

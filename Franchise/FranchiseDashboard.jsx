import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils/createPageUrl';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  Sun,
  ArrowRight,
  BarChart3,
  DollarSign,
  MapPin,
  CheckCircle2
} from 'lucide-react';

import { auth } from '../../api/firebaseAuth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../api/firebaseDb';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';

export default function FranchiseDashboard() {
  const [franchise, setFranchise] = useState(null);
  const [families, setFamilies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      /** 🔹 Franquia */
      const franchiseRef = doc(db, 'franchises', user.uid);
      const franchiseSnap = await getDoc(franchiseRef);

      if (!franchiseSnap.exists()) return;

      const franchiseData = {
        id: franchiseSnap.id,
        ...franchiseSnap.data()
      };

      setFranchise(franchiseData);

      /** 🔹 Famílias */
      const familiesQuery = query(
        collection(db, 'families'),
        where('franchiseId', '==', franchiseSnap.id)
      );
      const familiesSnap = await getDocs(familiesQuery);
      setFamilies(
        familiesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );

      /** 🔹 Grupos */
      const groupsQuery = query(
        collection(db, 'groups'),
        where('franchiseId', '==', franchiseSnap.id)
      );
      const groupsSnap = await getDocs(groupsQuery);
      setGroups(
        groupsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );

    } catch (error) {
      console.error('Erro ao carregar dashboard da franquia', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-slate-500">Carregando painel...</p>;
  }

  if (!franchise) {
    return <p className="text-red-500">Franquia não encontrada</p>;
  }

  const totalFamilies = families.length;
  const activeGroups = groups.filter(g => g.status !== 'completed').length;
  const kitsInstalled = families.filter(
    f => f.status === 'active' || f.status === 'completed'
  ).length;
  const totalCommission = franchise.totalCommission || 0;

  const stats = [
    {
      title: 'Famílias Cadastradas',
      value: totalFamilies,
      icon: Users,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Grupos Ativos',
      value: activeGroups,
      icon: Sun,
      color: 'bg-amber-100 text-amber-600'
    },
    {
      title: 'Kits Instalados',
      value: kitsInstalled,
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'Comissões',
      value: `R$ ${totalCommission.toLocaleString('pt-BR')}`,
      icon: DollarSign,
      color: 'bg-sky-100 text-sky-600'
    }
  ];

  const groupStatus = {
    forming: { label: 'Em formação', color: 'bg-yellow-100 text-yellow-700' },
    fundraising: { label: 'Em captação', color: 'bg-blue-100 text-blue-700' },
    installing: { label: 'Em instalação', color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Concluído', color: 'bg-green-100 text-green-700' }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex justify-between">
          <div>
            <p className="text-purple-100 text-sm">Painel do Franqueado</p>
            <h1 className="text-2xl font-bold">{franchise.name}</h1>
            <div className="flex items-center gap-2 text-sm text-purple-100 mt-1">
              <MapPin className="w-4 h-4" />
              {franchise.city} - {franchise.state}
            </div>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{stat.title}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Grupos */}
      <Card>
        <CardHeader className="flex justify-between flex-row items-center">
          <CardTitle>Grupos em Andamento</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={createPageUrl('FranchiseGroups')}>
              Ver todos <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-slate-500 text-center">Nenhum grupo criado</p>
          ) : (
            groups.slice(0, 3).map(group => {
              const status = groupStatus[group.status] || groupStatus.forming;
              const progress =
                (group.currentParticipants / group.maxParticipants) * 100;

              return (
                <div key={group.id} className="border rounded-xl p-4 mb-3">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-sm text-slate-500">
                        {group.city} - {group.state}
                      </p>
                    </div>
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useEffect, useState } from 'react'; 
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../../api/firebaseDb';

import { 
  Sun, Plus, Edit, Power, Zap,
  CheckCircle2, XCircle
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [families, setFamilies] = useState([]);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPlanForAssign, setSelectedPlanForAssign] = useState(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');

  const [planData, setPlanData] = useState({
    name: '',
    description: '',
    kit_value: '',
    monthly_payment: '',
    number_of_installments: 120,
    kit_power: '',
    panel_quantity: '',
    panel_model: '',
    inverter_model: '',
    average_generation: '',
    warranty_years: 25,
    status: 'active',
    recommended_for: ''
  });

  /* =========================
     LOADERS
  ========================= */

  async function loadPlans() {
    const q = query(
      collection(db, 'Familyplans'),
      orderBy('created_date', 'desc')
    );
    const snapshot = await getDocs(q);
    setPlans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadFamilies() {
    const q = query(
      collection(db, 'Family'),
      orderBy('created_date', 'desc')
    );
    const snapshot = await getDocs(q);
    setFamilies(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    loadPlans();
    loadFamilies();
  }, []);

  /* =========================
     ACTIONS
  ========================= */

  async function handleSave() {
    const payload = {
      ...planData,
      kit_value: parseFloat(planData.kit_value),
      monthly_payment: parseFloat(planData.monthly_payment),
      panel_quantity: planData.panel_quantity ? parseInt(planData.panel_quantity) : null,
      average_generation: planData.average_generation ? parseFloat(planData.average_generation) : null,
      number_of_installments: parseInt(planData.number_of_installments),
      warranty_years: parseInt(planData.warranty_years)
    };

    if (editingPlan) {
      await updateDoc(doc(db, 'Familyplans', editingPlan.id), payload);
      toast.success('Plano atualizado!');
    } else {
      await addDoc(collection(db, 'Familyplans'), {
        ...payload,
        created_date: new Date()
      });
      toast.success('Plano criado!');
    }

    resetForm();
    loadPlans();
  }

  async function assignPlan() {
    const plan = plans.find(p => p.id === selectedPlanForAssign.id);

    await updateDoc(
      doc(db, 'family', selectedFamilyId),
      {
        plan_id: plan.id,
        kit_value: plan.kit_value,
        monthly_payment: plan.monthly_payment
      }
    );

    toast.success('Plano atribuído à família!');
    setShowAssignModal(false);
    setSelectedFamilyId('');
    loadFamilies();
  }

  async function toggleStatus(id, status) {
    await updateDoc(doc(db, 'Familyplans', id), { status });
    toast.success('Status atualizado!');
    loadPlans();
  }

  /* =========================
     HELPERS (INALTERADOS)
  ========================= */

  const resetForm = () => {
    setPlanData({
      name: '',
      description: '',
      kit_value: '',
      monthly_payment: '',
      number_of_installments: 120,
      kit_power: '',
      panel_quantity: '',
      panel_model: '',
      inverter_model: '',
      average_generation: '',
      warranty_years: 25,
      status: 'active',
      recommended_for: ''
    });
    setEditingPlan(null);
    setShowPlanModal(false);
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setPlanData(plan);
    setShowPlanModal(true);
  };

  const activePlans = plans.filter(p => p.status === 'active');
  const inactivePlans = plans.filter(p => p.status === 'inactive');

  /* =========================
     JSX
     ⛔ NÃO ALTERADO
  ========================= */


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Planos</h1>
          <p className="text-slate-600">Crie e gerencie os planos de energia solar</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => setShowPlanModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Sun className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{plans.length}</p>
            <p className="text-sm text-slate-500">Total de Planos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{activePlans.length}</p>
            <p className="text-sm text-slate-500">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-600">{inactivePlans.length}</p>
            <p className="text-sm text-slate-500">Inativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            Planos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activePlans.length === 0 ? (
            <div className="text-center py-12">
              <Sun className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum plano ativo</p>
              <Button className="mt-4 bg-amber-500 hover:bg-amber-600" onClick={() => setShowPlanModal(true)}>
                Criar Primeiro Plano
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePlans.map((plan) => (
                <Card key={plan.id} className="border-2 hover:border-amber-200 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">{plan.name}</h3>
                        <p className="text-xs text-slate-500">{plan.description}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Valor do Kit</span>
                        <span className="font-bold text-green-600">R$ {plan.kit_value?.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Parcela Mensal</span>
                        <span className="font-bold text-amber-600">R$ {plan.monthly_payment?.toLocaleString('pt-BR')}</span>
                      </div>
                      {plan.kit_power && (
                        <div className="flex items-center gap-2 text-sm">
                          <Power className="w-4 h-4 text-amber-500" />
                          <span className="text-slate-600">{plan.kit_power}</span>
                        </div>
                      )}
                      {plan.average_generation && (
                        <div className="flex items-center gap-2 text-sm">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span className="text-slate-600">{plan.average_generation} kWh/mês</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(plan)}>
                        <Edit className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 bg-amber-500 hover:bg-amber-600"
                        onClick={() => {
                          setSelectedPlanForAssign(plan);
                          setShowAssignModal(true);
                        }}
                      >
                        Atribuir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Plans */}
      {inactivePlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-500">
              <XCircle className="w-5 h-5" />
              Planos Inativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactivePlans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <h4 className="font-medium text-slate-700">{plan.name}</h4>
                    <p className="text-sm text-slate-500">R$ {plan.kit_value?.toLocaleString('pt-BR')} - {plan.number_of_installments}x de R$ {plan.monthly_payment?.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(plan)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-green-500 hover:bg-green-600"
                      onClick={() => toggleStatus(plan.id, 'active')}
                    >
                      Ativar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Modal */}
      <Dialog open={showPlanModal} onOpenChange={resetForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome do Plano *</Label>
                <Input
                  value={planData.name}
                  onChange={(e) => setPlanData({ ...planData, name: e.target.value })}
                  placeholder="Ex: Plano Básico"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={planData.status} onValueChange={(value) => setPlanData({ ...planData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={planData.description}
                onChange={(e) => setPlanData({ ...planData, description: e.target.value })}
                placeholder="Descrição do plano..."
                rows={2}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Valor do Kit *</Label>
                <Input
                  type="number"
                  value={planData.kit_value}
                  onChange={(e) => setPlanData({ ...planData, kit_value: e.target.value })}
                  placeholder="5500"
                />
              </div>
              <div>
                <Label>Parcela Mensal *</Label>
                <Input
                  type="number"
                  value={planData.monthly_payment}
                  onChange={(e) => setPlanData({ ...planData, monthly_payment: e.target.value })}
                  placeholder="150"
                />
              </div>
              <div>
                <Label>Nº de Parcelas</Label>
                <Input
                  type="number"
                  value={planData.number_of_installments}
                  onChange={(e) => setPlanData({ ...planData, number_of_installments: e.target.value })}
                  placeholder="120"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Potência do Kit</Label>
                <Input
                  value={planData.kit_power}
                  onChange={(e) => setPlanData({ ...planData, kit_power: e.target.value })}
                  placeholder="3.2 kWp"
                />
              </div>
              <div>
                <Label>Geração Média (kWh/mês)</Label>
                <Input
                  type="number"
                  value={planData.average_generation}
                  onChange={(e) => setPlanData({ ...planData, average_generation: e.target.value })}
                  placeholder="400"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Qtd. Painéis</Label>
                <Input
                  type="number"
                  value={planData.panel_quantity}
                  onChange={(e) => setPlanData({ ...planData, panel_quantity: e.target.value })}
                  placeholder="8"
                />
              </div>
              <div>
                <Label>Modelo Painéis</Label>
                <Input
                  value={planData.panel_model}
                  onChange={(e) => setPlanData({ ...planData, panel_model: e.target.value })}
                  placeholder="550W Monocristalino"
                />
              </div>
              <div>
                <Label>Modelo Inversor</Label>
                <Input
                  value={planData.inverter_model}
                  onChange={(e) => setPlanData({ ...planData, inverter_model: e.target.value })}
                  placeholder="Growatt 3000W"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Anos de Garantia</Label>
                <Input
                  type="number"
                  value={planData.warranty_years}
                  onChange={(e) => setPlanData({ ...planData, warranty_years: e.target.value })}
                  placeholder="25"
                />
              </div>
              <div>
                <Label>Recomendado Para</Label>
                <Input
                  value={planData.recommended_for}
                  onChange={(e) => setPlanData({ ...planData, recommended_for: e.target.value })}
                  placeholder="Conta até R$ 300"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600"
              onClick={handleSave}
              disabled={!planData.name || !planData.kit_value || !planData.monthly_payment}
            >
              {editingPlan ? 'Atualizar' : 'Criar'} Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Plan Modal */}
      <Dialog open={showAssignModal} onOpenChange={() => setShowAssignModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Plano à Família</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pb-6">
            {selectedPlanForAssign && (
              <div className="p-4 bg-amber-50 rounded-xl">
                <h4 className="font-semibold text-amber-900 mb-2">{selectedPlanForAssign.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-amber-600">Valor:</span>
                    <span className="ml-2 font-medium">R$ {selectedPlanForAssign.kit_value?.toLocaleString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className="text-amber-600">Parcela:</span>
                    <span className="ml-2 font-medium">R$ {selectedPlanForAssign.monthly_payment?.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Selecione a Família</Label>
              <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma família..." />
                </SelectTrigger>
                <SelectContent>
                  {families.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.full_name} - {family.address?.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancelar</Button>
              <Button 
                className="bg-amber-500 hover:bg-amber-600"
                onClick={assignPlan}
                disabled={!selectedFamilyId}              
                >
                Atribuir Plano
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
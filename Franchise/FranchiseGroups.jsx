import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { format } from "date-fns";
import {
  Sun,
  Plus,
  Users,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  Wrench,
  MapPin,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

export default function FranchiseGroups() {
  const [userData, setUserData] = useState(null);
  const [franchiseData, setFranchiseData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);

  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const uData = userSnap.data();
      setUserData(uData);

      if (!uData.franchiseId) return;

      const franchiseRef = doc(db, "franchises", uData.franchiseId);
      const franchiseSnap = await getDoc(franchiseRef);
      if (franchiseSnap.exists()) {
        setFranchiseData({ id: franchiseSnap.id, ...franchiseSnap.data() });
      }

      const q = query(
        collection(db, "groups"),
        where("franchiseId", "==", uData.franchiseId),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  const createGroup = async () => {
    if (!newGroupName || !franchiseData) return;

    try {
      setLoadingCreate(true);

      await addDoc(collection(db, "groups"), {
        name: newGroupName,
        franchiseId: franchiseData.id,
        city: franchiseData.city,
        state: franchiseData.state,
        max_participants: 30,
        current_participants: 0,
        status: "forming",
        target_amount: 165000,
        createdAt: serverTimestamp(),
      });

      toast.success("Grupo criado com sucesso!");
      setShowNewGroup(false);
      setNewGroupName("");

      // reload groups
      const q = query(
        collection(db, "groups"),
        where("franchiseId", "==", franchiseData.id),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error("Erro ao criar grupo");
    } finally {
      setLoadingCreate(false);
    }
  };

  const statusConfig = {
    forming: {
      label: "Em formação",
      color: "bg-yellow-100 text-yellow-700",
      icon: Users,
    },
    fundraising: {
      label: "Em captação",
      color: "bg-blue-100 text-blue-700",
      icon: Clock,
    },
    ready: {
      label: "Pronto",
      color: "bg-purple-100 text-purple-700",
      icon: CheckCircle2,
    },
    installing: {
      label: "Em instalação",
      color: "bg-amber-100 text-amber-700",
      icon: Wrench,
    },
    completed: {
      label: "Concluído",
      color: "bg-green-100 text-green-700",
      icon: CheckCircle2,
    },
  };

  const activeGroups = groups.filter((g) => g.status !== "completed");
  const completedGroups = groups.filter((g) => g.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grupos</h1>
          <p className="text-slate-600">
            Gerencie os grupos de instalação da sua região
          </p>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600"
          onClick={() => setShowNewGroup(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Grupo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-amber-700">
              {groups.length}
            </p>
            <p className="text-sm text-amber-600">Total de Grupos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {groups.filter((g) => g.status === "forming").length}
            </p>
            <p className="text-sm text-slate-500">Em Formação</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {groups.filter((g) => g.status === "installing").length}
            </p>
            <p className="text-sm text-slate-500">Em Instalação</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {completedGroups.length}
            </p>
            <p className="text-sm text-slate-500">Concluídos</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Groups */}
      <Card>
        <CardHeader>
          <CardTitle>
            Grupos Ativos ({activeGroups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGroups.map((group) => {
              const status = statusConfig[group.status];
              const StatusIcon = status.icon;
              const progress =
                (group.current_participants / group.max_participants) * 100;

              return (
                <Card key={group.id}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{group.name}</h3>

                    <Badge className={status.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>

                    <Progress value={progress} className="mt-3 h-2" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* New Group Modal */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Grupo</DialogTitle>
          </DialogHeader>

          <Label>Nome do Grupo</Label>
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroup(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              onClick={createGroup}
              disabled={loadingCreate}
            >
              {loadingCreate ? "Criando..." : "Criar Grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

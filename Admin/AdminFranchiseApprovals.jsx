import React, { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  CheckCircle2,
  XCircle,
  Building2,
  MapPin,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

export default function AdminFranchiseApprovals() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  const db = getFirestore();

  const loadApplications = async () => {
    try {
      const q = query(
        collection(db, "franchiseApplications"),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setApplications(data);
    } catch (err) {
      toast.error("Erro ao carregar candidaturas");
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const approveApplication = async (app) => {
    setLoading(true);
    try {
      // 1. Criar franquia oficial
      const franchiseRef = await addDoc(collection(db, "franchises"), {
        name: app.name,
        owner_name: app.owner_name,
        cpf_cnpj: app.cpf_cnpj,
        email: app.email,
        phone: app.phone,
        city: app.city,
        state: app.state,
        region: app.region || "",
        commission_rate: app.commission_rate || 10,
        total_families: 0,
        active_groups: 0,
        kits_installed: 0,
        total_commission: 0,
        status: "active",
        createdAt: serverTimestamp(),
      });

      // 2. Atualizar candidatura
      await updateDoc(doc(db, "franchiseApplications", app.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        franchise_id: franchiseRef.id,
      });

      toast.success("Franquia aprovada com sucesso!");
      loadApplications();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar candidatura");
    } finally {
      setLoading(false);
    }
  };

  const rejectApplication = async (id) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "franchiseApplications", id), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });
      toast.success("Candidatura rejeitada");
      loadApplications();
    } catch (err) {
      toast.error("Erro ao rejeitar candidatura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Aprovação de Franquias
        </h1>
        <p className="text-slate-600">
          Avalie e aprove novas candidaturas
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            Nenhuma candidatura pendente
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-500" />
                  {app.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    {app.owner_name}
                  </p>
                  <p>{app.email}</p>
                  <p>{app.phone}</p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    {app.city} - {app.state}
                  </p>
                </div>

                <Badge className="bg-yellow-100 text-yellow-700">
                  Pendente
                </Badge>

                <div className="flex gap-3 pt-2">
                  <Button
                    className="bg-green-500 hover:bg-green-600 flex-1"
                    onClick={() => approveApplication(app)}
                    disabled={loading}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Aprovar
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => rejectApplication(app.id)}
                    disabled={loading}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

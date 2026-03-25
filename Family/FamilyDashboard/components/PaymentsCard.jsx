import React from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function PaymentsCard({ payments }) {
  if (!payments.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos Pagamentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex gap-3">
              {p.status === "paid" ? (
                <CheckCircle2 className="text-green-600" />
              ) : (
                <Clock className="text-yellow-600" />
              )}
              <div>
                <p>R$ {Number(p.amount || 0).toFixed(2)}</p>
                <p className="text-xs text-slate-500">
                  Parcela {p.installment_number}/{p.total_installments}
                </p>
              </div>
            </div>
            <Badge className={p.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
              {p.status === "paid" ? "Pago" : "Pendente"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

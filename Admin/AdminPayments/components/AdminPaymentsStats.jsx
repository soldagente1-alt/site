import React from "react";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "../../../../components/ui/card";

export default function AdminPaymentsStats({
  totalCount,
  pendingCount,
  totalPending,
  overdueCount,
  totalOverdue,
  paidCount,
  moneyBRL,
}) {
  return (
    <div className="grid sm:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
          <p className="text-sm text-slate-500">Total (carregado)</p>
        </CardContent>
      </Card>
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-yellow-500" />
          <div>
            <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
            <p className="text-sm text-yellow-600">{moneyBRL(totalPending)}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div>
            <p className="text-2xl font-bold text-red-700">{overdueCount}</p>
            <p className="text-sm text-red-600">{moneyBRL(totalOverdue)}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <div>
            <p className="text-2xl font-bold text-green-700">{paidCount}</p>
            <p className="text-sm text-green-600">Pagos</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

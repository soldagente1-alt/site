import React from "react";
import { FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function FinanceCard({ totalPaid, selectedPayments }) {
  return (
    <Card className="rounded-2xl h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 h-4 text-slate-500" />
          Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">Total pago</div>
          <div className="font-semibold">
            R$ {Number(totalPaid || 0).toLocaleString("pt-BR")}
          </div>
        </div>

        <div className="text-sm text-slate-600">Últimos pagamentos</div>
        <div className="space-y-2">
          {selectedPayments.slice(0, 5).map((payment) => (
            <div key={payment.id} className="flex items-center justify-between text-sm">
              <div className="text-slate-600 truncate">
                {payment.description || payment.reference || "Pagamento"}
              </div>
              <div className="font-medium">
                R$ {Number(payment.amount || 0).toLocaleString("pt-BR")}
              </div>
            </div>
          ))}

          {selectedPayments.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhum pagamento encontrado.</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

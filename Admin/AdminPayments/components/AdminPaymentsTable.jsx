import React from "react";
import { CheckCircle2, MoreVertical, Receipt } from "lucide-react";
import { Card, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";

export default function AdminPaymentsTable({
  filteredPayments,
  familyIndex,
  statusConfig,
  typeConfig,
  openPayModal,
  markAsPaid,
  cancelPayment,
  getFamilyDisplayName,
  getFamilyCpf,
  moneyBRL,
  safeFormatDateBR,
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Família</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Referência</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Tipo</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Vencimento</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Pagamento</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Parcela</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => {
                const status = statusConfig[payment.status] || statusConfig.pending;
                const type = typeConfig[payment.type] || typeConfig.family_payment;
                const StatusIcon = status.icon;
                const family = familyIndex.get(payment.family_id) || null;

                return (
                  <tr
                    key={payment.id}
                    className="border-b hover:bg-slate-50 cursor-pointer"
                    onClick={() => openPayModal(payment)}
                  >
                    <td className="py-3 px-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{getFamilyDisplayName(family)}</div>
                      <div className="text-xs text-slate-500">CPF: {getFamilyCpf(family)}</div>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-slate-900">
                      {payment.reference || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={type.color}>{type.label}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium">
                      {moneyBRL(payment.amount || 0)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{safeFormatDateBR(payment.due_date)}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{safeFormatDateBR(payment.payment_date)}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {payment.installment_number && payment.total_installments
                        ? `${payment.installment_number}/${payment.total_installments}`
                        : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openPayModal(payment)}>
                            <Receipt className="w-4 h-4 mr-2" />
                            Abrir cobrança
                          </DropdownMenuItem>
                          {(payment.status === "pending" || payment.status === "overdue") && (
                            <DropdownMenuItem onClick={() => markAsPaid(payment)}>
                              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                              Marcar como Pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => cancelPayment(payment.id)}>
                            Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

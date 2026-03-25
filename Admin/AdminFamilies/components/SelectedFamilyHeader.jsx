import React from "react";
import { Copy, MoreVertical, Phone, XCircle } from "lucide-react";

import { Card, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";

import { fmtDateTimeBR, normalizeStage, safeToDate } from "../helpers";

export default function SelectedFamilyHeader({
  selectedFamily,
  selectedGroupLabel,
  selectedDueDay,
  derived,
  familyStatusConfig,
  onCopyFamilyId,
  onOpenWhatsApp,
  onDeselect,
}) {
  const familyBadge =
    familyStatusConfig[selectedFamily.status] || familyStatusConfig.pending;

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-lg font-semibold truncate">{selectedFamily.full_name}</div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={onCopyFamilyId}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar ID
            </Button>
          </div>

          <div className="text-sm text-slate-500">
            {selectedFamily.address?.city
              ? `${selectedFamily.address.city} - ${selectedFamily.address?.state || ""}`
              : "—"}
            {" • "}
            CPF: {selectedFamily.cpf || "—"}
            {" • "}
            Tel: {selectedFamily.phone || "—"}
          </div>

          <div className="text-xs text-slate-500 mt-2">
            Grupo: <span className="font-medium">{selectedGroupLabel}</span>
          </div>

          <div className="text-xs text-slate-500 mt-2">
            Vencimento: <span className="font-medium">{selectedDueDay ? `dia ${selectedDueDay}` : "—"}</span>
          </div>

          <div className="text-xs text-slate-500 mt-2">
            Pipeline: <span className="font-medium">{normalizeStage(selectedFamily.pipeline_stage)}</span>
            {selectedFamily.pipeline_substatus ? (
              <>
                {" "}• Sub: <span className="font-medium">{String(selectedFamily.pipeline_substatus)}</span>
              </>
            ) : null}
            {selectedFamily.pipeline_updated_at ? (
              <>
                {" "}• Atualizado: {fmtDateTimeBR(safeToDate(selectedFamily.pipeline_updated_at))}
              </>
            ) : null}
          </div>

          {selectedFamily.pipeline_reason ? (
            <div className="text-xs text-amber-700 mt-1">Motivo: {String(selectedFamily.pipeline_reason)}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={familyBadge.color}>{familyBadge.label}</Badge>

          {derived?.isActiveNow ? (
            <Badge className="bg-green-100 text-green-700">Ativo</Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-700">
              Pipeline: {derived?.pipeline_stage || "—"}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl">
                <MoreVertical className="w-4 h-4 mr-2" />
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenWhatsApp}>
                <Phone className="w-4 h-4 mr-2" />
                WhatsApp
              </DropdownMenuItem>

              <DropdownMenuItem onClick={onDeselect}>
                <XCircle className="w-4 h-4 mr-2 text-slate-600" />
                Desselecionar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

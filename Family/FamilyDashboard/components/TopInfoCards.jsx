import React from "react";
import { Link } from "react-router-dom";
import { CreditCard, FileText, ShieldCheck, Sun, Users } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import InfoCard from "./InfoCard";

export default function TopInfoCards({
  statusLabels,
  displayFamilyStatus,
  isActiveNow,
  waitlist,
  planId,
  planLoading,
  planName,
  groupId,
  groupLoading,
  groupName,
  groupData,
  groupStatusLabels,
  groupQueueLoading,
  groupQueueDerived,
  contractUnlocked,
  contractUI,
  contractLoading,
  contractStatus,
  contractLockReason,
  monthlyPayment,
  billingDueDay,
  createPageUrl,
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <InfoCard icon={ShieldCheck} label="Status">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={statusLabels[displayFamilyStatus]?.color || "bg-yellow-100 text-yellow-700"}>
            {statusLabels[displayFamilyStatus]?.label || "Aguardando"}
          </Badge>
          {isActiveNow ? <Badge className="bg-green-100 text-green-700">Ativo</Badge> : null}
          {waitlist?.active && !isActiveNow ? (
            <Badge className="bg-amber-100 text-amber-700">{waitlist.label}</Badge>
          ) : null}
        </div>
      </InfoCard>

      <InfoCard icon={Sun} label="Plano">
        <div className="flex items-center gap-2 flex-wrap">
          {!planId ? (
            <>
              <span className="font-bold">A definir</span>
              <Link to={createPageUrl("family/plan")}>
                <Button size="sm" className="ml-0 sm:ml-2">Ver planos</Button>
              </Link>
            </>
          ) : planLoading ? (
            <span className="font-bold">Carregando...</span>
          ) : planName ? (
            <Badge className="bg-amber-100 text-amber-700">{planName}</Badge>
          ) : (
            <Badge className="bg-red-100 text-red-700">Plano não encontrado</Badge>
          )}
        </div>
      </InfoCard>

      <InfoCard icon={Users} label="Grupo">
        <div className="flex items-center gap-2 flex-wrap">
          {!groupId ? (
            <span className="font-bold">A definir</span>
          ) : groupLoading ? (
            <span className="font-bold">Carregando...</span>
          ) : groupName ? (
            <>
              <Badge className="bg-purple-100 text-purple-700">{groupName}</Badge>
              <Badge className="bg-slate-100 text-slate-700">
                {groupStatusLabels[(String(groupData?.status || "").trim().toLowerCase())] || groupData?.status || "—"}
              </Badge>
              {groupQueueLoading ? (
                <Badge className="bg-slate-100 text-slate-700">Posição: carregando...</Badge>
              ) : groupQueueDerived?.idx ? (
                <Badge className="bg-amber-100 text-amber-700">
                  {String(groupQueueDerived?.role || "").trim().toLowerCase() === "standby"
                    ? `Lista: ${Math.max(1, (groupQueueDerived.idx || 0) - (groupQueueDerived.capacity || 0))}${
                        groupQueueDerived.queueLimit && groupQueueDerived.capacity
                          ? `/${Math.max(0, groupQueueDerived.queueLimit - groupQueueDerived.capacity)}`
                          : ""
                      }`
                    : `Titular: ${groupQueueDerived.idx}${groupQueueDerived.capacity ? `/${groupQueueDerived.capacity}` : ""}`}
                </Badge>
              ) : null}
            </>
          ) : (
            <Badge className="bg-red-100 text-red-700">Grupo não encontrado</Badge>
          )}
        </div>

        {groupId && groupQueueDerived?.source === "none" ? (
          <div className="text-xs text-slate-500 mt-1">
            Sua posição no grupo será exibida assim que você for importado para a lista do grupo.
          </div>
        ) : null}
      </InfoCard>

      <InfoCard icon={FileText} label="Contrato">
        <div className="space-y-2">
          <Badge className={contractUnlocked ? contractUI.badge.className : "bg-slate-100 text-slate-700"}>
            {contractLoading ? "Carregando..." : contractUnlocked ? contractUI.badge.text : "Bloqueado"}
          </Badge>

          {contractUnlocked ? (
            <Link to={createPageUrl("family/contract")}>
              <Button size="sm" variant={contractStatus === "validated" ? "outline" : "default"}>
                Abrir painel Contrato
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="outline" disabled title={contractLockReason || undefined}>
              Contrato bloqueado
            </Button>
          )}

          {!contractUnlocked && contractLockReason ? (
            <div className="text-xs text-slate-500">{contractLockReason}</div>
          ) : null}
        </div>
      </InfoCard>

      <InfoCard icon={CreditCard} label="Parcela">
        <div className="leading-tight">
          <div>R$ {Number(monthlyPayment).toFixed(2)}</div>
          <div className="text-xs text-slate-500 font-normal">
            Vencimento: <span className="font-medium">{billingDueDay ? `dia ${billingDueDay}` : "—"}</span>
          </div>
        </div>
      </InfoCard>
    </div>
  );
}

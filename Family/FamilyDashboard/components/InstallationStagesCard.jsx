import React from "react";
import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import MiniStep from "./MiniStep";
import { badgeByMiniStatus, homologationLabel, safeToDate } from "../helpers";

export default function InstallationStagesCard({
  installMini,
  visitJob,
  engineeringProjectLast,
  installationJob,
  homologationDoc,
  visitJobLoading,
  engineeringProjectLoading,
  installExecutionLoading,
  installationJobLoading,
  homologationLoading,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="text-amber-500" />
          Etapas da instalação
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <MiniStep
            title="Visita"
            badge={installMini?.visit?.label || "—"}
            badgeClass={badgeByMiniStatus(installMini?.visit?.key)}
            desc={
              visitJob?.scheduled_at
                ? `Agendada: ${safeToDate(visitJob.scheduled_at)?.toLocaleString("pt-BR") || "—"}`
                : " "
            }
          />

          <MiniStep
            title="Projeto"
            badge={installMini?.engineering?.label || "—"}
            badgeClass={badgeByMiniStatus(installMini?.engineering?.key)}
            desc={engineeringProjectLast?.status ? `Status: ${engineeringProjectLast.status}` : " "}
          />

          <MiniStep
            title="Instalação"
            badge={installMini?.install?.label || "—"}
            badgeClass={badgeByMiniStatus(installMini?.install?.key)}
            desc={
              safeToDate(installationJob?.scheduled_at)
                ? `Agendada: ${safeToDate(installationJob.scheduled_at)?.toLocaleString("pt-BR") || "—"}`
                : " "
            }
          />

          <MiniStep
            title="Homologação"
            badge={installMini?.homolog?.label || "—"}
            badgeClass={badgeByMiniStatus(installMini?.homolog?.key)}
            desc={homologationDoc?.status ? `Status: ${homologationLabel(homologationDoc.status)}` : " "}
          />
        </div>

        {(visitJobLoading ||
          engineeringProjectLoading ||
          installExecutionLoading ||
          installationJobLoading ||
          homologationLoading) ? (
          <p className="text-sm text-slate-500">Atualizando informações das etapas...</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

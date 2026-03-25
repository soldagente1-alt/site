import React from "react";
import { Sun } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";

export default function DashboardHeader({ familyData, waitlist, isActiveNow, pipelineUpdatedAtText }) {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white flex justify-between">
      <div className="min-w-0">
        <p className="text-amber-100 text-sm">Bem-vindo(a),</p>
        <h1 className="text-2xl font-bold">{familyData?.full_name?.split(" ")[0]}</h1>
        <p className="text-amber-100 text-sm mt-2">Aqui você troca a conta de luz por um futuro melhor</p>

        {waitlist?.active && !isActiveNow ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-white/20 text-white">
              {waitlist.label}
              {waitlist.enteredAt ? ` • desde ${waitlist.enteredAt.toLocaleDateString("pt-BR")}` : ""}
            </Badge>
            {waitlist.notes ? (
              <span className="text-amber-100 text-xs truncate max-w-[520px]">{waitlist.notes}</span>
            ) : null}
          </div>
        ) : null}

        <p className="text-amber-100 text-xs mt-2">Pipeline atualizado: {pipelineUpdatedAtText}</p>
      </div>

      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
        <Sun className="w-8 h-8" />
      </div>
    </div>
  );
}

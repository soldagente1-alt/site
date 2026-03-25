import React from "react";
import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";

import {
  badgeForSubstatus,
  getBillingDueDayFromFamily,
  getFamilyGroupId,
  getGroupLabel,
  normStr,
  pipelineLabelForKey,
} from "../helpers";

export default function FamiliesListCard({
  filteredFamilies,
  selectedFamilyId,
  onSelectFamily,
  familyStatusConfig,
  pipelineStageByFamily,
  groupIndex,
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          Famílias
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {filteredFamilies.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">Nenhuma família encontrada.</div>
        ) : (
          <div className="space-y-2">
            {filteredFamilies.map((family) => {
              const isSelected = family.id === selectedFamilyId;
              const familyBadge = familyStatusConfig[family.status] || familyStatusConfig.pending;
              const pipelineKey = pipelineStageByFamily.get(family.id) || "cadastro";
              const pipelineLabel = pipelineLabelForKey(pipelineKey);
              const dueDay = getBillingDueDayFromFamily(family);
              const familyGroupId = getFamilyGroupId(family);
              const familyGroupLabel = familyGroupId
                ? getGroupLabel(groupIndex.get(familyGroupId), familyGroupId)
                : "Sem grupo";
              const subInfo = badgeForSubstatus(family.pipeline_substatus);
              const showSub = !!normStr(family.pipeline_substatus);

              return (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => onSelectFamily(family.id)}
                  className={[
                    "w-full text-left rounded-2xl border p-3 transition",
                    isSelected
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {family.full_name || family.id}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {family.address?.city
                          ? `${family.address.city} - ${family.address?.state || ""}`
                          : "—"}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1">
                        Grupo: <span className="font-medium">{familyGroupLabel}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1">
                        Vencimento das parcelas:{" "}
                        <span className="font-medium">{dueDay ? `dia ${dueDay}` : "—"}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge className={familyBadge.color}>{familyBadge.label}</Badge>
                      {showSub ? <Badge className={subInfo.cn}>{subInfo.t}</Badge> : null}
                      <Badge className="bg-slate-100 text-slate-700">Pipeline: {pipelineLabel}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

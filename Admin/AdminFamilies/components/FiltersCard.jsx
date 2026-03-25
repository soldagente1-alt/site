import React from "react";
import { Filter, Search, Users } from "lucide-react";

import { Card, CardContent } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";

import { getGroupLabel } from "../helpers";

export default function FiltersCard({
  search,
  onSearchChange,
  pipelineFilter,
  onPipelineFilterChange,
  processSteps,
  groupFilter,
  onGroupFilterChange,
  groupFilterOptions,
  filteredFamiliesCount,
  familiesCount,
  franchiseFilter,
  groupIndex,
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, CPF, cidade ou grupo..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Select value={pipelineFilter} onValueChange={onPipelineFilterChange}>
            <SelectTrigger className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (pipeline)</SelectItem>
              {processSteps.map((step) => (
                <SelectItem key={step.key} value={step.key}>
                  {step.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={groupFilter} onValueChange={onGroupFilterChange}>
            <SelectTrigger className="w-full">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              <SelectItem value="no_group">Sem grupo</SelectItem>
              {groupFilterOptions.map((group) => (
                <SelectItem key={group.value} value={group.value}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-slate-500">
          Exibindo <span className="font-medium">{filteredFamiliesCount}</span> de{" "}
          <span className="font-medium">{familiesCount}</span> famílias
          {groupFilter !== "all" ? (
            <>
              {" "}• Grupo:{" "}
              <span className="font-medium">
                {groupFilter === "no_group"
                  ? "Sem grupo"
                  : getGroupLabel(groupIndex.get(groupFilter), groupFilter)}
              </span>
            </>
          ) : null}
          {franchiseFilter !== "all" ? (
            <>
              {" "}• Franquia: <span className="font-medium">{franchiseFilter}</span>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

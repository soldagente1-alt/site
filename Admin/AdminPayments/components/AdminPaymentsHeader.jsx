import React from "react";
import { Download, Calendar } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export default function AdminPaymentsHeader({ onExport, onGenerate }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Pagamentos</h1>
        <p className="text-slate-600">Controle completo de recebimentos e pagamentos</p>
        <p className="text-xs text-slate-500 mt-1">
          Contábil: lança em <span className="font-mono">journal_entries</span> e{" "}
          <span className="font-mono">journal_lines</span> no centro de custo do grupo.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
        <Button className="bg-green-500 hover:bg-green-600" onClick={onGenerate}>
          <Calendar className="w-4 h-4 mr-2" />
          Gerar Parcelas
        </Button>
      </div>
    </div>
  );
}

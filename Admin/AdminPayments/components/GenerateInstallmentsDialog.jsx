import React from "react";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Label } from "../../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";

export default function GenerateInstallmentsDialog({
  open,
  onOpenChange,
  selectedFamily,
  onSelectedFamilyChange,
  activeFamilies,
  getFamilyDisplayName,
  generating,
  onGenerate,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar Parcelas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Selecione a Família</Label>
            <Select value={selectedFamily} onValueChange={onSelectedFamilyChange}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma família..." />
              </SelectTrigger>
              <SelectContent>
                {activeFamilies.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {getFamilyDisplayName(family)} - {family.address?.city || "Sem cidade"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl text-sm text-amber-700 space-y-1">
            <p className="font-medium">ℹ️ Como funciona agora:</p>
            <p>• As parcelas são criadas com IDs fixos por família/parcela (sem duplicar).</p>
            <p>
              • Ao criar parcela, o sistema também cria o lançamento contábil em{" "}
              <span className="font-mono">journal_entries</span> +{" "}
              <span className="font-mono">journal_lines</span>.
            </p>
            <p>
              • O <strong>centro de custo</strong> é o do <strong>grupo</strong> (via{" "}
              <span className="font-mono">Family.group_id</span> →{" "}
              <span className="font-mono">cost_centers</span>).
            </p>
            <p className="text-xs text-amber-800">
              Obs.: confira os IDs de contas em <span className="font-mono">ACCOUNT_DEBIT_ID</span> /{" "}
              <span className="font-mono">ACCOUNT_CREDIT_ID</span>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-green-500 hover:bg-green-600"
            disabled={!selectedFamily || generating}
            onClick={onGenerate}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
            Gerar Parcelas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

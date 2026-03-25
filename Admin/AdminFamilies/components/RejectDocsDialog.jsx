import React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";

export default function RejectDocsDialog({
  open,
  onOpenChange,
  docsActionLoading,
  selectedFamilyId,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar reprovação</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-600 space-y-2">
          <div>
            Você tem certeza que deseja <span className="font-semibold">reprovar</span> a documentação?
          </div>
          <div className="text-xs text-slate-500">
            Isso vai voltar o pipeline para <span className="font-medium">Cadastro</span> e marcar a
            documentação como <span className="font-medium">Reprovada</span>.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={docsActionLoading} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={docsActionLoading || !selectedFamilyId}
            onClick={onConfirm}
          >
            {docsActionLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Reprovando…
              </>
            ) : (
              "Confirmar reprovação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

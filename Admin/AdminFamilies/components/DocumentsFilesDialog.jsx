import React from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";

export default function DocumentsFilesDialog({
  open,
  onOpenChange,
  docsFilesFlat,
  onOpenDocument,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Arquivos enviados</DialogTitle>
        </DialogHeader>

        {docsFilesFlat.length === 0 ? (
          <div className="text-sm text-slate-600">
            Nenhum arquivo encontrado.
            <div className="text-xs text-slate-500 mt-2">
              (Se você tem certeza que existe arquivo no Firestore, então o problema era a query com índice —
              este arquivo já foi ajustado para não depender de índice.)
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
            {docsFilesFlat.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between gap-3 border rounded-xl p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {file.contentType || "—"}
                    {file.size ? ` • ${Math.round(Number(file.size) / 1024)} KB` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!file.url && !file.path}
                    onClick={() => onOpenDocument(file)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

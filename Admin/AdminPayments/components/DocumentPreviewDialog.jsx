import React from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import DynamicPaymentDocumentPreview from "./DynamicPaymentDocumentPreview";

export default function DocumentPreviewDialog({
  open,
  onOpenChange,
  docPreview,
  openUrl,
  handlePrintOrSavePdf,
  printingDoc,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{docPreview?.title || "Documento"}</DialogTitle>
        </DialogHeader>

        {docPreview ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{docPreview.title}</div>
                  <div className="text-sm text-slate-600">
                    {docPreview.number} • Valor {docPreview.items?.[0]?.value || "R$ 0,00"}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Emissão: {docPreview.issueDate} • Vencimento: {docPreview.dueDate}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => openUrl(docPreview.template?.png?.download_url)}
                    disabled={!docPreview.template?.png?.download_url}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Abrir PNG
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openUrl(docPreview.template?.pdf?.download_url)}
                    disabled={!docPreview.template?.pdf?.download_url}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Abrir PDF base
                  </Button>
                  <Button
                    className="bg-slate-900 hover:bg-slate-800"
                    onClick={handlePrintOrSavePdf}
                    disabled={printingDoc || !docPreview?.layout?.canvas}
                  >
                    {printingDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                    Imprimir / salvar PDF
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3 overflow-auto">
              <DynamicPaymentDocumentPreview docData={docPreview} />
            </div>

            <div className="text-xs text-slate-500">
              O botão <b>Imprimir / salvar PDF</b> abre a versão preenchida do documento no navegador para impressão ou salvar como PDF.
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

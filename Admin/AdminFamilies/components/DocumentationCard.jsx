import React from "react";
import { FolderOpen, Loader2, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";

import { badgeForDocs, fmtDateTimeBR, safeToDate } from "../helpers";

export default function DocumentationCard({
  derived,
  docsAlreadyApproved,
  approvedAtText,
  docsFilesCount,
  onOpenFiles,
  docsNotes,
  onDocsNotesChange,
  docsActionLoading,
  selectedFamilyId,
  onSaveDocsNotes,
  canApprove,
  approveDisabledReason,
  onApprove,
  onAskReject,
  documentsDoc,
}) {
  const docsBadge = badgeForDocs(derived?.docs_status);

  return (
    <Card className="rounded-2xl h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          Documentação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-slate-600">Status</div>
          <Badge className={docsBadge.cn}>{docsBadge.t}</Badge>
        </div>

        {docsAlreadyApproved && approvedAtText ? (
          <div className="text-xs text-slate-500">
            Aprovado em: <span className="font-medium">{approvedAtText}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={onOpenFiles}
            title="Ver arquivos enviados"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Ver arquivos ({docsFilesCount})
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-slate-600">Observações (admin)</div>
          <Input
            value={docsNotes}
            onChange={(event) => onDocsNotesChange(event.target.value)}
            placeholder="Ex.: documento ilegível, faltou verso…"
            disabled={docsActionLoading}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={docsActionLoading || !selectedFamilyId}
              onClick={onSaveDocsNotes}
              title={docsActionLoading ? "Aguarde…" : "Salvar observações"}
            >
              {docsActionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando…
                </>
              ) : (
                "Salvar observações"
              )}
            </Button>

            <Button
              className="rounded-xl"
              disabled={!canApprove}
              title={approveDisabledReason || "Aprovar documentação"}
              onClick={onApprove}
            >
              {docsAlreadyApproved ? "Aprovado ✅" : "Aprovar"}
            </Button>

            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={docsActionLoading || !selectedFamilyId}
              onClick={onAskReject}
              title={docsActionLoading ? "Aguarde…" : "Reprovar documentação"}
            >
              Reprovar
            </Button>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Última atualização: {fmtDateTimeBR(safeToDate(documentsDoc?.updated_at))}
        </div>
      </CardContent>
    </Card>
  );
}

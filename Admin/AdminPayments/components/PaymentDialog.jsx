import React from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  QrCode,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";

export default function PaymentDialog({
  open,
  onOpenChange,
  selectedPayment,
  billingSettings,
  selectedFamilyData,
  loadingSelectedContext,
  statusConfig,
  moneyBRL,
  fmtDueDate,
  getFamilyDisplayName,
  getFamilyCpf,
  openReceiptTemplate,
  openInvoiceTemplate,
  handleOpenNf,
  canReceipt,
  canInvoice,
  canNf,
  familyIsActive,
  selectedPaymentIsCurrentMonth,
  getNfseTitle,
  issuingNfPaymentId,
  refreshingNfPaymentId,
  hasIssuedNfse,
  getNfseStatus,
  getNfseError,
  payTab,
  onPayTabChange,
  pixTabAvailable,
  boletoEnabledForSelected,
  qrLoading,
  pixQrDataUrl,
  getAsaasPixPaymentId,
  handleCreatePix,
  creatingPix,
  isPixAnticipationMode,
  getPixPayload,
  copyPixCode,
  isLocal,
  handleConfirmSandboxPayment,
  confirmingPay,
  getAsaasBoletoPaymentId,
  handleCreateBoleto,
  creatingBoleto,
  getDigitableLine,
  copyDigitableLine,
  downloadBoleto,
  getBoletoUrl,
  hasPix,
  hasBoleto,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Cobrança da parcela</DialogTitle>
        </DialogHeader>

        {selectedPayment && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold">{moneyBRL(Number(selectedPayment.amount || 0))}</div>
                  <div className="text-sm text-slate-500">{selectedPayment.reference || "Sem referência"}</div>
                  <div className="text-sm text-slate-500">
                    Parcela {selectedPayment.installment_number || "-"}/{selectedPayment.total_installments || "-"} • Venc. {fmtDueDate(selectedPayment)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Família: <b>{selectedPayment.family_id || "-"}</b> • Provider:{" "}
                    <b>{(billingSettings?.providerName || "bnb").toUpperCase()}</b> • modo{" "}
                    <b>{billingSettings?.providerMode || "mock"}</b>
                  </div>
                  {selectedFamilyData ? (
                    <div className="text-xs text-slate-500 mt-1">
                      {getFamilyDisplayName(selectedFamilyData)} • CPF {getFamilyCpf(selectedFamilyData)}
                    </div>
                  ) : null}
                </div>
                <div className="flex justify-start sm:justify-end">
                  {(() => {
                    const status = statusConfig[selectedPayment.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    return (
                      <Badge className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Documentos da parcela</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Regras iguais ao FamilyPayments: recibo antes da ativação, fatura após ativação e NF conforme elegibilidade.
                  </div>
                </div>
                {loadingSelectedContext ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando contexto da família...
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => openReceiptTemplate(selectedPayment)} disabled={loadingSelectedContext || !canReceipt}>
                  <Receipt className="w-4 h-4 mr-2" />
                  Recibo
                </Button>

                <Button variant="outline" onClick={() => openInvoiceTemplate(selectedPayment)} disabled={loadingSelectedContext || !canInvoice}>
                  <FileText className="w-4 h-4 mr-2" />
                  Fatura
                </Button>

                <Button
                  className="bg-slate-900 hover:bg-slate-800"
                  onClick={() => handleOpenNf(selectedPayment)}
                  disabled={
                    loadingSelectedContext ||
                    !selectedFamilyData ||
                    !canNf ||
                    issuingNfPaymentId === selectedPayment.id ||
                    refreshingNfPaymentId === selectedPayment.id
                  }
                  title={getNfseTitle(selectedPayment, familyIsActive, canNf)}
                >
                  {issuingNfPaymentId === selectedPayment.id || refreshingNfPaymentId === selectedPayment.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  {hasIssuedNfse(selectedPayment) ? "Abrir NF" : "Emitir NF"}
                </Button>
              </div>

              <div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">
                {!selectedFamilyData
                  ? "Abra a parcela e aguarde o carregamento do contexto para liberar os documentos."
                  : !familyIsActive
                  ? "Família ainda não ativa: o documento correto é o recibo, e a NF permanece bloqueada."
                  : selectedPayment.status === "paid"
                  ? "Família ativa e parcela paga: fatura disponível, NF elegível para emissão/abertura."
                  : selectedPaymentIsCurrentMonth
                  ? "Família ativa e parcela do mês: fatura disponível para cobrança."
                  : "Família ativa: fatura e NF seguem as mesmas regras do FamilyPayments."}
              </div>

              {getNfseStatus(selectedPayment) ? (
                <div className="text-xs text-slate-500">
                  Status NF: <b>{getNfseStatus(selectedPayment)}</b>
                  {selectedPayment?.nfse_number ? ` • nº ${selectedPayment.nfse_number}` : ""}
                </div>
              ) : null}

              {getNfseError(selectedPayment) ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Último erro da NF: {getNfseError(selectedPayment)}
                </div>
              ) : null}
            </div>

            {pixTabAvailable || boletoEnabledForSelected ? (
              <Tabs value={payTab} onValueChange={onPayTabChange} className="w-full">
                <TabsList className="w-full">
                  {pixTabAvailable ? <TabsTrigger value="pix" className="flex-1">Pix</TabsTrigger> : null}
                  {boletoEnabledForSelected ? <TabsTrigger value="boleto" className="flex-1">Boleto</TabsTrigger> : null}
                </TabsList>

                {pixTabAvailable ? (
                  <TabsContent value="pix" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border bg-amber-50 p-4">
                        <div className="flex flex-col items-center gap-3">
                          {qrLoading ? (
                            <div className="py-6 text-slate-600 flex flex-col items-center">
                              <Loader2 className="w-6 h-6 animate-spin mb-2" />
                              Gerando QR Code...
                            </div>
                          ) : pixQrDataUrl ? (
                            <div className="bg-white rounded-xl p-3 shadow-sm">
                              <img src={pixQrDataUrl} alt="QR Code Pix" className="w-52 h-52 object-contain" />
                            </div>
                          ) : (
                            <div className="py-6 text-center">
                              <QrCode className="w-16 h-16 mx-auto mb-2 text-slate-400" />
                              <p className="text-sm text-slate-600">Pix ainda não disponível</p>
                            </div>
                          )}
                          <p className="text-sm text-slate-700">Escaneie no app do banco</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {getAsaasPixPaymentId(selectedPayment) ? (
                          <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Pix já gerado para esta parcela.
                          </div>
                        ) : (
                          <Button
                            className="w-full h-10 bg-slate-900 hover:bg-slate-800"
                            onClick={handleCreatePix}
                            disabled={creatingPix}
                          >
                            {creatingPix ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            {isPixAnticipationMode ? "Gerar Pix antecipado" : "Gerar Pix"}
                          </Button>
                        )}

                        <div className="rounded-xl border p-3 bg-white">
                          <div className="text-xs font-semibold text-slate-700 mb-2">Pix copia e cola</div>
                          <div className="flex gap-2 items-center min-w-0">
                            <div className="flex-1 min-w-0 bg-slate-100 px-3 py-2 rounded font-mono text-xs truncate">
                              {getPixPayload(selectedPayment) || "PIX NÃO CONFIGURADO"}
                            </div>
                            <Button variant="outline" onClick={copyPixCode} disabled={!getPixPayload(selectedPayment)} className="shrink-0">
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">
                          {isPixAnticipationMode ? (
                            <>
                              Esta parcela está fora do mês corrente. O botão acima libera o <b>Pix antecipado</b> manualmente.
                            </>
                          ) : (
                            <>
                              O Pix está configurado para {billingSettings?.pix?.currentMonthOnly ? <b>mês corrente</b> : <b>múltiplas competências</b>}.
                            </>
                          )}
                        </div>

                        {isLocal ? (
                          <Button
                            variant="outline"
                            className="w-full h-10"
                            onClick={handleConfirmSandboxPayment}
                            disabled={confirmingPay || !getAsaasPixPaymentId(selectedPayment)}
                          >
                            {confirmingPay ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Confirmar pagamento (sandbox)
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {!hasPix ? (
                      <div className="text-xs text-slate-500 text-center mt-3">
                        Este pagamento ainda não tem Pix gerado. Clique em <b>{isPixAnticipationMode ? "Gerar Pix antecipado" : "Gerar Pix"}</b>.
                      </div>
                    ) : null}
                  </TabsContent>
                ) : null}

                {boletoEnabledForSelected ? (
                  <TabsContent value="boleto" className="mt-4">
                    <div className="space-y-3">
                      {getAsaasBoletoPaymentId(selectedPayment) ? (
                        <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-slate-700" />
                          Boleto já gerado para esta parcela.
                        </div>
                      ) : (
                        <Button variant="outline" className="w-full h-10" onClick={handleCreateBoleto} disabled={creatingBoleto}>
                          {creatingBoleto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                          {billingSettings?.boleto?.onDemandOnly ? "Solicitar boleto" : "Gerar boleto"}
                        </Button>
                      )}

                      <div className="rounded-xl border p-3 bg-white">
                        <div className="text-xs font-semibold text-slate-700 mb-2">Linha digitável</div>
                        <div className="flex gap-2 items-center min-w-0">
                          <div className="flex-1 min-w-0 bg-slate-100 px-3 py-2 rounded font-mono text-xs truncate">
                            {getDigitableLine(selectedPayment) || "LINHA DIGITÁVEL NÃO DISPONÍVEL"}
                          </div>
                          <Button variant="outline" onClick={copyDigitableLine} disabled={!getDigitableLine(selectedPayment)} className="shrink-0">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <Button className="w-full h-10 bg-amber-500 hover:bg-amber-600" onClick={downloadBoleto} disabled={!getBoletoUrl(selectedPayment)}>
                        <Download className="w-4 h-4 mr-2" />
                        Baixar Boleto (PDF)
                      </Button>

                      <div className="text-xs text-slate-500 rounded-lg border bg-slate-50 px-3 py-2">
                        O boleto usa o vencimento já definido na parcela: <b>{fmtDueDate(selectedPayment)}</b>.
                      </div>

                      {!hasBoleto ? (
                        <div className="text-xs text-slate-500 text-center">
                          Este pagamento ainda não tem boleto gerado. Clique em <b>{billingSettings?.boleto?.onDemandOnly ? "Solicitar boleto" : "Gerar boleto"}</b>.
                        </div>
                      ) : null}
                    </div>
                  </TabsContent>
                ) : null}
              </Tabs>
            ) : (
              <div className="rounded-xl border bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Nenhum meio de cobrança está liberado para esta parcela pelas configurações atuais.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

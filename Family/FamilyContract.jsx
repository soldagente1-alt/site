import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { storage } from "../../api/firebaseStorage";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  ref as storageRef,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";

import {
  Sun,
  FileText,
  Download,
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";

import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

const GOV_SIGN_URL = "https://assinador.iti.br/";
const functions = getFunctions(getApp(), "us-central1");
const openOrReuseFamilyContractCallable = httpsCallable(functions, "familyContractOpenOrReuse");
const markSignedUploadedCallable = httpsCallable(functions, "familyContractMarkSignedUploaded");

export default function FamilyContract() {
  const navigate = useNavigate();

  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  const [downloadingContract, setDownloadingContract] = useState(false);
  const [signedFile, setSignedFile] = useState(null);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [signedProgress, setSignedProgress] = useState(0);
  const [latestContract, setLatestContract] = useState(null);

  function sanitizeFileName(str = "") {
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .trim();
  }

  function statusNormalize(s = "") {
    return String(s || "").trim().toLowerCase();
  }

  function isRejectedStatus(s) {
    const v = statusNormalize(s);
    return v === "refused" || v === "rejected" || v === "denied";
  }

  function isValidatedStatus(s) {
    const v = statusNormalize(s);
    return v === "validated" || v === "approved";
  }

  function isSignedStatus(contract) {
    const v = statusNormalize(contract?.status);
    return v === "signed_uploaded" || !!contract?.signed_storage_path;
  }

  function contractUiStatus(contract) {
    const st = statusNormalize(contract?.status);

    if (!contract) return "none";
    if (isValidatedStatus(st)) return "validated";
    if (isRejectedStatus(st)) return "refused";
    if (isSignedStatus(contract)) return "signed_uploaded";
    if (!st || st === "pending_signature") return "pending_signature";

    return st;
  }

  function contractStatusText(contract) {
    const ui = contractUiStatus(contract);
    if (ui === "none") return "Sem contrato gerado";
    if (ui === "pending_signature") return "Pendente de assinatura";
    if (ui === "signed_uploaded") return "Enviado • aguardando aprovação";
    if (ui === "validated") return "Validado ✅";
    if (ui === "refused") return "Recusado ❌";
    return ui;
  }

  function tsToMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return 0;
  }

  function pickLatestContractFromDocs(docs) {
    if (!docs?.length) return null;

    return docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aKey =
          tsToMillis(a.updated_at) ||
          tsToMillis(a.generated_at) ||
          tsToMillis(a.signed_at) ||
          Number(a.updated_at_ms || 0) ||
          Number(a.generated_at_ms || 0);

        const bKey =
          tsToMillis(b.updated_at) ||
          tsToMillis(b.generated_at) ||
          tsToMillis(b.signed_at) ||
          Number(b.updated_at_ms || 0) ||
          Number(b.generated_at_ms || 0);

        return bKey - aKey;
      })[0];
  }

  async function resolveStoredContractUrl(contract) {
    if (!contract) return null;

    const directUrl = [
      contract?.validated_url,
      contract?.final_url,
      contract?.signed_url,
      contract?.generated_url,
    ]
      .map((v) => String(v || "").trim())
      .find(Boolean);

    if (directUrl) return directUrl;

    const storagePath = [
      contract?.validated_storage_path,
      contract?.final_storage_path,
      contract?.signed_storage_path,
      contract?.generated_storage_path,
    ]
      .map((v) => String(v || "").trim())
      .find(Boolean);

    if (!storagePath) return null;
    return getDownloadURL(storageRef(storage, storagePath));
  }

  function openUrlInBrowser(url) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  useEffect(() => {
    let unsubFamily = null;
    let unsubContract = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setFamily(null);
        setLatestContract(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      unsubFamily = onSnapshot(
        doc(db, "Family", user.uid),
        (snap) => {
          setFamily(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoading(false);
        },
        (err) => {
          console.error("Erro ao carregar Family:", err);
          setFamily(null);
          setLoading(false);
        }
      );

      const q = query(collection(db, "FamilyContracts"), where("family_id", "==", user.uid));
      unsubContract = onSnapshot(
        q,
        (snap) => {
          setLatestContract(pickLatestContractFromDocs(snap.docs));
        },
        (err) => {
          console.warn("onSnapshot(FamilyContracts) falhou:", err);
          setLatestContract(null);
        }
      );
    });

    return () => {
      try {
        unsubAuth?.();
      } catch (_) {}
      try {
        unsubFamily?.();
      } catch (_) {}
      try {
        unsubContract?.();
      } catch (_) {}
    };
  }, []);

  const uiStatus = useMemo(() => contractUiStatus(latestContract), [latestContract]);
  const awaitingApproval = uiStatus === "signed_uploaded";
  const validated = uiStatus === "validated";
  const refused = uiStatus === "refused";
  const pending = uiStatus === "pending_signature";

  const canUploadSigned = !!latestContract && (pending || refused);
  const uploadLocked = awaitingApproval || validated;
  const showRefusedNote = refused && !!latestContract?.validation_note;

  async function handleDownloadContract() {
    if (downloadingContract) return;

    setDownloadingContract(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("Você precisa estar logado.");
        return;
      }

      let refreshExisting = false;
      if (latestContract && !validated && !awaitingApproval) {
        refreshExisting = window.confirm(
          "Já existe um contrato para esta família.\n\nOK = atualizar esse contrato com os dados atuais.\nCancelar = apenas abrir o contrato já existente."
        );
      }

      const result = await openOrReuseFamilyContractCallable({ refreshExisting });
      const payload = result?.data || {};

      if (!payload?.contractId && payload?.action !== "validated_download") {
        toast.error("Não foi possível localizar ou criar o contrato.");
        return;
      }

      if (payload?.action === "validated_download") {
        const validatedContract = payload?.contract || latestContract;
        const url = payload?.contract?.validated_url || payload?.contract?.final_url || (await resolveStoredContractUrl(validatedContract));

        if (!url) {
          toast.error("O contrato foi validado, mas não encontrei o arquivo salvo.");
          return;
        }

        openUrlInBrowser(url);
        toast.success("Abrindo o contrato validado salvo.");
        return;
      }

      if (payload?.action === "open_existing_review") {
        toast.message("Seu contrato já foi enviado e está aguardando aprovação. Vou abrir o registro atual.");
      } else if (payload?.action === "updated_existing") {
        toast.success("Contrato existente atualizado com os dados mais recentes.");
      } else if (payload?.action === "created_new") {
        toast.success("Contrato aberto! Clique em Concordo e imprimir para gerar o PDF.");
      }

      navigate(`/family/contract/view/${payload.contractId}`);
    } catch (err) {
      console.error("Erro ao abrir contrato:", err);
      toast.error(err?.message || "Erro ao abrir contrato. Tente novamente.");
    } finally {
      setDownloadingContract(false);
    }
  }

  async function handleUploadSignedContract() {
    if (uploadingSigned) return;

    if (uploadLocked) {
      toast.message(
        validated
          ? "Seu contrato já foi validado."
          : "Seu contrato já foi enviado e está aguardando aprovação."
      );
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("Você precisa estar logado.");
      return;
    }

    if (!latestContract) {
      toast.error("Primeiro abra o contrato para gerar seu registro.");
      return;
    }

    if (!canUploadSigned) {
      toast.message("Envio indisponível para o status atual do contrato.");
      return;
    }

    if (!signedFile) {
      toast.error("Selecione o PDF assinado.");
      return;
    }

    if (signedFile.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }

    const TIMEOUT_MS = 90000;
    setUploadingSigned(true);
    setSignedProgress(0);

    let timeoutId = null;

    try {
      const safeName = sanitizeFileName(family?.full_name || "cliente");
      const safeCpf = sanitizeFileName((family?.cpf || "").replace(/\D/g, "")) || "semcpf";
      const safeOrig = sanitizeFileName(signedFile.name || "assinado.pdf");

      const signedPath = `contracts/signed/${user.uid}/contrato_assinado_${safeName}_${safeCpf}_${Date.now()}_${safeOrig}`;
      const fileRef = storageRef(storage, signedPath);
      const uploadTask = uploadBytesResumable(fileRef, signedFile, {
        contentType: "application/pdf",
      });

      const signedUrl = await new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          try {
            uploadTask.cancel();
          } catch (_) {}
          reject(new Error("O upload demorou demais e foi cancelado. Tente novamente."));
        }, TIMEOUT_MS);

        const unsub = uploadTask.on(
          "state_changed",
          (snap) => {
            if (!snap.totalBytes) return;
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setSignedProgress(pct);
          },
          (err) => {
            unsub?.();
            reject(err);
          },
          async () => {
            unsub?.();
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (e) {
              reject(e);
            }
          }
        );
      });

      clearTimeout(timeoutId);

      const result = await markSignedUploadedCallable({
        contractId: latestContract.id,
        signedStoragePath: signedPath,
        signedUrl,
      });

      const payload = result?.data || {};
      if (payload?.ok === false) {
        toast.message(payload?.message || "Não foi possível registrar o envio do contrato.");
        return;
      }

      toast.success(refused ? "Contrato reenviado com sucesso!" : "Contrato assinado enviado com sucesso!");
      setSignedFile(null);
      setSignedProgress(0);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Erro no upload do assinado:", err);
      toast.error(err?.message || "Erro ao enviar contrato assinado.");
      setSignedProgress(0);
    } finally {
      setUploadingSigned(false);
    }
  }

  if (loading) return <p>Carregando...</p>;
  if (!family) return <p>Dados não encontrados.</p>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90">Bem-vindo(a) de volta,</p>
          <h1 className="text-2xl font-bold">{family.full_name}</h1>
          <p className="text-sm opacity-90 mt-1">
            "Aqui você troca a conta de luz por um futuro melhor"
          </p>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <Sun className="w-6 h-6" />
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="text-amber-600" />
              <h3 className="font-semibold">Contrato</h3>
            </div>
            <span className="text-xs text-slate-500">Baixe preenchido, assine e envie</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="font-medium">Status do seu contrato</p>

              {validated && (
                <span className="inline-flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Validado ✅
                </span>
              )}

              {awaitingApproval && (
                <span className="inline-flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Aguardando aprovação
                </span>
              )}

              {refused && (
                <span className="inline-flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                  <XCircle className="w-4 h-4" />
                  Recusado
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600">
              {latestContract ? (
                <>
                  Último status: <strong>{contractStatusText(latestContract)}</strong>
                </>
              ) : (
                <>Nenhum registro de contrato encontrado ainda. Clique em “Abrir Contrato” para gerar.</>
              )}
            </div>
          </div>

          {showRefusedNote && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 space-y-2">
              <p className="font-medium">Seu contrato foi recusado ❌</p>
              <p className="text-sm">
                <strong>Motivo:</strong> {latestContract.validation_note}
              </p>
              <p className="text-sm">
                Corrija o problema (ex.: assinatura, páginas faltando, arquivo ilegível) e envie novamente.
              </p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">Como funciona:</p>
            <p>
              1) Abra o contrato preenchido. 2) Assine no gov.br. 3) Envie o PDF assinado aqui.
              A decisão crítica de criar, reaproveitar, travar e mudar status agora passa pelo backend.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600"
              onClick={handleDownloadContract}
              disabled={downloadingContract}
            >
              {downloadingContract ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando contrato...
                </>
              ) : validated ? (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar contrato validado
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Abrir Contrato (imprimir)
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(GOV_SIGN_URL, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Assinar no gov.br (meu.gov)
            </Button>
          </div>

          <div className="border rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-900">Enviar contrato assinado (PDF)</p>

            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setSignedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
              disabled={uploadingSigned || uploadLocked || !latestContract || !canUploadSigned}
            />

            {!latestContract && (
              <p className="text-xs text-slate-500">
                Primeiro abra o contrato para gerar ou localizar o seu registro.
              </p>
            )}

            {latestContract && !canUploadSigned && !uploadLocked && (
              <p className="text-xs text-slate-500">Envio indisponível para o status atual.</p>
            )}

            {signedFile && (
              <p className="text-xs text-slate-500">
                Selecionado: <strong>{signedFile.name}</strong>
              </p>
            )}

            {uploadingSigned && (
              <p className="text-xs text-slate-600">
                Enviando: <strong>{signedProgress}%</strong>
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleUploadSignedContract}
              disabled={uploadingSigned || uploadLocked || !signedFile || !latestContract || !canUploadSigned}
            >
              {uploadingSigned ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando contrato assinado...
                </>
              ) : validated ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Contrato validado ✅
                </>
              ) : awaitingApproval ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Arquivo enviado • aguardando aprovação
                </>
              ) : refused ? (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Reenviar contrato assinado
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar contrato assinado
                </>
              )}
            </Button>

            {awaitingApproval && (
              <p className="text-xs text-slate-500">
                Seu arquivo já foi recebido. Agora estamos validando — você será notificado quando concluir.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

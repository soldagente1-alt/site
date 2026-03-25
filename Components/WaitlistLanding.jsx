import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

const FUNCTIONS_REGION = "us-central1";

function tsToDate(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

function fmtDateTime(v) {
  const d = tsToDate(v);
  if (!d) return "—";
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function numOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function directionLabel(direction, delta) {
  const d = String(direction || "").toLowerCase();
  const n = Math.abs(numOr(delta, 0));
  if (d === "up") return `↑ +${n}`;
  if (d === "down") return `↓ -${n}`;
  if (d === "new") return "Novo";
  return "—";
}

function getFunctionsBase() {
  const projectId = auth?.app?.options?.projectId || db?.app?.options?.projectId || "";
  if (!projectId) throw new Error("Project ID não encontrado no Firebase.");
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net`;
}

async function callPublicFunction(path, body = {}) {
  const res = await fetch(`${getFunctionsBase()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data?.error || "Falha ao carregar fila pública.");
  }

  return data;
}

function MoveBadge({ direction, delta }) {
  const d = String(direction || "").toLowerCase();
  const n = Math.abs(numOr(delta, 0));
  const base = "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border";
  if (d === "up") {
    return (
      <span className={`${base} text-emerald-700 bg-emerald-50 border-emerald-200`}>
        <ArrowUpRight className="w-3.5 h-3.5" /> +{n}
      </span>
    );
  }
  if (d === "down") {
    return (
      <span className={`${base} text-rose-700 bg-rose-50 border-rose-200`}>
        <ArrowDownRight className="w-3.5 h-3.5" /> -{n}
      </span>
    );
  }
  if (d === "new") {
    return (
      <span className={`${base} text-amber-700 bg-amber-50 border-amber-200`}>
        <Sparkles className="w-3.5 h-3.5" /> Novo
      </span>
    );
  }
  return (
    <span className={`${base} text-slate-700 bg-slate-50 border-slate-200`}>
      <Clock className="w-3.5 h-3.5" /> 0
    </span>
  );
}

export default function WaitlistLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlGroup = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get("group") || null;
    } catch {
      return null;
    }
  }, [location.search]);

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState({
    availability: null,
    queueRows: [],
    moves: [],
  });

  async function loadSnapshot() {
    setLoading(true);
    try {
      const data = await callPublicFunction("getPublicWaitlistSnapshot", {
        groupId: urlGroup || null,
      });
      setSnapshot({
        availability: data?.availability || null,
        queueRows: data?.queueRows || [],
        moves: data?.moves || [],
      });
    } catch (e) {
      setSnapshot({ availability: null, queueRows: [], moves: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSnapshot();
    const id = window.setInterval(loadSnapshot, 30000);
    return () => window.clearInterval(id);
  }, [urlGroup]);

  const availability = snapshot.availability || {};
  const queueRows = snapshot.queueRows || [];
  const moves = snapshot.moves || [];
  const groupCapacity = availability?.groupCapacity || {};
  const headerSubtitle = loading
    ? "Carregando…"
    : !availability?.groupId
      ? "Sem grupo aberto no momento."
      : `${groupCapacity.name || "Grupo"} • ${groupCapacity.used || 0}/${groupCapacity.total || 0} ocupadas`;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500">
        <div className="max-w-7xl mx-auto px-6 py-10 text-white">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-sm">
                <ShieldCheck className="w-4 h-4" />
                Fila do Sol • Transparência total
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mt-4 leading-tight">
                Acompanhe a fila e entenda as regras.
              </h1>

              <p className="mt-3 text-white/90">
                Aqui você vê a ordem real de chamada. Cada família aparece apenas com um código público.
              </p>

              <div className="mt-6 flex gap-3 flex-wrap">
                <Button
                  type="button"
                  className="!bg-white !text-amber-700 hover:!bg-white/90 !border !border-white/60 shadow-sm"
                  asChild
                >
                  <Link to="/waitlist">Entrar na fila</Link>
                </Button>

                <Button
                  variant="outline"
                  className="bg-transparent text-white border border-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => navigate("/")}
                >
                  Voltar para o site
                </Button>
              </div>

              <div className="mt-4 text-sm text-white/90">{headerSubtitle}</div>
            </div>

            <div className="w-full sm:w-[420px]">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-900">Status do grupo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loading ? (
                    <p className="text-sm text-slate-600">Carregando grupo…</p>
                  ) : !availability?.groupId ? (
                    <div className="p-4 bg-slate-50 rounded-xl border">
                      <p className="text-sm text-slate-700">
                        No momento, não encontramos um grupo aberto com fila.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">Grupo</p>
                          <p className="font-semibold text-slate-900 truncate">
                            {groupCapacity.name || "Grupo"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-slate-500">Inscrições</p>
                          <p className="text-2xl font-bold text-slate-900">
                            {groupCapacity.available || 0}
                            <span className="text-sm font-semibold text-slate-500">/{groupCapacity.total || 0}</span>
                          </p>
                        </div>
                      </div>

                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${groupCapacity.filledPct || 0}%` }}
                        />
                      </div>

                      <div className="text-xs text-slate-600">
                        Titulares: <strong>{groupCapacity.primaryUsed || 0}/{groupCapacity.baseCapacity || 0}</strong>
                        {" • "}Lista de espera: <strong>{groupCapacity.standbyUsed || 0}</strong>
                        {" • "}Overbook: <strong>{Math.round((groupCapacity.overbookPct || 0) * 100)}%</strong>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-700" />
                  Fila de Espera
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Ordem real (1º ao último) com histórico público das últimas movimentações.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="p-4 bg-slate-50 border rounded-xl text-sm text-slate-700">
                    Carregando fila…
                  </div>
                ) : !availability?.groupId ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    Sem grupo aberto no momento.
                  </div>
                ) : queueRows.length === 0 ? (
                  <div className="p-4 bg-slate-50 border rounded-xl text-sm text-slate-700">
                    Nenhum registro ainda para este grupo.
                  </div>
                ) : (
                  <div className="divide-y">
                    {queueRows.map((row, idx) => (
                      <div key={row.id} className="py-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 shrink-0 text-center">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center font-bold text-amber-800">
                              {idx + 1}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 truncate">
                                    {row.public_code || row.waitlist_position || row.id}
                                  </span>
                                  <MoveBadge direction={row.last_move?.direction} delta={row.last_move?.delta} />
                                </div>

                                <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                  <span>Posição geral: #{row.waitlist_position || "—"}</span>
                                  <span>Posição no grupo: {row.group_queue_position ? `#${row.group_queue_position}` : "—"}</span>
                                  <span>Atualizado: {fmtDateTime(row.last_move?.created_at || row.queue_updated_at || row.updated_at || row.created_at)}</span>
                                </div>

                                {row.last_move?.reason ? (
                                  <div className="mt-2 text-xs text-slate-500">
                                    Último motivo: {row.last_move.reason}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-slate-900">Últimas movimentações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando…</p>
                ) : moves.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem movimentações públicas recentes.</p>
                ) : (
                  moves.slice(0, 12).map((m) => (
                    <div key={m.id} className="rounded-xl border p-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {m.public_code || m.waitlist_position || "—"}
                        </span>
                        <MoveBadge direction={m.direction} delta={m.delta} />
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {directionLabel(m.direction, m.delta)} • {fmtDateTime(m.created_at)}
                      </div>
                      {m.reason ? (
                        <div className="mt-2 text-xs text-slate-600">{m.reason}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

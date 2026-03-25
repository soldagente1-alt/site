import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Sun,
  Zap,
  Shield,
  TrendingUp,
  CheckCircle2,
  Clock,
  Award,
} from "lucide-react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  query,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";

const VIDEOS_COL = "Family_Educations";
const PROGRESS_COL = "EducationProgress";

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getThumb(v) {
  return (
    v?.thumbnail ||
    v?.thumbnail_url ||
    v?.thumbnailUrl ||
    v?.thumb ||
    ""
  );
}

function normalizeUrl(u) {
  return String(u || "").trim();
}

function youtubeToEmbed(url) {
  const u = normalizeUrl(url);

  const m1 = u.match(/[?&]v=([^&]+)/);
  if (m1?.[1]) return `https://www.youtube.com/embed/${m1[1]}`;

  const m2 = u.match(/youtu\.be\/([^?&]+)/);
  if (m2?.[1]) return `https://www.youtube.com/embed/${m2[1]}`;

  if (u.includes("youtube.com/embed/")) return u;

  return null;
}

function isYouTube(url) {
  const u = normalizeUrl(url);
  return u.includes("youtube.com") || u.includes("youtu.be");
}



export default function FamilyEducation() {
  const [videos, setVideos] = useState([]);
  const [watchedVideos, setWatchedVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const selectedUrl = normalizeUrl(selectedVideo?.video_url);
  const isYT = !!selectedUrl && isYouTube(selectedUrl);
  const ytEmbedUrl = isYT ? youtubeToEmbed(selectedUrl) : null;

  /* =========================
     LOAD (videos + progress)
  ========================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFamilyId(null);
        setVideos([]);
        setWatchedVideos([]);
        setSelectedVideo(null);
        setLoading(false);
        return;
      }

      setFamilyId(user.uid);
      setLoading(true);

      try {
        // 1) Videos
        const vq = query(collection(db, VIDEOS_COL), orderBy("order", "asc"));
        const videosSnap = await getDocs(vq);

        const list = videosSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => safeNum(a.order, 9999) - safeNum(b.order, 9999))
          .filter((v) => v.active === true); // filtra active no front pra evitar índice

        setVideos(list);

        // 2) Progress
        const progressRef = doc(db, PROGRESS_COL, user.uid);
        const progressSnap = await getDoc(progressRef);

        if (progressSnap.exists()) {
          setWatchedVideos(progressSnap.data().watchedVideos || []);
        } else {
          await setDoc(progressRef, {
            family_id: user.uid,
            watchedVideos: [],
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
          setWatchedVideos([]);
        }
      } catch (err) {
        console.error("Erro ao carregar educação:", err);
        toast.error("Erro ao carregar vídeos.");
      } finally {
        setLoading(false);
      }
    });
    
    return () => {
      try { unsub?.(); } catch (_) {}
    };
  }, []);

  /* =========================
     MARK AS WATCHED (on click open)
     - grava array no doc EducationProgress/{familyId}
     - grava auditoria por vídeo: EducationProgress/{familyId}/Videos/{videoId}
  ========================= */
  async function markAsWatched(videoId) {
    if (!familyId) return;
    if (!videoId) return;
    if (watchedVideos.includes(videoId)) return;

    // otimista
    setWatchedVideos((prev) => [...prev, videoId]);

    try {
      const progressRef = doc(db, PROGRESS_COL, familyId);

      // garante doc existe
      await setDoc(
        progressRef,
        { family_id: familyId, updated_at: serverTimestamp() },
        { merge: true }
      );

      // arrayUnion evita sobrescrever em concorrência
      await updateDoc(progressRef, {
        watchedVideos: arrayUnion(videoId),
        updated_at: serverTimestamp(),
      });

      // auditoria por vídeo/família
      await setDoc(
        doc(db, PROGRESS_COL, familyId, "Videos", videoId),
        {
          family_id: familyId,
          video_id: videoId,
          watched_at: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao marcar assistido:", err);
      toast.error("Não foi possível salvar seu progresso.");
      // rollback simples
      setWatchedVideos((prev) => prev.filter((id) => id !== videoId));
    }
  }

  const videosWithWatched = useMemo(() => {
    return videos.map((v) => ({
      ...v,
      watched: watchedVideos.includes(v.id),
    }));
  }, [videos, watchedVideos]);

  const watchedCount = watchedVideos.length;
  const progressPercent = videosWithWatched.length
    ? Math.round((watchedCount / videosWithWatched.length) * 100)
    : 0;

  /* =========================
     STATIC TIPS & FAQ
  ========================= */
  const tips = [
    { icon: Sun, title: "Mantenha os painéis limpos", description: "Limpeza a cada 6 meses com pano macio." },
    { icon: Shield, title: "Evite sombras", description: "Árvores e objetos reduzem eficiência." },
    { icon: Zap, title: "Use energia de dia", description: "Aproveite maior geração solar." },
    { icon: TrendingUp, title: "Monitore a geração", description: "Acompanhe pelo app." }
  ];

  const faqs = [
    { question: "O kit funciona à noite?", answer: "À noite você usa créditos acumulados ou a rede." },
    { question: "Funciona em dias nublados?", answer: "Sim, com menor geração." },
    { question: "Precisa manutenção?", answer: "Apenas limpeza periódica." },
    { question: "Vida útil?", answer: "Mais de 25 anos." }
  ];

  if (loading) return <p>Carregando...</p>;

function closeVideoModal() {
  // fecha o modal primeiro
  setModalOpen(false);

  // depois desmonta o vídeo (evita play/pause no unmount)
  setTimeout(() => {
    setSelectedVideo(null);
  }, 120);
}

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Central de Aprendizado</h1>
        <p className="text-slate-600">Aprenda sobre energia solar de forma simples</p>
      </div>

      {/* PROGRESS */}
      <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
        <CardContent className="p-6 flex justify-between">
          <div>
            <p className="text-purple-100 text-sm">Seu progresso</p>
            <p className="text-2xl font-bold mt-1">
              {watchedCount} de {videosWithWatched.length} vídeos assistidos
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 bg-purple-400 rounded-full w-48">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span>{progressPercent}%</span>
            </div>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>
        </CardContent>
      </Card>

      {/* VIDEOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-red-500" />
            Vídeos Educativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videosWithWatched.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="group cursor-pointer"
                onClick={async () => {
                  setSelectedVideo(video);
                  setModalOpen(true);
                  markAsWatched(video.id);
                }}
                >
                  <div className="relative rounded-xl overflow-hidden mb-3 aspect-video bg-slate-100">
                    {getThumb(video) ? (
                      <img
                        src={getThumb(video)}
                        alt={video.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                        <Play className="w-10 h-10 opacity-60" />
                      </div>
                    )}

                    {/* overlay play */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-slate-900 ml-1" />
                      </div>
                    </div>

                    {video.duration ? (
                      <Badge className="absolute top-2 right-2 bg-black/60 text-white">
                        <Clock className="w-3 h-3 mr-1" />
                        {video.duration}
                      </Badge>
                    ) : null}

                    {video.watched && (
                      <div className="absolute top-2 left-2">
                        <CheckCircle2 className="w-6 h-6 text-green-600 bg-white rounded-full" />
                      </div>
                    )}
                  </div>


                <Badge className="mb-2" variant="secondary">
                  {video.category || "Geral"}
                </Badge>

                <h3 className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors">
                  {video.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                  {video.description}
                </p>
              </motion.div>
            ))}

            {videosWithWatched.length === 0 && (
              <p className="text-slate-500 text-sm">
                Nenhum vídeo ativo cadastrado ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TIPS */}
      <Card>
        <CardHeader>
          <CardTitle>Dicas Importantes</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          {tips.map((t) => (
            <div key={t.title} className="flex gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <t.icon className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="text-sm text-slate-600">{t.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {faqs.map((faq, i) => (
            <details key={i}>
              <summary className="cursor-pointer font-medium">{faq.question}</summary>
              <p className="mt-2 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </CardContent>
      </Card>

      {/* MODAL PLAYER */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) closeVideoModal();
        }}
      >
        <DialogContent className="w-[95vw] max-w-5xl">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
              {!selectedUrl ? (
                <div className="w-full h-full flex items-center justify-center text-white/80">
                  Esse vídeo ainda não tem <strong className="ml-1">video_url</strong> cadastrado.
                </div>
              ) : isYT && ytEmbedUrl ? (
                <iframe
                  key={selectedVideo?.id}
                  src={`${ytEmbedUrl}?autoplay=0&rel=0&modestbranding=1`}
                  title={selectedVideo?.title || "Vídeo"}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video
                  key={selectedVideo?.id}
                  src={selectedUrl}
                  className="w-full h-full"
                  controls
                  preload="metadata"
                  playsInline
                  onError={(e) => console.log("Video error:", e)}
                >
                  Seu navegador não conseguiu reproduzir este vídeo.
                </video>
              )}
            </div>

            {selectedVideo?.description ? (
              <p className="text-sm text-slate-600">{selectedVideo.description}</p>
            ) : null}

            {selectedUrl ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 underline"
                  onClick={() => window.open(selectedUrl, "_blank")}
                >
                  {isYT ? "Abrir no YouTube" : "Abrir vídeo"}
                </button>

                <button
                  type="button"
                  className="text-sm text-slate-600 underline"
                  onClick={closeVideoModal}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm text-slate-600 underline"
                onClick={closeVideoModal}
              >
                Fechar
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>



    </div>
  );
}

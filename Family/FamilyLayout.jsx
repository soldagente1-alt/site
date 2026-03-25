// FamilyLayout.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../api/firebaseAuth";
import { db } from "../../api/firebaseDb";
import { useAuth } from "../../context/AuthContext";

import {
  Sun,
  Home,
  CreditCard,
  FileText,
  BookOpen,
  Menu,
  X,
  Bell,
  LogOut,
  User,
  ChevronDown,
  MessageCircle,
  Headset,
  BookMarked,
} from "lucide-react";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  limit,
  setDoc,
  updateDoc,
} from "firebase/firestore";

export default function FamilyLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminNotifs, setAdminNotifs] = useState([]);
  const [readMap, setReadMap] = useState({});
  const [cutoffAt, setCutoffAt] = useState(null); // Timestamp (prefer) OR Date fallback

  const notifBoxRef = useRef(null);

  async function handleLogout() {
    await signOut(auth);
    navigate("/landing");
  }

  const menuItems = [
    { name: "Início", icon: Home, path: "/family/dashboard" },
    { name: "Documentos", icon: BookMarked, path: "/family/documents" },
    { name: "Meu Plano", icon: Sun, path: "/family/plan" },
    { name: "Financeiro", icon: CreditCard, path: "/family/payments" },
    { name: "Contrato", icon: FileText, path: "/family/contract" },
    { name: "Aprender", icon: BookOpen, path: "/family/education" },
    { name: "Suporte", icon: Headset, path: "/family/suporte" },
  ];

  function tsToDate(ts) {
    try {
      if (!ts) return null;
      if (ts instanceof Date) return ts;
      return ts?.toDate ? ts.toDate() : null;
    } catch {
      return null;
    }
  }

  /* =========================
     1) Load Family cutoff:
        - notifications_cutoff_at (best)
        - else createdAt / created_at
        - else set now (serverTimestamp) to avoid showing history on 1st login
  ========================= */
  useEffect(() => {
    if (!user?.uid) {
      setCutoffAt(null);
      return;
    }

    const ref = doc(db, "Family", user.uid);

    const unsub = onSnapshot(
      ref,
      async (snap) => {
        const data = snap.data() || {};

        const existingCutoff =
          data.notifications_cutoff_at ||
          data.createdAt ||
          data.created_at ||
          null;

        if (existingCutoff) {
          setCutoffAt(existingCutoff);

          // if cutoff field missing, persist it once (so you can query by it)
          if (!data.notifications_cutoff_at) {
            try {
              await updateDoc(ref, {
                notifications_cutoff_at: existingCutoff,
                updated_at: serverTimestamp(),
              });
            } catch (_) {
              // ignore (permissions/index/etc)
            }
          }
          return;
        }

        // no cutoff + no createdAt => prevent showing the whole history
        // set immediate local cutoff so UI doesn't flash old notifs
        const localNow = new Date();
        setCutoffAt(localNow);

        try {
          await updateDoc(ref, {
            notifications_cutoff_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        } catch (_) {
          // ignore
        }
      },
      () => {
        // if cannot read family doc, keep safe cutoff to avoid history
        setCutoffAt(new Date());
      }
    );

    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, [user?.uid]);

  /* =========================
     2) Subscribe AdminNotifications (only AFTER cutoff loaded)
        Best: query by created_at >= cutoff and target_role in ["all","family"].
        If index/query fails, fallback to simple last 50 and filter client-side.
  ========================= */
  useEffect(() => {
    if (!user?.uid) {
      setAdminNotifs([]);
      return;
    }
    if (!cutoffAt) {
      setAdminNotifs([]);
      return;
    }

    const cutoffDate = tsToDate(cutoffAt);
    const cutoffForQuery = cutoffAt?.toDate ? cutoffAt : null;

    let unsub = null;

    // Primary query (fast + correct)
    if (cutoffForQuery) {
      const qy = query(
        collection(db, "AdminNotifications"),
        where("target_role", "in", ["all", "family"]),
        where("created_at", ">=", cutoffForQuery),
        orderBy("created_at", "desc"),
        limit(50)
      );

      unsub = onSnapshot(
        qy,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAdminNotifs(list);
        },
        (err) => {
          // Fallback (no index / permissions / etc)
          console.warn("AdminNotifications query (cutoff) falhou, usando fallback:", err);

          try {
            unsub?.();
          } catch (_) {}

          const fallbackQ = query(
            collection(db, "AdminNotifications"),
            orderBy("created_at", "desc"),
            limit(50)
          );

          unsub = onSnapshot(
            fallbackQ,
            (snap) => {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              // filter by cutoff + role on client
              const filtered = list.filter((n) => {
                const role = String(n.target_role || "all").toLowerCase();
                if (!(role === "all" || role === "family")) return false;

                const created = tsToDate(n.created_at);
                if (cutoffDate && created && created < cutoffDate) return false;

                return true;
              });
              setAdminNotifs(filtered);
            },
            (err2) => {
              console.warn("AdminNotifications fallback falhou:", err2);
              setAdminNotifs([]);
            }
          );
        }
      );
    } else {
      // If cutoff is Date only (temporary), use fallback and filter
      const qy = query(
        collection(db, "AdminNotifications"),
        orderBy("created_at", "desc"),
        limit(50)
      );

      unsub = onSnapshot(
        qy,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const filtered = list.filter((n) => {
            const role = String(n.target_role || "all").toLowerCase();
            if (!(role === "all" || role === "family")) return false;

            const created = tsToDate(n.created_at);
            if (cutoffDate && created && created < cutoffDate) return false;

            return true;
          });
          setAdminNotifs(filtered);
        },
        (err) => {
          console.warn("Falha ao carregar AdminNotifications:", err);
          setAdminNotifs([]);
        }
      );
    }

    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, [user?.uid, cutoffAt]);

  /* =========================
     3) Subscribe reads map (per user)
  ========================= */
  useEffect(() => {
    if (!user?.uid) {
      setReadMap({});
      return;
    }

    const qy = query(
      collection(db, "Family", user.uid, "NotificationReads"),
      orderBy("read_at", "desc"),
      limit(300)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = true;
        });
        setReadMap(map);
      },
      (err) => {
        console.warn("Falha ao carregar NotificationReads:", err);
        setReadMap({});
      }
    );

    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, [user?.uid]);

  /* =========================
     4) Final filter (safety):
        - role match (all/family)
        - optional user targeting: user_id === uid OR "all" (if field exists)
        - cutoff (if still needed)
  ========================= */
  const receivedNotifs = useMemo(() => {
    const uid = user?.uid;
    const cutoffDate = tsToDate(cutoffAt);

    return (adminNotifs || []).filter((n) => {
      const role = String(n.target_role || "all").toLowerCase();
      if (!(role === "all" || role === "family")) return false;

      // Optional: if you later add "user_id" targeting on AdminNotifications
      const userId = n.user_id;
      if (userId) {
        if (!(userId === "all" || userId === uid)) return false;
      }

      // Safety cutoff (covers fallback query / any weirdness)
      if (cutoffDate) {
        const created = tsToDate(n.created_at);
        if (created && created < cutoffDate) return false;
      }

      return true;
    });
  }, [adminNotifs, user?.uid, cutoffAt]);

  const unreadCount = useMemo(() => {
    let c = 0;
    for (const n of receivedNotifs) {
      if (!readMap[n.id]) c += 1;
    }
    return c;
  }, [receivedNotifs, readMap]);

  function fmtWhen(ts) {
    try {
      const d = tsToDate(ts);
      if (!d) return "";
      return d.toLocaleString("pt-BR");
    } catch {
      return "";
    }
  }

  async function markAsRead(notificationId) {
    if (!user?.uid || !notificationId) return;
    try {
      await setDoc(
        doc(db, "Family", user.uid, "NotificationReads", notificationId),
        { read_at: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.warn("Falha ao marcar notificação como lida:", err);
    }
  }

  function buildTargetUrl(n) {
    const route = n?.target?.route;
    if (!route || route === "none") return null;

    if (route === "/family/suporte") {
      const tid = n?.target?.ticket_id;
      const tnum = n?.target?.ticket_number;

      if (tid) return `/family/suporte?ticket=${encodeURIComponent(tid)}`;
      if (tnum) return `/family/suporte?ticket_number=${encodeURIComponent(tnum)}`;
      return "/family/suporte";
    }

    if (route === "/family/payments") return "/family/payments";
    if (route === "/family/contract") return "/family/contract";

    return route;
  }

  async function openNotif(n) {
    if (!n?.id) return;

    await markAsRead(n.id);

    const url = buildTargetUrl(n) || "/family/suporte";

    setNotifOpen(false);
    setUserMenuOpen(false);
    navigate(url);
  }

  /* =========================
     CLICK OUTSIDE to close menus
  ========================= */
  useEffect(() => {
    function onDocClick(e) {
      const target = e.target;
      if (!target) return;

      if (userMenuOpen) {
        const withinUser = target.closest?.("[data-user-menu]");
        if (!withinUser) setUserMenuOpen(false);
      }

      if (notifOpen) {
        const withinNotif = target.closest?.("[data-notif-box]");
        if (!withinNotif) setNotifOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [userMenuOpen, notifOpen]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      {/* ================= HEADER ================= */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button className="lg:hidden" onClick={() => setMobileMenuOpen(true)}>
            <Menu />
          </button>

          <NavLink to="/family/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <Sun className="text-white" />
            </div>
            <span className="font-bold hidden sm:block">Sol da Gente</span>
          </NavLink>
        </div>

        <div className="flex items-center gap-4">
          {/* Notificações */}
          <div className="relative" ref={notifBoxRef} data-notif-box>
            <button
              className="p-2 rounded-full hover:bg-slate-100 relative"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="w-5 h-5 text-slate-600" />

              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <div className="absolute right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b">
                  <div className="font-semibold text-sm">Notificações</div>
                  <div className="text-xs text-slate-500">{unreadCount} não lida(s)</div>
                </div>

                {receivedNotifs.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600">Sem notificações.</div>
                ) : (
                  <div className="max-h-[360px] overflow-auto">
                    {receivedNotifs.map((n) => {
                      const isUnread = !readMap[n.id];
                      return (
                        <button
                          key={n.id}
                          onClick={() => openNotif(n)}
                          className={`w-full text-left px-4 py-3 border-b hover:bg-slate-50 ${
                            isUnread ? "bg-amber-50" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-slate-900 line-clamp-1">
                              {n.title || "Notificação"}
                            </div>
                            <div className="text-[11px] text-slate-500 whitespace-nowrap">
                              {fmtWhen(n.created_at)}
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 line-clamp-2 mt-1">
                            {n.message || ""}
                          </div>
                          {n?.target?.route && n.target.route !== "none" ? (
                            <div className="text-[11px] text-slate-500 mt-1">
                              Ir para: <span className="font-medium">{n.target.route}</span>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* WhatsApp */}
          <MessageCircle className="text-green-600 cursor-pointer" />

          {/* Usuário */}
          <div className="relative" data-user-menu>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 transition"
            >
              <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-semibold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium">{user?.email}</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border rounded-xl shadow-lg overflow-hidden z-50">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/family/profile");
                  }}
                >
                  <User className="w-4 h-4" />
                  Meu Perfil
                </button>

                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= BODY ================= */}
      <div className="flex pt-16 h-full">
        {/* SIDEBAR */}
        <aside className="hidden lg:flex w-64 flex-col bg-white border-r">
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl ${
                    isActive
                      ? "bg-amber-100 text-amber-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* CARD AJUDA */}
          <div className="mt-auto px-4 pb-4">
            <div className="bg-amber-400 rounded-2xl p-4 text-white shadow-md">
              <p className="font-semibold text-sm mb-1">Precisa de ajuda?</p>
              <p className="text-xs leading-snug mb-4">Nossa equipe está pronta para te ajudar</p>

              <button
                className="w-full bg-white text-amber-600 font-semibold py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-amber-50 transition"
                onClick={() =>
                  window.open(
                    "https://wa.me/5511999999999?text=Olá! Acabei de me cadastrar no Sol da Gente",
                    "_blank"
                  )
                }
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="mb-4" onClick={() => setMobileMenuOpen(false)}>
              <X />
            </button>

            <nav className="space-y-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-100"
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}

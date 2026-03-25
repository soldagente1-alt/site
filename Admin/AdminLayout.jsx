import React, { useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Bell,
  DollarSign,
  LogOut,
  PlayCircle,
  LifeBuoy,
  ChevronDown,
  UsersRound
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { logout } from "../../api/authService";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
  }

  const menu = useMemo(
    () => [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/admin/dashboard",
      },
      {
        label: "Famílias",
        icon: Users,
        path: "/admin/families",
      },
      {
        label: "Planos",
        icon: DollarSign,
        path: "/admin/plans",
      },
      {
        label: "Grupos",
        icon: UsersRound,
        path: "/admin/groups",
      },
      {
        label: "Contratos",
        icon: DollarSign,
        path: "/admin/contract",
      },
      {
        label: "Pagamentos",
        icon: DollarSign,
        path: "/admin/payments",
      },
      {
        label: "Financeiro",
        icon: DollarSign,
        groupKey: "financeiro",
        children: [
          { label: "Plano de contas", path: "/admin/financeiro/plano-de-contas" },
          { label: "Lançamentos", path: "/admin/financeiro/lancamentos" },
          { label: "Relatórios", path: "/admin/financeiro/relatorios" },
          { label: "Centros de custo", path: "/admin/financeiro/centros-de-custo" },
        ],
      },
      {
        label: "Notificações",
        icon: Bell,
        path: "/admin/notifications",
      },
      {
        label: "Videos de Educação",
        icon: PlayCircle,
        path: "/admin/cad-videos",
      },
      {
        label: "Lista de Espera",
        icon: LifeBuoy,
        groupKey: "Lista espera",
        children: [
          { label: "Pré-aprovação", path: "/admin/adminwaitlist" },
          { label: "Movimentação", path: "/admin/adminwaitlistmove" },
        ],
        
      },  
      {
        label: "Área Técnica",
        icon: DollarSign,
        groupKey: "thecnical",
        children: [
          { label: "Agenda", path: "/admin/thecnical/agend" },
          { label: "Visitas/Instalações", path: "/admin/thecnical/technician" },
          { label: "RT/Engenheiro", path: "/admin/thecnical/engineer" },
          { label: "Homologação", path: "/admin/thecnical/Homologacao" },
        ],
      },    
      {
        label: "Acessos",
        icon: LifeBuoy,
        path: "/admin/access",
      },
      {
        label: "Chamados",
        icon: Users,
        path: "/admin/admintickets",
      },
    ],
    []
  );

  const isGroupActive = (children) => {
    return children?.some((c) => location.pathname.startsWith(c.path));
  };

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    menu.forEach((item) => {
      if (item.children?.length) {
        initial[item.groupKey] = isGroupActive(item.children);
      }
    });
    return initial;
  });

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const linkClass = ({ isActive }) =>
    `
      flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium
      transition-colors
      ${isActive ? "bg-amber-100 text-amber-700" : "text-slate-600 hover:bg-slate-100"}
    `;

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* ===== MENU LATERAL ===== */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-slate-900">Sol da Gente</h2>
          <p className="text-sm text-slate-500">Administração</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;

            // Item com submenu
            if (item.children?.length) {
              const active = isGroupActive(item.children);
              const open = openGroups[item.groupKey] ?? active;

              return (
                <div key={item.groupKey} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.groupKey)}
                    className={`
                      w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium
                      transition-colors
                      ${active ? "bg-amber-100 text-amber-700" : "text-slate-600 hover:bg-slate-100"}
                    `}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {open && (
                    <div className="pl-4 space-y-1">
                      {item.children.map((child) => (
                        <NavLink key={child.path} to={child.path} className={linkClass}>
                          <span className="ml-3 text-sm">{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Item normal
            return (
              <NavLink key={item.path} to={item.path} className={linkClass}>
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full flex items-center gap-2"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* ===== CONTEÚDO ===== */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-16 bg-white border-b flex items-center px-6">
          <h1 className="text-lg font-semibold text-slate-800">Painel Administrativo</h1>
        </div>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

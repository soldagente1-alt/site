import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Sun,
  DollarSign,
  Megaphone,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { logout } from "../../api/authService";

export default function FranchiseLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
  }

  const menu = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/franchise/dashboard" },
    { label: "Famílias", icon: Users, path: "/franchise/families" },
    { label: "Grupos", icon: Sun, path: "/franchise/groups" },
    { label: "Financeiro", icon: DollarSign, path: "/franchise/finance" },
    { label: "Marketing", icon: Megaphone, path: "/franchise/marketing" },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-slate-900">Sol da Gente</h2>
          <p className="text-sm text-slate-500">Franquia</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `
                  flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium
                  ${
                    isActive
                      ? "bg-purple-100 text-purple-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }
                `
                }
              >
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-16 bg-white border-b flex items-center px-6">
          <h1 className="text-lg font-semibold text-slate-800">
            Painel da Franquia
          </h1>
        </div>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

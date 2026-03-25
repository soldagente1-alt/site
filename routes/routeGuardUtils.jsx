import { Navigate } from "react-router-dom";

export const ROLE_REDIRECT = {
  admin: "/admin",
  family: "/family",
  investor: "/investor",
  franchise: "/franchise",
};

export function resolveProtectedRoute({ loading, user, allowedRoles }) {
  if (loading) return { type: "loading" };
  if (!user) return { type: "redirect", to: "/firebaseLogin" };
  if (!user.role) return { type: "redirect", to: "/" };
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { type: "redirect", to: ROLE_REDIRECT[user.role] || "/" };
  }
  return { type: "allow" };
}

export function renderProtectedRouteResult(result, children) {
  if (result.type === "loading") {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        Carregando...
      </div>
    );
  }

  if (result.type === "redirect") {
    return <Navigate to={result.to} replace />;
  }

  return children;
}

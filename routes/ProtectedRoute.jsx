import { useAuth } from "../context/AuthContext";
import { renderProtectedRouteResult, resolveProtectedRoute } from "./routeGuardUtils";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const result = resolveProtectedRoute({ loading, user, allowedRoles });
  return renderProtectedRouteResult(result, children);
}

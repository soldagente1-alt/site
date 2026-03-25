import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

export default function PrivateArea({ allowedRoles, children }) {
  return (
    <AuthProvider>
      <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>
    </AuthProvider>
  );
}

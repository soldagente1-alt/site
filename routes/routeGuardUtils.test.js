import { ROLE_REDIRECT, resolveProtectedRoute } from "./routeGuardUtils";

describe("resolveProtectedRoute", () => {
  it("envia usuário sem login para o login", () => {
    expect(resolveProtectedRoute({ loading: false, user: null, allowedRoles: ["admin"] })).toEqual({
      type: "redirect",
      to: "/firebaseLogin",
    });
  });

  it("envia usuário sem role para a home", () => {
    expect(resolveProtectedRoute({ loading: false, user: { uid: "1" }, allowedRoles: ["admin"] })).toEqual({
      type: "redirect",
      to: "/",
    });
  });

  it("redireciona role errada para o dashboard correto", () => {
    for (const [role, target] of Object.entries(ROLE_REDIRECT)) {
      const outcome = resolveProtectedRoute({
        loading: false,
        user: { uid: "u", role },
        allowedRoles: ["admin"],
      });
      if (role === "admin") {
        expect(outcome).toEqual({ type: "allow" });
      } else {
        expect(outcome).toEqual({ type: "redirect", to: target });
      }
    }
  });

  it("permite acesso quando role está autorizada", () => {
    expect(resolveProtectedRoute({
      loading: false,
      user: { uid: "u", role: "family" },
      allowedRoles: ["family"],
    })).toEqual({ type: "allow" });
  });
});

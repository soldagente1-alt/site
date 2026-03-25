import FirebaseLogin from "./firebaseLogin";

export default function Login() {
  function handleLogin(user) {
    console.log("Usuário autenticado:", user);

    // aqui você decide o que fazer:
    // salvar no banco
    // integrar com Base44
    // redirecionar
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <FirebaseLogin onSuccess={handleLogin} />
    </div>
  );
}

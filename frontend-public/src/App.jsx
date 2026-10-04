import { Navigate, Route, Routes } from "react-router-dom";

import GroupDetailPage from "./pages/GroupDetailPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import SuccessPage from "./pages/SuccessPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { useAuth } from "./AuthContext.jsx";

export default function App() {
  const { user, loading, logout } = useAuth();
  if (loading) return <main className="public-main narrow"><p role="status">Consultando registro...</p></main>;
  if (!user) return <LoginPage />;

  return (
    <>
      <header className="public-session-bar">
        <span>{user.member ? `Hola, ${user.member.nombre}` : "Nuevo miembro"}</span>
        <button className="secondary-button" type="button" onClick={logout}>Cambiar celular</button>
      </header>
    <Routes key={user.celular}>
      <Route index element={<HomePage />} />
      <Route path="/grupo/:slug" element={<GroupDetailPage />} />
      <Route path="/gracias" element={<SuccessPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

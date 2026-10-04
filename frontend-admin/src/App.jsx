import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./components/AdminLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AttendancePage from "./pages/admin/AttendancePage.jsx";
import DashboardPage from "./pages/admin/DashboardPage.jsx";
import EventsPage from "./pages/admin/EventsPage.jsx";
import GroupsPage from "./pages/admin/GroupsPage.jsx";
import LoginPage from "./pages/admin/LoginPage.jsx";
import MembersPage from "./pages/admin/MembersPage.jsx";
import DisciplesPage from "./pages/admin/DisciplesPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="asistencia" element={<AttendancePage />} />
        <Route path="miembros" element={<DisciplesPage />} />
        <Route path="miembros/directorio" element={<MembersPage />} />
        <Route path="eventos" element={<EventsPage />} />
        <Route path="grupos" element={<GroupsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

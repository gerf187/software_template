import { Routes, Route, useNavigate } from "react-router-dom";
import Sidebar from "./layout/Sidebar.jsx";
import Start from "./pages/Start.jsx";
import MusterPage from "./pages/MusterPage.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { IconHome, IconSettings } from "./icons/index.js";

const groups = [
  {
    label: "Allgemein",
    items: [
      { key: "start", label: "Start", to: "/", icon: IconHome },
      { key: "muster", label: "Muster", to: "/muster", icon: IconSettings },
    ],
  },
];

function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function abmelden() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-layout">
      <Sidebar
        brand="SaaS-Grundgerüst"
        subtitle="Fundament"
        groups={groups}
        user={user ? { name: user.name, role: user.rolle } : null}
        onLogout={abmelden}
      />
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Start />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/muster"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MusterPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

import { Routes, Route, useNavigate } from "react-router-dom";
import Sidebar from "./layout/Sidebar.jsx";
import Start from "./pages/Start.jsx";
import MusterPage from "./pages/MusterPage.jsx";
import Einstellungen from "./pages/Einstellungen.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { IconHome, IconSettings } from "./icons/index.js";
import TestBanner from "./layout/TestBanner.jsx";
import appConfig from "~app-config";

function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function abmelden() {
    await logout();
    navigate("/login");
  }

  // Menüpunkte blenden nur aus, was der Nutzer laut seinen Rechten nicht
  // sehen darf (Komfort) -- der eigentliche Schutz läuft im Backend (darf()).
  const items = [
    { key: "start", label: "Start", to: "/", icon: IconHome },
    { key: "muster", label: "Muster", to: "/muster", icon: IconSettings },
  ];
  if (user?.rechte?.einstellungen?.sehen) {
    items.push({ key: "einstellungen", label: "Einstellungen", to: "/einstellungen", icon: IconSettings });
  }
  const groups = [{ label: "Allgemein", items }];

  return (
    <>
      {appConfig.testumgebung && <TestBanner />}
      <div className="app-layout">
        <Sidebar
          brand={appConfig.produktname}
          subtitle="Fundament"
          groups={groups}
          user={user ? { name: user.name, role: user.rolle } : null}
          onLogout={abmelden}
        />
        <main className="app-main">{children}</main>
      </div>
    </>
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
      <Route
        path="/einstellungen"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Einstellungen />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

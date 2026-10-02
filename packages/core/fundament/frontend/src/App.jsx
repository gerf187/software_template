import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Sidebar from "./layout/Sidebar.jsx";
import Start from "./pages/Start.jsx";
import Einstellungen from "./pages/Einstellungen.jsx";
import Kontakte from "./pages/Kontakte.jsx";
import KontaktAkte from "./pages/KontaktAkte.jsx";
import PasswortAendern from "./pages/PasswortAendern.jsx";
import SuperadminFirmen from "./pages/SuperadminFirmen.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { IconHome, IconSettings, IconUsers } from "./icons/index.js";
import TestBanner from "./layout/TestBanner.jsx";
import ModulSeite from "./module/ModulSeite.jsx";
import { modulConfig, modulSeitenLader } from "./module/registry.js";
import { wendeAkzentfarbeAn } from "./theme/akzentfarbe.js";
import appConfig from "~app-config";

// Menüpunkte, die aktive Bausteine selbst anmelden (Abschnitt 8) -- das
// Fundament kennt dabei nie den Namen eines bestimmten Bausteins.
function modulMenuepunkte(user) {
  const punkte = [];
  for (const name of user?.module || []) {
    const config = modulConfig(name);
    for (const mp of config?.menuepunkte || []) {
      punkte.push({ key: `modul-${name}-${mp.key}`, label: mp.label, to: mp.to, icon: IconSettings });
    }
  }
  return punkte;
}

function modulRouten(user) {
  const routen = [];
  for (const name of user?.module || []) {
    const config = modulConfig(name);
    const lader = modulSeitenLader(name);
    if (!lader) continue;
    for (const mp of config?.menuepunkte || []) {
      routen.push({ key: `${name}-${mp.key}`, path: mp.to, lader });
    }
  }
  return routen;
}

function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Akzentfarbe ist per Firma überschreibbar (Anhang A.1) -- einmal pro
  // geladenem Benutzer auf die Design-Variablen anwenden.
  useEffect(() => {
    wendeAkzentfarbeAn(user?.firma?.akzentfarbe);
  }, [user?.firma?.akzentfarbe]);

  async function abmelden() {
    await logout();
    navigate("/login");
  }

  // Menüpunkte blenden nur aus, was der Nutzer laut seinen Rechten nicht
  // sehen darf (Komfort) -- der eigentliche Schutz läuft im Backend (darf()).
  const items = [{ key: "start", label: "Start", to: "/", icon: IconHome }];
  if (user?.rechte?.kontakte?.sehen) {
    items.push({ key: "kontakte", label: "Kontakte", to: "/kontakte", icon: IconUsers });
  }
  items.push(...modulMenuepunkte(user));
  if (user?.rechte?.einstellungen?.sehen) {
    items.push({ key: "einstellungen", label: "Einstellungen", to: "/einstellungen", icon: IconSettings });
  }
  const groups = [{ label: "Allgemein", items }];

  // Superadmin ist eine Plattform-Rolle ohne Firma (Abschnitt 7) -- sichtbar
  // unabhängig von der Rechte-Matrix, die es für ihn gar nicht gibt.
  if (user?.rolle === "Superadmin") {
    groups.push({
      label: "Superadmin",
      items: [{ key: "superadmin-firmen", label: "Firmen", to: "/superadmin/firmen", icon: IconSettings }],
    });
  }

  return (
    <>
      {appConfig.testumgebung && <TestBanner />}
      <div className="app-layout">
        <Sidebar
          brand={appConfig.produktname}
          subtitle="Fundament"
          logo={user?.firma?.logo}
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
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/passwort-aendern"
        element={
          <ProtectedRoute>
            <PasswortAendern />
          </ProtectedRoute>
        }
      />
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
        path="/einstellungen"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Einstellungen />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kontakte"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Kontakte />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kontakte/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <KontaktAkte />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/firmen"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SuperadminFirmen />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {modulRouten(user).map(({ key, path, lader }) => (
        <Route
          key={key}
          path={path}
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModulSeite lader={lader} />
              </AppLayout>
            </ProtectedRoute>
          }
        />
      ))}
    </Routes>
  );
}

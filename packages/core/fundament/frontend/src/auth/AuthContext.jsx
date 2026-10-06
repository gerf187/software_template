import { createContext, useCallback, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

// user: undefined = wird noch geladen, null = nicht angemeldet, sonst Benutzer.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  // Hinweis, wenn die laufende Sitzung wegen Firmen-Sperre beendet wurde.
  const [hinweis, setHinweis] = useState(null);

  const laden = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      setHinweis(null);
      setUser(await res.json());
      return;
    }
    const daten = await res.json().catch(() => ({}));
    setHinweis(daten.gesperrt ? daten.error : null);
    setUser(null);
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);

  async function login(email, passwort) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, passwort }),
    });
    const daten = await res.json();
    if (!res.ok) {
      throw new Error(daten.error || "Anmeldung fehlgeschlagen.");
    }
    setUser(daten);
    return daten;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh: laden, hinweis }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

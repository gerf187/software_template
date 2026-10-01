import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return <Spinner label="Anmeldung wird geprüft …" />;
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  // Startpasswort nach einer Superadmin-Einladung muss zuerst geändert werden
  // (Abschnitt 8, Anhang A.4) -- sonst geht es nirgends anders hin.
  if (user.mussPasswortAendern && location.pathname !== "/passwort-aendern") {
    return <Navigate to="/passwort-aendern" replace />;
  }
  return children;
}

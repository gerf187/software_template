import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (user === undefined) {
    return <Spinner label="Anmeldung wird geprüft …" />;
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

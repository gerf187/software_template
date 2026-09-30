import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { Button, Input, FormField, Message, Card } from "../components/index.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState(null);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e) {
    e.preventDefault();
    setFehler(null);
    setLaedt(true);
    try {
      await login(email, passwort);
      navigate("/");
    } catch (err) {
      setFehler(err.message);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <Card>
          <div className="login-brand">
            <div className="login-brand-name">SaaS-Grundgerüst</div>
          </div>
          <form onSubmit={absenden}>
            {fehler && <Message type="fehler">{fehler}</Message>}
            <FormField label="E-Mail" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Passwort" htmlFor="login-passwort">
              <Input
                id="login-passwort"
                type="password"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                required
              />
            </FormField>
            <Button variant="primary" type="submit" loading={laedt} className="btn-full">
              Anmelden
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

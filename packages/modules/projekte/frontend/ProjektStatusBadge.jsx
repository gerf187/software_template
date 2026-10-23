import Badge from "@fundament/frontend/src/components/Badge.jsx";
import appConfig from "~app-config";

const STATUS = appConfig.projekte?.status || [];
const FARBEN = new Set(["success", "warn", "neutral"]);

// Ein Status-Badge für alle Stellen (Liste, Akten-Kopf, Kontakt-Tab). Die
// Farbe kommt pro Status aus app.config.js (Feld "farbe"), unbekannt = neutral.
export default function ProjektStatusBadge({ status }) {
  const farbe = STATUS.find((s) => s.label === status)?.farbe;
  return <Badge status={FARBEN.has(farbe) ? farbe : "neutral"}>{status}</Badge>;
}

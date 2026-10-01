import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Welche App gerade läuft (Werkstatt, Energieberater, ...) -- bestimmt, aus
// welchem app.config.js Produktname, Menüpunkte usw. kommen. Ohne Angabe:
// Werkstatt, weil dort aktuell alles zuerst getestet wird (Abschnitt 12).
const appName = process.env.VITE_APP || "werkstatt";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~app-config": path.resolve(dirname, `../../../../apps/${appName}/app.config.js`),
    },
  },
  server: {
    host: true, // lauscht auf allen Netzwerk-Adressen, nötig für Codespace-Port-Weiterleitung
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});

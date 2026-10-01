import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Welche App gerade läuft -- gleiche Umgebungsvariable wie im Frontend
// (vite.config.js), Standard: Werkstatt (Abschnitt 12).
const appName = process.env.APP_NAME || "werkstatt";

const appsRoot = path.resolve(dirname, "../../../../../apps");

const configPath = path.join(appsRoot, appName, "app.config.js");
const { default: appConfig } = await import(pathToFileURL(configPath).href);

export default appConfig;
export { appName, appsRoot };

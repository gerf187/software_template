import path from "node:path";
import { pathToFileURL } from "node:url";
import appConfig, { appName, appsRoot } from "../appConfig.js";

// Lädt die Bausteine, die diese App laut app.config.js anbietet (Abschnitt 8,
// erste Ebene der Auswahl). Ob eine Firma einen Baustein tatsächlich bekommt,
// entscheidet firma_module (zweite Ebene, siehe module/firmaModule.js).
export async function ladeModule() {
  const namen = appConfig.module || [];
  const ergebnis = [];

  for (const name of namen) {
    const basis = path.join(appsRoot, appName, "modules", name);
    const { default: config } = await import(
      pathToFileURL(path.join(basis, "modul.config.js")).href
    );

    let router = null;
    try {
      const modul = await import(pathToFileURL(path.join(basis, "backend/routes.js")).href);
      router = modul.default;
    } catch (err) {
      if (err.code !== "ERR_MODULE_NOT_FOUND") throw err;
    }

    ergebnis.push({ name, config, router });
  }

  return ergebnis;
}

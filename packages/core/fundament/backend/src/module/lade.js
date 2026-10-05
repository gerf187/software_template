import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import appConfig, { appName, appsRoot } from "../appConfig.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
// Gemeinsame, branchenneutrale Bausteine (Abschnitt 5): packages/modules/<name>/
const gemeinsamerOrdner = path.resolve(dirname, "../../../../../modules");

async function existiert(datei) {
  try {
    await fs.access(datei);
    return true;
  } catch {
    return false;
  }
}

// Lädt die Bausteine, die diese App laut app.config.js anbietet (Abschnitt 8,
// erste Ebene der Auswahl). Ob eine Firma einen Baustein tatsächlich bekommt,
// entscheidet firma_module (zweite Ebene, siehe module/firmaModule.js).
//
// Suchreihenfolge: zuerst apps/<app>/modules/<name>, dann packages/modules/<name>.
// Denselben Namen an beiden Orten gibt es nicht -- das bricht den Start ab.
// Die Optionen sind nur für Tests gedacht; im Betrieb gelten die Vorgaben.
export async function ladeModule({
  namen = appConfig.module || [],
  app = appName,
  appsOrdner = appsRoot,
  gemeinsamerOrdner: gemeinsamerPfad = gemeinsamerOrdner,
} = {}) {
  const ergebnis = [];

  for (const name of namen) {
    const inApp = path.join(appsOrdner, app, "modules", name);
    const gemeinsam = path.join(gemeinsamerPfad, name);
    const inAppVorhanden = await existiert(path.join(inApp, "modul.config.js"));
    const gemeinsamVorhanden = await existiert(path.join(gemeinsam, "modul.config.js"));

    if (inAppVorhanden && gemeinsamVorhanden) {
      throw new Error(
        `Namenskonflikt: Baustein "${name}" gibt es in apps/${app}/modules und in packages/modules. Bitte einen der beiden umbenennen.`
      );
    }
    if (!inAppVorhanden && !gemeinsamVorhanden) {
      throw new Error(
        `Baustein "${name}" nicht gefunden (weder in apps/${app}/modules noch in packages/modules).`
      );
    }

    const basis = inAppVorhanden ? inApp : gemeinsam;
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

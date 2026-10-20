import { ladeModule } from "./lade.js";

// Einmal pro Prozess geladen (Abschnitt 8). app.js (Routen einhängen) und
// andere Stellen, die wissen müssen, was ein Baustein mitbringt (z. B. die
// globale Suche), nutzen dieselbe geladene Liste statt sie mehrfach einzulesen.
export const geladeneModule = await ladeModule();

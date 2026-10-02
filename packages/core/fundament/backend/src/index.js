import { createApp } from "./app.js";
import { appName } from "./appConfig.js";

const port = process.env.PORT || 3001;
const production = process.env.NODE_ENV === "production";

// Die Werkstatt ist Björns Testumgebung, keine Kunden-App (Abschnitt 12) --
// darf nie im Produktivbetrieb laufen, auch nicht durch ein vergessenes
// APP_NAME. Harter Stopp statt nur die Werkstatt-Routen auszublenden.
if (production && appName === "werkstatt") {
  console.error(
    "Abbruch: Die Werkstatt darf im Produktivbetrieb nicht laufen. APP_NAME auf eine echte Branche setzen (z. B. energieberater)."
  );
  process.exit(1);
}

const app = createApp();

app.listen(port, () => {
  console.log(`Backend läuft auf http://localhost:${port}`);
});

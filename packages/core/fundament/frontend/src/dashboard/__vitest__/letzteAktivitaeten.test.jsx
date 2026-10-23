// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import LetzteAktivitaeten from "../kacheln/LetzteAktivitaeten.jsx";
import { rendern, abraeumen } from "../../__vitest__/rendern.jsx";

afterEach(abraeumen);

function eintrag(id, tabelle, aktion) {
  return { id, tabelle, aktion, zeitpunkt: "2026-10-20T10:00:00Z", benutzerName: null };
}

describe("Kachel „Letzte Aktivitäten“ (Fehler A5)", () => {
  it("zeigt verständliche Bezeichnungen statt interner Tabellennamen", async () => {
    const c = await rendern(
      <LetzteAktivitaeten
        daten={{
          letzteAktivitaeten: [
            eintrag(1, "projects", "geaendert"),
            eintrag(2, "users", "angelegt"),
            eintrag(3, "contacts", "geloescht"),
            eintrag(4, "unbekannte_tabelle", "angelegt"),
          ],
        }}
      />
    );
    const zeilen = [...c.querySelectorAll("p")].map((p) => p.textContent);
    expect(zeilen[0]).toMatch(/^Projekt geändert am /);
    expect(zeilen[1]).toMatch(/^Mitarbeiter angelegt am /);
    expect(zeilen[2]).toMatch(/^Kontakt gelöscht am /);
    expect(zeilen[3]).toMatch(/^Eintrag angelegt am /);
    expect(c.textContent).not.toMatch(/projects|users|unbekannte_tabelle/);
  });
});

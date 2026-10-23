// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import Table from "../Table.jsx";
import EmptyState from "../EmptyState.jsx";
import { rendern, abraeumen } from "../../__vitest__/rendern.jsx";

afterEach(abraeumen);

describe("Table: rechtsbündige Spalten (B5)", () => {
  it("setzt die Klasse für align: \"right\" an Kopf und Zellen, sonst nicht", async () => {
    const c = await rendern(
      <Table
        columns={[
          { key: "name", label: "Name" },
          { key: "anzahl", label: "Anzahl", align: "right" },
        ]}
        rows={[{ id: 1, name: "A", anzahl: 3 }]}
        rowKey={(r) => r.id}
      />
    );
    const [thName, thAnzahl] = c.querySelectorAll("th");
    const [tdName, tdAnzahl] = c.querySelectorAll("td");
    expect(thAnzahl.classList.contains("table-cell-right")).toBe(true);
    expect(tdAnzahl.classList.contains("table-cell-right")).toBe(true);
    expect(thName.classList.contains("table-cell-right")).toBe(false);
    expect(tdName.classList.contains("table-cell-right")).toBe(false);
  });
});

describe("EmptyState mit Aktion (B4)", () => {
  it("zeigt Text und Button", async () => {
    const c = await rendern(<EmptyState action={<button>Kontakt anlegen</button>}>Noch keine Kontakte.</EmptyState>);
    expect(c.querySelector(".empty-state p").textContent).toBe("Noch keine Kontakte.");
    expect(c.querySelector(".empty-state button").textContent).toBe("Kontakt anlegen");
  });
});

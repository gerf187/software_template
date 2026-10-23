import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Table from "../../components/Table.jsx";

function heuteOhneUhrzeit() {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  return heute;
}

function FaelligkeitsBadge({ faelligAm }) {
  const faellig = new Date(faelligAm);
  const text = faellig.toLocaleDateString("de-DE");
  if (faellig < heuteOhneUhrzeit()) return <Badge status="danger">Überfällig · {text}</Badge>;
  return <Badge status="warn">Heute</Badge>;
}

// C2: Spalten Aufgabe · Kontakt · Projekt · Fällig. "Projekt" kommt vom
// Baustein "Projekte" über einen Erweiterungspunkt (siehe
// dashboard/routes.js) -- ohne aktiven Baustein oder ohne Projektbezug der
// Aufgabe bleibt die Spalte leer ("–"). Teil B: die gemeinsame Table-
// Komponente statt eines eigenen CSS-Grids, damit Spaltenkopf und Inhalt nie
// auseinanderlaufen können (auch nicht am Handy, wo eine eigene Spalte sonst
// in die nächste Zeile rutscht) und "Fällig" (ein Datum) rechtsbündig bleibt.
export default function MeineAufgaben({ daten }) {
  const navigate = useNavigate();
  const aufgaben = daten?.meineAufgaben || [];

  if (aufgaben.length === 0) return <EmptyState>Keine fälligen Aufgaben.</EmptyState>;

  return (
    <Table
      columns={[
        { key: "text", label: "Aufgabe", render: (a) => a.text },
        { key: "kontaktName", label: "Kontakt", render: (a) => a.kontaktName },
        {
          key: "projekt",
          label: "Projekt",
          render: (a) =>
            a.projekt ? (
              <a
                href={a.projekt.to}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(a.projekt.to);
                }}
              >
                {a.projekt.name}
              </a>
            ) : (
              "–"
            ),
        },
        {
          key: "faelligAm",
          label: "Fällig",
          align: "right",
          render: (a) => <FaelligkeitsBadge faelligAm={a.faelligAm} />,
        },
      ]}
      rows={aufgaben}
      rowKey={(a) => a.id}
      onRowClick={(a) => navigate(`/kontakte/${a.kontaktId}`)}
    />
  );
}

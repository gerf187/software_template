import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "@fundament/frontend/src/components/PageHeader.jsx";
import Card from "@fundament/frontend/src/components/Card.jsx";
import Table from "@fundament/frontend/src/components/Table.jsx";
import Badge from "@fundament/frontend/src/components/Badge.jsx";
import Input from "@fundament/frontend/src/components/Input.jsx";
import Select from "@fundament/frontend/src/components/Select.jsx";
import Message from "@fundament/frontend/src/components/Message.jsx";
import Spinner from "@fundament/frontend/src/components/Spinner.jsx";
import useDebouncedValue from "@fundament/frontend/src/hooks/useDebouncedValue.js";
import appConfig from "~app-config";
import { listeProjekte } from "./api.js";

const PROJEKTE_CONFIG = appConfig.projekte || { projektarten: [], status: [], phasen: [] };
const NUR_AKTIVE = "__nur_aktive__";

export default function ProjekteSeite() {
  const navigate = useNavigate();
  const [suchParams] = useSearchParams();
  const [suche, setSuche] = useState("");
  const sucheVerzoegert = useDebouncedValue(suche);
  const [status, setStatus] = useState(NUR_AKTIVE);
  const [art, setArt] = useState("");
  const [phase, setPhase] = useState(suchParams.get("phase") || "");
  const [projekte, setProjekte] = useState(undefined);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    listeProjekte({ q: sucheVerzoegert })
      .then(setProjekte)
      .catch((err) => setFehler(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucheVerzoegert]);

  const terminaleStatus = useMemo(
    () => new Set(PROJEKTE_CONFIG.status.filter((s) => s.terminal).map((s) => s.label)),
    []
  );

  const gefiltert = useMemo(() => {
    if (!projekte) return projekte;
    return projekte.filter((p) => {
      if (status === NUR_AKTIVE && terminaleStatus.has(p.status)) return false;
      if (status !== NUR_AKTIVE && status && p.status !== status) return false;
      if (art && !p.arten.includes(art)) return false;
      if (phase && p.phase !== phase) return false;
      return true;
    });
  }, [projekte, status, art, phase, terminaleStatus]);

  return (
    <div>
      <PageHeader title="Projekte" meta={gefiltert ? `${gefiltert.length} Projekte` : undefined} />

      <Card>
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <Input
            placeholder="Suche nach Name, Ort, Straße …"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={NUR_AKTIVE}>Nur aktive</option>
            <option value="">Alle Status</option>
            {PROJEKTE_CONFIG.status.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={art} onChange={(e) => setArt(e.target.value)}>
            <option value="">Alle Projektarten</option>
            {PROJEKTE_CONFIG.projektarten.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">Alle Phasen</option>
            {PROJEKTE_CONFIG.phasen.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {fehler && <Message type="fehler">{fehler}</Message>}
        {!fehler && projekte === undefined && <Spinner label="Projekte werden geladen …" />}
        {!fehler && gefiltert !== undefined && (
          <Table
            columns={[
              { key: "name", label: "Projektname", sortable: true },
              { key: "kontaktName", label: "Kontakt", sortable: true },
              {
                key: "arten",
                label: "Projektart(en)",
                render: (p) => p.arten.map((a) => <Badge key={a}>{a}</Badge>),
              },
              { key: "phase", label: "Phase", sortable: true },
              {
                key: "status",
                label: "Status",
                sortable: true,
                render: (p) => (
                  <Badge status={terminaleStatus.has(p.status) ? "neutral" : "success"}>{p.status}</Badge>
                ),
              },
              {
                key: "auftragsdatum",
                label: "Auftragsdatum",
                sortable: true,
                render: (p) => (p.auftragsdatum ? new Date(p.auftragsdatum).toLocaleDateString("de-DE") : "—"),
              },
            ]}
            rows={gefiltert}
            rowKey={(p) => p.id}
            emptyText="Keine Projekte gefunden."
            onRowClick={(p) => navigate(`/projekte/${p.id}`)}
          />
        )}
      </Card>
    </div>
  );
}

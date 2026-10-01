import { useEffect, useState } from "react";
import PageHeader from "@fundament/frontend/src/components/PageHeader.jsx";
import Card from "@fundament/frontend/src/components/Card.jsx";
import Spinner from "@fundament/frontend/src/components/Spinner.jsx";

export default function BeispielSeite() {
  const [nachricht, setNachricht] = useState(undefined);

  useEffect(() => {
    fetch("/api/module/beispiel")
      .then((res) => res.json())
      .then((daten) => setNachricht(daten.nachricht));
  }, []);

  return (
    <div>
      <PageHeader title="Beispiel" meta="Test-Baustein" />
      <Card title="Hallo Baustein">
        {nachricht === undefined ? <Spinner label="Wird geladen …" /> : <p>{nachricht}</p>}
      </Card>
    </div>
  );
}

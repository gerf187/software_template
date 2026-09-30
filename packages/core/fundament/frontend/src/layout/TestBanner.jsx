import { useEffect, useState } from "react";

export default function TestBanner() {
  const [nutzer, setNutzer] = useState([]);

  useEffect(() => {
    fetch("/api/werkstatt/nutzer")
      .then((res) => (res.ok ? res.json() : []))
      .then(setNutzer)
      .catch(() => setNutzer([]));
  }, []);

  async function wechseln(email) {
    if (!email) return;
    const res = await fetch("/api/werkstatt/anmelden-als", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      window.location.href = "/";
    }
  }

  return (
    <div className="test-banner">
      <span>Testumgebung</span>
      {nutzer.length > 0 && (
        <select
          className="test-banner-select"
          defaultValue=""
          onChange={(e) => wechseln(e.target.value)}
        >
          <option value="" disabled>
            Als Rolle ansehen …
          </option>
          {nutzer.map((n) => (
            <option key={n.email} value={n.email}>
              {n.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

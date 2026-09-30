import { Routes, Route } from "react-router-dom";

function Sidebar() {
  return (
    <aside>
      <p>SaaS-Grundgerüst</p>
    </aside>
  );
}

function Start() {
  return <p>Leere App – Grundstruktur läuft.</p>;
}

export default function App() {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <main>
        <Routes>
          <Route path="/" element={<Start />} />
        </Routes>
      </main>
    </div>
  );
}

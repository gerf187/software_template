import { Routes, Route } from "react-router-dom";
import Sidebar from "./layout/Sidebar.jsx";
import Start from "./pages/Start.jsx";
import MusterPage from "./pages/MusterPage.jsx";
import { IconHome, IconSettings } from "./icons/index.js";

const groups = [
  {
    label: "Allgemein",
    items: [
      { key: "start", label: "Start", to: "/", icon: IconHome },
      { key: "muster", label: "Muster", to: "/muster", icon: IconSettings },
    ],
  },
];

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar brand="SaaS-Grundgerüst" subtitle="Fundament" groups={groups} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/muster" element={<MusterPage />} />
        </Routes>
      </main>
    </div>
  );
}

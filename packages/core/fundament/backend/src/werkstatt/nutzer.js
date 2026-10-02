// Einzige Stelle, die die Werkstatt-Testkonten kennt -- Seed-Skript und
// Rollen-Umschalter-Route nutzen beide diese Liste, damit sie nie auseinanderlaufen.
export const WERKSTATT_PASSWORT = "Werkstatt-Test-2026";

export const WERKSTATT_NUTZER = [
  { email: "admin-a@werkstatt.test", label: "Admin (Firma A)" },
  { email: "user-a@werkstatt.test", label: "User (Firma A)" },
  { email: "admin-b@werkstatt.test", label: "Admin (Firma B)" },
  { email: "superadmin@werkstatt.test", label: "Superadmin" },
];

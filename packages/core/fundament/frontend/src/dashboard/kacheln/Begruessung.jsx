function tageszeit() {
  const stunde = new Date().getHours();
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

export default function Begruessung({ user }) {
  const datum = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <p style={{ margin: 0 }}>
      {tageszeit()}{user?.name ? `, ${user.name}` : ""}.
      <br />
      <span style={{ color: "var(--ink-mute)" }}>{datum}</span>
    </p>
  );
}

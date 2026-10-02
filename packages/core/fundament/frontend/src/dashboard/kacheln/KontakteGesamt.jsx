export default function KontakteGesamt({ daten }) {
  return <p style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>{daten?.kontakteGesamt ?? 0}</p>;
}

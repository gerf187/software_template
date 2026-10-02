export default function NeueKontakte({ daten }) {
  return <p style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>{daten?.neueKontakte ?? 0}</p>;
}

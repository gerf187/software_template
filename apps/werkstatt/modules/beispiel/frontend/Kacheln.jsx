// Kachel-Komponenten dieses Bausteins (Abschnitt 8/10), ein Schlüssel pro
// Eintrag aus modul.config.js -> kacheln. Nur ein winziges Beispiel, zeigt
// aber, dass ein Baustein seine eigene Dashboard-Kachel mitbringen kann.
function BeispielKachel() {
  return <p style={{ margin: 0 }}>Hallo Kachel!</p>;
}

export default {
  beispiel: BeispielKachel,
};

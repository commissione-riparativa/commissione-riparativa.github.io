# Sistema visivo — Giustizia Riparativa

```css
:root {
  --bg: oklch(0.968 0.008 145);
  --surface: oklch(0.995 0.003 145);
  --fg: oklch(0.225 0.022 150);
  --muted: oklch(0.47 0.02 150);
  --border: oklch(0.875 0.014 145);
  --accent: oklch(0.37 0.082 158);
  --font-display: "Iowan Old Style", Charter, Georgia, "Times New Roman", serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
}
```

- Il verde è un segnale di cura e avanzamento, non una decorazione diffusa.
- I titoli editoriali distinguono il progetto scolastico dalle dashboard aziendali generiche.
- Le superfici sono definite soprattutto da bordi sottili e ritmo, con ombre molto contenute.
- Gli stati Nuova, In corso e Conclusa restano semanticamente distinti.
- Navigazione e azioni privilegiano leggibilità, target ampi e feedback espliciti.

Un sistema scolastico autorevole e accogliente, con gerarchia editoriale e interazioni operative sobrie.

## Componenti e comportamento

- Scala tipografica: 12–14 px per metadati, 16 px per testo e campi, 19–22 px per titoli di card, 28–39 px per titoli principali; pesi 600–750 e interlinea minima 1,45 per il testo.
- Spaziatura: scala 4, 8, 12, 16, 20, 24, 32 e 40 px; contenuto massimo 1160 px.
- Raggi: 10 px per controlli, 16 px per card, 24 px per dialoghi e superfici principali.
- Ombre: livelli bassi sulle card e livello alto soltanto per login, modali e toast.
- Icone: SVG monolinea già incluse nel progetto, sempre accompagnate da testo nelle azioni principali.
- Primary: verde bosco pieno; secondary: superficie chiara con bordo; danger: bordo e testo rosso, riempimento tenue su hover.
- Campi e select: altezza minima 50 px, bordo visibile e focus esterno da 4 px.
- Filtri: card selezionabili con numero tabellare, etichetta testuale e sottolineatura cromatica di stato.
- Badge: forma pillola, testo esplicito e colore semanticamente ridondante.
- Navbar: tre destinazioni sempre visibili, indicatore animato e target da almeno 48 px.
- Modali: dialogo centrato su desktop e foglio dal basso su mobile; azioni testuali sempre visibili.
- Toast e stati: successo verde, errore rosso, informazione blu e attesa ambra; messaggio sempre testuale.
- Loading ed empty state: icona, titolo e istruzione; nessuna informazione affidata alla sola animazione.
- Disabled: opacità ridotta e cursore coerente; hover e active non modificano la leggibilità del testo.
- Reduced motion: animazioni e transizioni ridotte a un intervallo impercettibile.

# Giustizia Riparativa — Design System

> Direzione: Neutral Modern caldo e scolastico, ispirato ai principi di OpenDesign ma adattato alla commissione. L'interfaccia deve sembrare una piattaforma civica/educativa curata, non un gestionale aziendale e non una dashboard generica da AI.

## 1. Atmosfera
Calma, collaborativa, affidabile. Contenuto prima della decorazione. Superfici chiare, bordi delicati, gerarchia leggibile e microinterazioni solo quando aiutano a capire cosa è successo.

## 2. Colore
- Background: `#F4F6F3`
- Surface: `#FFFEFC`
- Ink: `#172A23`
- Muted: `#738079`
- Primary: `#1D8F69`
- Nuova: rosso mattone `#B53632` su `#FBECEA`
- In corso: ocra `#8B6200` su `#FFF1BC`
- Conclusa / successo: verde `#17745A` su `#E3F3EC`
- Studenti: blu `#2769A8`
- Adulti: prugna `#72547B`
- Entrambe: verde petrolio `#28756B`

Non affidarsi mai al solo colore: gli stati devono avere anche testo, bordo/accento e forma coerente.

## 3. Tipografia
Font di sistema, nessuna risorsa esterna. Pesi principali 400 / 500 / 600 / 650. Evitare 700+ nei normali controlli. Titoli compatti, testo con line-height generosa. Scala: 12 / 13 / 15 / 17 / 20 / 26 px.

## 4. Spaziatura e griglia
Scala basata su 4/8 px. Container desktop massimo 1080 px. Card con 16–20 px di padding, 12–20 px tra blocchi. Usare spazio bianco prima di aggiungere separatori.

## 5. Forme ed elevazione
Radius 8 / 12 / 16 / 20 px. Ombre molto leggere: le card normali vivono soprattutto di bordo e contrasto di superficie; ombra più evidente solo per modali e hover desktop.

## 6. Componenti
- Navigazione: controllo segmentato con indicatore mobile, non sidebar.
- Card: superficie calda, bordo 1 px, gerarchia interna chiara.
- Pulsanti: altezza 40–44 px, primary verde; distruttivi soft-red, non neri.
- Filtri: card compatte con numero dominante e stato semantico.
- Tabelle: se necessarie, righe ariose e header discreto; sulle segnalazioni preferire card anche su desktop.
- Grafici futuri: evitare arcobaleni; usare primary + semantic colors e label testuali. Nessun grafico viene introdotto finché i dati non lo richiedono.

## 7. Stati
Hover: lieve variazione di superficie/bordo. Active: colore semantico + bordo. Focus: ring verde visibile da tastiera. Loading: spinner e testo. Error/success: toast e superfici semantiche con testo esplicito.

## 8. Responsive
Desktop e tablet condividono lo stesso linguaggio. Mobile usa card, controlli touch >=44 px e pager orizzontale nativo già presente. La navigazione resta sempre disponibile anche se lo swipe è attivo.

## 9. Voce
Italiano semplice, naturale, non burocratico. Evitare inglese non necessario e tono da software amministrativo.

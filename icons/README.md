# Giustizia Riparativa

Frontend della web app della commissione scolastica.

## Struttura

- `index.html` — struttura della pagina
- `style.css` — stile e responsive design
- `app.js` — logica frontend e collegamento al backend Google Apps Script

Questa riorganizzazione non cambia intenzionalmente grafica, backend o funzionamento:
serve solo a rendere il progetto più leggibile e facile da modificare in VS Code.

## Flusso consigliato con VS Code + GitHub Desktop

1. Apri la cartella del repository in VS Code.
2. Modifica i file e salva.
3. Apri GitHub Desktop.
4. Controlla le modifiche nella colonna Changes.
5. Inserisci un messaggio breve, ad esempio `Migliora layout mobile`.
6. Premi `Commit to main`.
7. Premi `Push origin`.
8. Attendi la pubblicazione automatica di GitHub Pages e ricarica il sito.

## Importante

- Non caricare nel repository dati reali delle segnalazioni.
- Non caricare `Code.gs`, esportazioni dei fogli, token o credenziali.
- Il backend rimane Google Apps Script.
- L'URL del backend è già configurato in `app.js`.

## PWA

Il progetto include ora:

- `manifest.webmanifest`
- `sw.js`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/apple-touch-icon.png`
- `icons/icon.svg`

### Installazione

**iPhone / iPad**
1. Apri il sito in Safari.
2. Tocca Condividi.
3. Scegli `Aggiungi alla schermata Home`.

**Android**
1. Apri il sito in Chrome.
2. Usa `Installa app` / `Aggiungi alla schermata Home` quando disponibile.

La PWA memorizza in cache solo i file dell'interfaccia. Le chiamate al backend Google Apps Script non vengono memorizzate dal service worker.


## Bilancia definitiva

La PWA usa ora la bilancia verde con foglie come icona principale.
I file dell'icona sono versionati (`v2`) e la cache del service worker
è stata aggiornata per facilitare la sostituzione dell'icona precedente.


## Revisione Incontri v19

Questa revisione alleggerisce la sezione Incontri senza cambiare il backend:
- più spazio tra le card;
- disponibilità personale e disponibilità del gruppo separate in blocchi distinti;
- segnalazione collegata resa più discreta;
- incontri futuri e conclusi separati in stack distinti.


## V20 — Incontro rapido dalla segnalazione

Per il coordinatore, una segnalazione non conclusa e senza incontri collegati
mostra ora il pulsante `Crea incontro`.

Il pulsante apre il normale modulo `Nuovo incontro` con la segnalazione già
selezionata. Quando viene creato l'incontro, la segnalazione mostra
`Incontro collegato` e il pulsante rapido scompare.

Non sono state aggiunte nuove API al backend.


## V21 — Pulsante incontro più robusto

- `Crea incontro` è visibile al coordinatore anche mentre l'elenco incontri si sta caricando.
- Al clic, il sito verifica nuovamente gli incontri prima di aprire il modulo, evitando duplicati.
- Riconosce anche incontri storici privi di `Segnalazione ID`, confrontando data/componente/contatto.
- `app.js`, `style.css`, manifest e service worker usano versionamento URL per ridurre i problemi di cache PWA.


## V22 — Elimina segnalazione

Solo il coordinatore vede il comando `Elimina`.

- la riga viene eliminata realmente dal foglio `Segnalazioni`;
- il backend blocca l'eliminazione se esiste un incontro attivo collegato;
- l'azione è registrata nel foglio `Registro` senza Nome, Recapito o Descrizione;
- la risposta originale presente su Tally non viene eliminata.


## V23 — Segnalazioni compatte e incontri multipli

- Le card Segnalazioni tornano più compatte, soprattutto su mobile.
- Nessun incontro: `Crea incontro`.
- Uno o più incontri già collegati: indicatore del numero + `Nuovo incontro`.
- È possibile collegare più incontri alla stessa segnalazione.
- Le segnalazioni concluse mostrano solo il numero di incontri collegati e non propongono nuovi incontri.
- Il comando `Elimina` resta disponibile ma visivamente secondario.

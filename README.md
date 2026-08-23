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


## V24 — Segnalazioni più compatte

- desktop: righe più basse e colonna Azioni più ampia;
- `Apri risposta`, stato incontri e pulsanti sono organizzati in massimo due righe compatte;
- nessun incontro: `Crea incontro`;
- incontri già collegati: conteggio + `Nuovo incontro`;
- gli incontri nuovi sono riconosciuti tramite `Segnalazione ID`;
- compatibilità migliorata per incontri storici senza ID, evitando associazioni ambigue;
- numeri dei filtri: rosso = da prendere in carico, giallo = in percorso, verde = concluse;
- cache PWA aggiornata e meta versione UI impostata a 24.


## V25 — Rifinitura mobile

- `Crea incontro` / `Nuovo incontro` ha margine laterale e inferiore dentro la card;
- `Gestione membri` si apre subito e mostra una rotellina durante il caricamento;
- la pagina sotto viene bloccata quando un pannello è aperto;
- su telefono il pannello membri è un bottom sheet trascinabile verso il basso per chiuderlo;
- rimangono anche `Annulla` e il tap sullo sfondo;
- Gestione membri ed Esci sono ora due icone compatte nell'header mobile;
- cache PWA aggiornata alla v26.


## V27 — desktop + microinterazioni
- incontri compatti anche su desktop, con riepilogo e dettagli apribili;
- reset automatico dei dettagli incontro quando si cambia pagina;
- transizione lieve per modali/pannelli;
- azioni delle segnalazioni allineate e più simmetriche su desktop;
- nuove etichette di stato: Nuove / In corso / Concluse;
- barre disponibilità a tre colori: verde, rosso e giallo.


## V28 — polish
- Segnalazioni desktop riportate a un layout più compatto, con azioni centrate;
- su mobile il coordinatore vede solo il cestino nell'angolo della segnalazione;
- per i membri normali Apri risposta è compatto e centrato;
- icona Gestione membri sostituita con icona persone e nascosta rigidamente ai non coordinatori;
- transizioni di modali e dettagli incontro rese più morbide.


## V29 — Bacheca
- nuova sezione Bacheca, leggibile e scrivibile da tutti i membri autenticati;
- autore o coordinatore possono modificare/eliminare un avviso;
- badge discreto per i nuovi avvisi;
- conferma prima di uscire dall’account;
- giorno della settimana e “Mostra dettagli” resi più leggeri ed eleganti negli incontri.


## V30 — rifiniture incontri e Bacheca
- giorno della settimana e “Mostra dettagli” con peso medio coerente con la dashboard;
- l’indicazione degli incontri collegati nelle Segnalazioni è ora cliccabile e porta direttamente all’incontro, aprendone i dettagli;
- il collegamento all’incontro è visibile anche ai membri non coordinatori;
- badge numerico sulla Bacheca per nuovi avvisi non ancora visti;
- controllo silenzioso dei nuovi avvisi ogni 2 minuti e quando l’app torna in primo piano;
- gli avvisi vengono segnati come visti solo quando la Bacheca è effettivamente aperta.


## V31 — Stabilizzazione
- disponibilità aggiornata in tempo reale su tutte e tre le fasce della barra;
- associazione membri basata sugli ID, con fallback ai nomi solo per dati storici;
- incontri e disponibilità caricati in parallelo;
- navigazione con indicatore/pillola scorrevole e lieve transizione di pagina;
- segnalazioni desktop separate in righe più leggibili;
- stato di lettura della Bacheca sincronizzato tra dispositivi (backend v3.5);
- ogni autore può modificare/eliminare il proprio avviso; il coordinatore può gestirli tutti;
- avviso discreto quando è disponibile una nuova versione PWA;
- limite globale agli invii OTP per proteggere la quota email;
- alcuni override CSS obsoleti sono stati rimossi.


## Versione 32 — rifiniture finali

- eliminato il piccolo flash nel passaggio tra Segnalazioni, Incontri e Bacheca;
- mantenuta la pillola animata della navigazione;
- i pulsanti "Ci sono" e "Non posso" restano visibili anche quando un incontro non è espanso;
- colori di "Nuova" e "In corso" resi più distinguibili;
- Segnalazioni desktop ridisegnate come schede orizzontali, coerenti con le card mobile;
- nessuna modifica al backend: resta compatibile con Apps Script v3.5.


## Versione 33 — swipe mobile e colori stati

- su smartphone è possibile passare tra Segnalazioni, Incontri e Bacheca con uno swipe orizzontale;
- lo swipe è un gesto aggiuntivo: i tre pulsanti di navigazione restano sempre disponibili;
- la pillola superiore segue il gesto e completa lo spostamento solo superata una soglia intenzionale;
- lo swipe non parte dai bordi dello schermo, dai pulsanti, dai link o dai campi, per evitare conflitti con i gesti di iPhone e con i controlli dell’app;
- `Nuova` usa ora un rosso/corallo più netto, mentre `In corso` usa un giallo/ocra più separato;
- le schede Segnalazioni hanno un accento di stato più visibile anche su desktop;
- nessuna modifica al backend: resta Apps Script v3.5.


## Versione 34 — correzione swipe

- corretta una sequenza di escape nel CSS della v33 che impediva l'applicazione delle regole aggiunte in quella versione;
- swipe mobile riscritto usando Pointer Events con fallback touch per maggiore affidabilità su iPhone/Android;
- soglia dello swipe leggermente ridotta, mantenendo la protezione dai gesti verticali e dai controlli interattivi;
- mantenuti i colori più distinti per Nuova e In corso.


## v35 — navigazione semplificata
- Rimosso lo swipe tra Segnalazioni, Incontri e Bacheca: sui telefoni risultava troppo facile da attivare in modo involontario e poco naturale con card e controlli interattivi.
- Mantenuta la pillola animata nella navigazione: il passaggio resta fluido tramite tocco/click sui tre pulsanti.
- Rimossi i vincoli touch-action introdotti esclusivamente per lo swipe.
- Mantenuti i colori più distinti degli stati della v34.

## v36 — scorrimento pagine fluido
- Su smartphone Segnalazioni, Incontri e Bacheca sono tre pagine realmente affiancate in un contenitore orizzontale.
- Lo swipe usa lo scorrimento nativo del browser con aggancio alla pagina: durante il gesto si vede la sezione accanto seguire il dito.
- La pillola della navigazione segue in tempo reale la posizione dello scorrimento.
- Toccando una voce della navigazione viene usato lo stesso movimento orizzontale dello swipe.
- Lo scorrimento verticale della pagina resta naturale; i controlli interattivi non vengono usati come aree di swipe.
- L'altezza del contenuto viene adattata alla sezione attiva per evitare grandi spazi vuoti tra pagine di lunghezza diversa.
- Nessuna modifica al backend: resta Apps Script v3.5.


## v37 — scorrimento mobile rifinito

- aggiunto uno spazio di 12 px tra Segnalazioni, Incontri e Bacheca visibile durante lo scorrimento;
- lo scorrimento usa gli offset reali delle pagine, quindi continua a funzionare correttamente anche con lo spazio tra le sezioni;
- rimossa la forzatura `scroll-snap-stop: always`, che poteva far fermare una navigazione Segnalazioni → Bacheca sulla pagina intermedia;
- alleggerito il lavoro eseguito durante lo swipe: altezze delle pagine memorizzate e aggiornamenti grafici raggruppati con `requestAnimationFrame`;
- il completamento dello swipe usa `scrollend` quando disponibile e un fallback più prudente sugli altri browser, evitando correzioni premature durante l'inerzia;
- la sezione più vicina viene preparata durante lo scorrimento, così i controlli risultano pronti appena il gesto termina;
- cache PWA e versione interfaccia aggiornate alla v37.


## v38 — correzione Gestione membri
- correzione della visibilità dei controlli del coordinatore;
- normalizzazione del ruolo ricevuto dal backend;
- doppio controllo sul membro corrente dopo il caricamento dell'elenco membri;
- pulsante Gestione membri e icona mobile riallineati allo stato reale del ruolo;
- cache PWA aggiornata a v38.

# Verifica del frontend

## Modifiche completate — revisione 41

- Accesso a due pannelli: presentazione del progetto e modulo email/codice.
- Navigazione laterale desktop, orizzontale tablet e inferiore smartphone.
- Segnalazioni a schede in due colonne e filtri compatti.
- Copia della revisione precedente in revisioni/.
- Anteprima corrente: accesso-redesign.png; verifica-dashboard.png documenta la versione precedente.

- Mantenuto il foglio stile unico già riscritto; nessun nuovo livello di override.
- Completati titolo delle Segnalazioni, etichette account mobile e disposizione delle azioni su tablet.
- Migliorati focus, leggibilità dei testi lunghi e contrasto delle informazioni secondarie.
- Esclusi dal focus i controlli nei dettagli e nei pannelli disponibilità chiusi.
- Riservato spazio al comando elimina nelle card mobile.
- Allineati documentazione dei colori e versione della cache CSS.

## Verifiche eseguite

- Confronto con il progetto originale: 126 ID conservati, nessun ID duplicato.
- Hash SHA256 di app.js identico all'originale: endpoint, autorizzazioni, autenticazione e chiamate Apps Script non modificati.
- Ispezione del rendering esportato della schermata di accesso.
- Revisione statica delle regole responsive e dei selettori usati dal JavaScript.
- Percorsi relativi per asset e PWA mantenuti.

## Verifiche ancora necessarie

Il rendering esportato mostra il login, non una sessione autenticata. Non sono stati certificati end-to-end OTP, permessi coordinatore, salvataggi, disponibilità, avvisi e gestione membri. Non sono state inviate richieste di modifica ai fogli.

Occorre verificare le schermate interne con dati autorizzati su smartphone, tablet e desktop e controllare il comportamento della PWA dopo la pubblicazione. L'identità del JavaScript dimostra che la logica è preservata, ma non sostituisce una prova completa in browser.

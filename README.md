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

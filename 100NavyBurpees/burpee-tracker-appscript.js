// =====================================================
// Google Apps Script — Burpee Tracker Backend
// =====================================================
// 1. Google Sheet anlegen
// 2. Erste Zeile (Header): Datum | Tag | Typ | Saetze | Gesamt | MaxSet | Pace | Stufe | Notizen
// 3. Erweiterungen → Apps Script
// 4. Diesen Code einfügen
// 5. Deploy → Neue Bereitstellung → Web-App
//    - Ausführen als: Ich
//    - Zugriff: Jeder
// 6. URL kopieren und im Tracker eintragen
// =====================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (data.action === 'add') {
      sheet.appendRow([
        data.datum,
        data.tag,
        data.typ,
        data.saetze,
        parseInt(data.gesamt),
        parseInt(data.maxset),
        data.pace,
        data.stufe || '',
        data.notizen || ''
      ]);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', rows: sheet.getLastRow() - 1 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'delete') {
      // Zeile anhand von Datum + Tag + Gesamt finden und löschen.
      // Wichtig: getValues() liefert Datums-Zellen als Date-Objekt, der Client sendet
      // einen ISO-String. Daher beide Seiten auf "yyyy-MM-dd" normalisieren, sonst
      // schlaegt der strikte Vergleich fehl und es wird nie geloescht.
      const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        const cell = rows[i][0];
        const cellDatum = (cell instanceof Date)
          ? Utilities.formatDate(cell, tz, 'yyyy-MM-dd')
          : String(cell).trim();
        if (cellDatum === data.datum && rows[i][1] == data.tag && rows[i][4] == data.gesamt) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', action: 'deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', msg: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', msg: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput('Burpee Tracker Backend aktiv.')
    .setMimeType(ContentService.MimeType.TEXT);
}

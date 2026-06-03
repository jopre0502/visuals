// =====================================================
// Google Apps Script — Burpee Tracker Backend v4
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

    // Auth: Shared-Secret-Token gegen ScriptProperties pruefen.
    // Setup: Projekteinstellungen -> Skripteigenschaften -> API_TOKEN anlegen.
    // Fail-closed: ohne gueltiges Token wird nichts ausgefuehrt. Konstante Fehlerantwort,
    // damit nicht durchsickert, ob Token fehlte oder falsch war.
    const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!expected || !safeEqual(data.token, expected)) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (data.action === 'add') {
      // Formula-Injection-Schutz: Strings mit fuehrendem =,+,-,@,Tab,CR mit ' als Text markieren,
      // damit Google Sheets sie nicht als Formel auswertet. Zahlen strikt ueber parseInt.
      const safe = s => (typeof s === 'string' && /^[=+\-@\t\r]/.test(s)) ? "'" + s : s;
      sheet.appendRow([
        safe(data.datum),
        safe(data.tag),
        safe(data.typ),
        safe(data.saetze),
        parseInt(data.gesamt) || 0,
        parseInt(data.maxset) || 0,
        safe(data.pace),
        safe(data.stufe || ''),
        safe(data.notizen || '')
      ]);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', rows: sheet.getLastRow() - 1 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'delete') {
      // Zeile anhand von Datum + Tag + Gesamt finden und löschen.
      // Datum, Tag und Gesamt werden BEIDSEITIG identisch normalisiert (normDate /
      // String-trim), damit Typ-/Formatunterschiede (Date-Objekt vs. ISO-String,
      // Number vs. String) den Vergleich nicht stillschweigend scheitern lassen.
      const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      const rows = sheet.getDataRange().getValues();
      const wantDatum = normDate(data.datum, tz);
      let deleted = false;
      for (let i = rows.length - 1; i >= 1; i--) {
        if (normDate(rows[i][0], tz) === wantDatum
            && String(rows[i][1]).trim() == String(data.tag).trim()
            && String(rows[i][4]).trim() == String(data.gesamt).trim()) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      // 'not_found' statt blindem 'deleted': ehrliche Server-Antwort. Sichtbar wird
      // sie zwar nicht (no-cors), aber der GET-Dryrun unten macht den Match pruefbar.
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', action: deleted ? 'deleted' : 'not_found' }))
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
  const p = (e && e.parameter) ? e.parameter : {};

  // --- Diagnose (im Browser direkt lesbar, da kein fetch/no-cors) ---
  // Beide Endpoints sind read-only und greifen NUR auf Daten zu, die ohnehin schon
  // public sind (das Sheet wird per CSV-Export oeffentlich gelesen). Kein neues Leck.
  // Nach erfolgreicher Diagnose koennen die beiden if-Bloecke wieder entfernt werden.
  if (p.action === 'debug' || p.action === 'dryrun') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const tz = ss.getSpreadsheetTimeZone();
    const rows = sheet.getDataRange().getValues();

    // dryrun: simuliert die Loesch-Suche OHNE zu loeschen und zeigt pro Bedingung,
    // was passt. Aufruf: <exec-URL>?action=dryrun&datum=2026-05-27&tag=1&gesamt=44
    if (p.action === 'dryrun') {
      const wantDatum = normDate(p.datum, tz);
      const treffer = [];
      for (let i = 1; i < rows.length; i++) {
        const dOk = normDate(rows[i][0], tz) === wantDatum;
        const tOk = String(rows[i][1]).trim() == String(p.tag).trim();
        const gOk = String(rows[i][4]).trim() == String(p.gesamt).trim();
        if (dOk || (tOk && gOk)) {  // auch Beinahe-Treffer zeigen, um Mismatch zu sehen
          treffer.push({
            zeile: i + 1, datum: normDate(rows[i][0], tz), tag: rows[i][1], gesamt: rows[i][4],
            datumOk: dOk, tagOk: tOk, gesamtOk: gOk, wuerdeLoeschen: dOk && tOk && gOk
          });
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ version: 'v3', gesucht: { datum: wantDatum, tag: p.tag, gesamt: p.gesamt }, treffer: treffer }, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // debug: letzte bis zu 5 Datenzeilen roh — zeigt, WIE Datum/Tag/Gesamt gespeichert sind.
    const letzte = [];
    for (let i = Math.max(1, rows.length - 5); i < rows.length; i++) {
      letzte.push({
        zeile: i + 1,
        datum_norm: normDate(rows[i][0], tz),
        datum_istDate: rows[i][0] instanceof Date,
        tag: rows[i][1], tag_typ: typeof rows[i][1],
        gesamt: rows[i][4], gesamt_typ: typeof rows[i][4]
      });
    }
    return ContentService
      .createTextOutput(JSON.stringify({ version: 'v3', timezone: tz, datenzeilen: rows.length - 1, letzte: letzte }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput('Burpee Tracker Backend aktiv.')
    .setMimeType(ContentService.MimeType.TEXT);
}

// Normalisiert Datumszelle ODER Eingabe-String einheitlich auf "yyyy-MM-dd".
// Drei Faelle, beidseitig identisch behandelt, sonst scheitert der Match still:
//   1. echtes Date-Objekt (date-formatierte Zelle) -> formatieren
//   2. sauberes ISO "yyyy-MM-dd" (aktueller Client/Add) -> direkt, kein Parse-Risiko
//   3. Altlast: voller JS Date.toString() als TEXT (istDate=false), z.B.
//      "Wed Jun 03 2026 00:00:00 GMT+0200 (...)" -> parsen und vereinheitlichen.
//      Der eingebettete GMT-Offset macht new Date() hier eindeutig (keine UTC-Annahme),
//      daher kein Off-by-one beim Zurueckformatieren in die Sheet-Zeitzone.
function normDate(value, tz) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  const s = String(value == null ? '' : value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  return s;  // nicht parsebar -> roh vergleichen (Fallback)
}

// Laengen-sicherer, inhaltlich konstanter String-Vergleich (mindert Timing-Angriffe).
function safeEqual(a, b) {
  a = String(a == null ? '' : a);
  b = String(b == null ? '' : b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// =====================================================
// Google Apps Script — Burpee Tracker Backend v5
// =====================================================
// Schema (nur Rohdaten):
//   Datum | Typ | Saetze | Pace | Pausen | Stufe | Notizen
// Abgeleitete Werte (Gesamt, MaxSet, Session-Nr, Pace-Bewertung) werden NICHT
// gespeichert, sondern im Frontend berechnet. Single Source of Truth = Saetze.
//
// Setup:
//   1. Google Sheet anlegen
//   2. Einmalig setupSheet() im Editor ausfuehren (Run) -> Header + Seed-Import
//   3. Deploy -> Neue Bereitstellung -> Web-App (Ausfuehren als: Ich, Zugriff: Jeder)
//   4. Skripteigenschaft API_TOKEN setzen, /exec-URL + Token im Tracker eintragen
// =====================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Auth: Shared-Secret-Token, fail-closed, konstante Fehlerantwort.
    const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!expected || !safeEqual(data.token, expected)) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (data.action === 'add') {
      // Formula-Injection-Schutz: fuehrende =,+,-,@,Tab,CR mit ' als Text markieren.
      // Nur Rohdaten — Gesamt/MaxSet werden nicht mehr geschrieben.
      const safe = s => (typeof s === 'string' && /^[=+\-@\t\r]/.test(s)) ? "'" + s : s;
      sheet.appendRow([
        safe(data.datum),
        safe(data.typ),
        safe(data.saetze),
        safe(data.pace || ''),
        safe(data.pausen || ''),
        safe(data.stufe || ''),
        safe(data.notizen || '')
      ]);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', rows: sheet.getLastRow() - 1 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'delete') {
      // Match auf Datum + Typ + abgeleitetes Gesamt (Summe der Saetze, Spalte C).
      // Es gibt keine Gesamt-Spalte mehr; rowTotal() bildet die Summe. Datum beidseitig
      // ueber normDate normalisiert (Date-Objekt / ISO / Altlast-toString).
      const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      const rows = sheet.getDataRange().getValues();
      const wantDatum = normDate(data.datum, tz);
      const wantTyp = String(data.typ == null ? '' : data.typ).trim();
      let deleted = false;
      for (let i = rows.length - 1; i >= 1; i--) {
        if (normDate(rows[i][0], tz) === wantDatum
            && String(rows[i][1]).trim() === wantTyp
            && rowTotal(rows[i]) == String(data.gesamt).trim()) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
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

  // --- Diagnose (im Browser direkt lesbar). Read-only, nur ohnehin public Sheet-Daten. ---
  if (p.action === 'debug' || p.action === 'dryrun') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const tz = ss.getSpreadsheetTimeZone();
    const rows = sheet.getDataRange().getValues();

    if (p.action === 'dryrun') {
      // Simuliert die Loesch-Suche OHNE zu loeschen. Aufruf:
      //   <exec>?action=dryrun&datum=2026-05-22&typ=Max%20Set&gesamt=46
      const wantDatum = normDate(p.datum, tz);
      const wantTyp = p.typ != null ? String(p.typ).trim() : null;
      const treffer = [];
      for (let i = 1; i < rows.length; i++) {
        const dOk = normDate(rows[i][0], tz) === wantDatum;
        const tyOk = wantTyp == null ? true : String(rows[i][1]).trim() === wantTyp;
        const gOk = rowTotal(rows[i]) == String(p.gesamt).trim();
        if (dOk || gOk) {  // auch Beinahe-Treffer zeigen
          treffer.push({
            zeile: i + 1, datum: normDate(rows[i][0], tz), typ: rows[i][1],
            gesamt: rowTotal(rows[i]), saetze: rows[i][2],
            datumOk: dOk, typOk: tyOk, gesamtOk: gOk, wuerdeLoeschen: dOk && tyOk && gOk
          });
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ version: 'v5', gesucht: { datum: wantDatum, typ: p.typ, gesamt: p.gesamt }, treffer: treffer }, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // debug: letzte bis zu 8 Datenzeilen roh.
    const letzte = [];
    for (let i = Math.max(1, rows.length - 8); i < rows.length; i++) {
      letzte.push({
        zeile: i + 1,
        datum: normDate(rows[i][0], tz),
        typ: rows[i][1],
        saetze: rows[i][2],
        gesamt_abgeleitet: rowTotal(rows[i]),
        pace: rows[i][3], pausen: rows[i][4], stufe: rows[i][5]
      });
    }
    return ContentService
      .createTextOutput(JSON.stringify({ version: 'v5', timezone: tz, datenzeilen: rows.length - 1, letzte: letzte }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput('Burpee Tracker Backend aktiv.')
    .setMimeType(ContentService.MimeType.TEXT);
}

// EINMALIG im Editor ausfuehren (Run): leert das aktive Sheet, setzt den neuen Header
// und importiert die echten Sessions. ACHTUNG: ueberschreibt das Sheet komplett.
function setupSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clear();
  const rows = [
    ['Datum', 'Typ', 'Saetze', 'Pace', 'Pausen', 'Stufe', 'Notizen'],
    ['2026-05-22', 'Max Set', '20;12;8;6', '5', '', '', 'Pausen nicht notiert'],
    ['2026-05-24', 'Intervalle', '10;10;10;10;10', '5', '120;120;120;120', 'Start', 'kein Problem, gut durchgehalten'],
    ['2026-05-27', 'Speed Endurance', '5;5;5;5;5;5', '6', '120;120;120;120;120', 'Start', 'kein Problem, gut durchgehalten'],
    ['2026-05-29', 'Max Set', '22;11;10;8;6', '5', '150;90;90;90', '', 'längere Pausen bei Sätzen 2-5, 150s statt 90s; 60% = 13 reps/Satz nicht haltbar. Tagsüber Rauschen im Ohr'],
    ['2026-05-31', 'Intervalle', '11;11;7', '5', '120;120;120;120', 'Start', 'Nicht gut gefühlt. Brust. im dritten Satz abgebrochen. Wieder Rauschen im Ohr'],
    ['2026-06-03', 'Speed Endurance', '5;5;5;5;5;5;5;5', '6', '120;120;120;120;120;120;120', 'Stufe 1', 'kein Problem, gut durchgehalten auch auf Stufe 1. Kein Rauschen']
  ];
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}

// Normalisiert Datumszelle ODER Eingabe-String einheitlich auf "yyyy-MM-dd".
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

// Abgeleitetes Gesamt einer Zeile als String: Summe der (komma-/semikolon-getrennten)
// Saetze in Spalte C (Index 2). Gesamt wird bewusst nicht mehr gespeichert.
function rowTotal(row) {
  const sets = String(row[2] == null ? '' : row[2]).split(/[,;]/)
    .map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n));
  return sets.length ? String(sets.reduce((a, b) => a + b, 0)) : '';
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

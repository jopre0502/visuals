# CLAUDE.md — 100 Navy Burpees

## Projekt

HIIT-Timer und Trainings-Tracker für das Ziel "100 Navy SEAL Burpees am Stück @ 5 BPM".
Gehostet als statische HTML-Seite auf GitHub Pages, Backend via Google Sheets.

**Repo:** `github.com/jopre0502/visuals` (Monorepo — dieses Projekt liegt im Unterordner `100NavyBurpees/`)
**Live:** `https://jopre0502.github.io/visuals/100NavyBurpees/`

## Architektur

```
100NavyBurpees/
├── index.html                    # Kompletter Monolith (HTML + CSS + JS)
├── burpee-tracker-appscript.js   # Google Apps Script für Sheet-Backend (Copy-Paste in GAS Editor)
└── CLAUDE.md                     # Diese Datei
```

**Bewusste Entscheidung: Monolith.** Kein Build-System, kein Framework, kein Bundler. Eine einzige HTML-Datei mit inlined CSS und JS. Deployment = File kopieren. Das soll so bleiben.

## Stack

- Vanilla HTML/CSS/JS, keine Dependencies
- Google Fonts: Bebas Neue, IBM Plex Mono, IBM Plex Sans
- Google Sheets als Datenbank (Lesen via CSV-Export, Schreiben via Apps Script Web-App)
- Config (Sheet-ID, Script-URL) in localStorage
- Audio: Web Audio API (Square-Wave Beeps für Pace, Runden, Pause, Fertig)

## Design-System

| Token | Wert | Verwendung |
|---|---|---|
| `--accent` | `#c4ff00` | Tag 1 (Max Set), Primärfarbe, Buttons |
| `--blue` | `#5ac8fa` | Tag 2 (Intervalle) |
| `--orange` | `#ff6b00` | Tag 3 (Überpace) |
| `--red` | `#ff3b30` | Warnungen, Countdown <3s |
| `--warn` | `#ffb800` | Deload, Pace teilweise |
| `--green` | `#34c759` | Pace gehalten, verbunden |
| `--bg` | `#0a0a0a` | Hintergrund |
| `--bg-card` | `#111` | Karten |

Font-Hierarchie: Bebas Neue (Headlines, Zahlen), IBM Plex Mono (Labels, Daten), IBM Plex Sans (Body).

## Trainingskonzept (Domänenwissen)

### Drei Trainingstage pro Woche

**Tag 1 — Max Set @ Zielpace (5 BPM / 12s pro Rep)**
- Satz 1 All-out bei exakt 5 BPM, dann 4 Folgesätze bei 60-70%
- Abbruch bei technischem Versagen ODER Pace-Abfall unter 5 BPM
- Timer: Open-ended (zählt hoch), User beendet Satz manuell via "Satz Ende" (Taste E)
- Ring-Countdown: 12 Sekunden

**Tag 2 — Intervalle @ Zielpace (5 BPM / 12s pro Rep)**
- Arbeitsblöcke bei exakt 5 BPM mit definierten Pausen
- Timer: Automatisch (zählt Reps bis Target, dann Pause, dann nächste Runde)
- Ring-Countdown: 12 Sekunden
- 6 Progressionsstufen (STAGES Array)

**Tag 3 — Speed Endurance / Überpace (6-7 BPM / 8-10s pro Rep)**
- Kurze Sätze bei supramaximaler Pace
- Timer: Automatisch (wie Tag 2, aber mit kürzerer Rep-Zeit)
- Ring-Countdown: 8-10 Sekunden (dynamisch je nach Stufe)
- 5 Progressionsstufen (STAGES_OP Array)
- Wissenschaftliche Basis: Bangsbo Speed Endurance Training (SET)

### Datenmodell

```javascript
// Session-Objekt (im Frontend nach parseCsv; total/maxSet/pace ABGELEITET, NICHT gespeichert)
{
  date: "2026-05-27",        // ISO-Datum (roh)
  typ: "Max Set"|"Intervalle"|"Speed Endurance", // roh — die Kategorie
  day: 1|2|3,                // ABGELEITET aus typ (typToDay) — interner Schlüssel
  sets: [15, 10, 10, 9],     // roh (Semikolon-getrennt im Sheet)
  total: 44,                 // ABGELEITET = sum(sets)
  maxSet: 15,                // ABGELEITET = max(sets)
  paceBpm: 5,                // roh — erreichte BPM (oder null)
  pace: "hit"|"miss"|"fail"|null, // ABGELEITET aus paceBpm vs. Zielpace des Typs
  pausen: "120;120;120",     // roh — Pausenzeiten (oder "")
  stage: null|0-10,          // ABGELEITET aus Stufe-Label (typ-bewusst: 0-5 STAGES, 6-10 STAGES_OP)
  notes: "Freitext"          // roh
}
```

### Google Sheet Spalten (v5 — nur Rohdaten)

```
Datum | Typ | Saetze | Pace | Pausen | Stufe | Notizen
```

**Prinzip: nur Rohdaten speichern.** Gesamt, MaxSet, Session-Nr und Pace-Bewertung werden
NICHT gespeichert, sondern im Frontend abgeleitet (Single Source of Truth = Saetze). Das
beendet die Divergenz-Bugklasse (gespeicherter Wert ≠ Saetze). `Pace` = erreichte BPM (Zahl).
Saetze & Pausen Semikolon-getrennt ("15;10;10;9"). Frisch-Setup/Import via `setupSheet()` im
Apps Script (leert das Sheet, schreibt Header + Seed-Daten). Das numerische `Tag` entfällt —
`Typ`-Text ist die Kategorie, `day` (1/2/3) wird intern via `typToDay` gemappt.

## Google Sheets Backend — Setup & Troubleshooting

### Web-App-Deployment (kritisch)

Das Apps Script muss als Web-App so bereitgestellt sein, dass die statische Seite **anonym** schreiben darf:

- **Ausführen als:** Ich (Sheet-Owner) — Script schreibt mit Owner-Rechten, kein Nutzer-Login nötig
- **Zugriff:** Jeder — NICHT "Jeder mit Google-Konto" (das erzwingt eine Login-Seite)
- **API-Token:** Skripteigenschaft `API_TOKEN` setzen (Projekteinstellungen → Skripteigenschaften) UND denselben Wert im Tracker unter Setup → API Token eintragen — sonst wird fail-closed nichts geschrieben
- Im Tracker die **`/exec`**-URL eintragen, NIE die `/dev`-URL (letztere verlangt immer Login)
- Nach Code-Änderungen: neu bereitstellen, sonst läuft die alte Version weiter

### Bekannter Fallstrick: stiller Schreibfehler

`postToSheet` nutzt `mode:'no-cors'`, weil Apps-Script-Antworten keine CORS-Header tragen. Die POST-Antwort ist dadurch unsichtbar — ein falsch konfiguriertes Deployment schlägt **still** fehl, der Client meldet trotzdem Erfolg. Absicherung: `verifyInSheet()` liest nach jedem Schreiben das Sheet zurück (Single Source of Truth) und bestätigt nur real angekommene Einträge. Server-`delete` matcht auf `Datum + Typ + abgeleitetes Gesamt` (`rowTotal` = Summe der Saetze; es gibt keine Gesamt-Spalte mehr), Client-Read-back auf `Datum + day + total`. Datum wird beidseitig über `normDate` normalisiert (Date-Objekt / ISO / Altlast-`toString` werden alle auf `yyyy-MM-dd` gebracht) — sonst scheitert der Vergleich still.

### Sicherheit (Security-Review 2026-06-03)

- **Auth:** Shared-Secret-Token (`API_TOKEN`), serverseitig fail-closed via `safeEqual()`. Token liegt client-seitig in localStorage — Härtung gegen URL-Leaks/Bots, kein Schutz gegen Traffic-Inspection (public static page). Echter Schutz nur via Login + OAuth.
- **Formula Injection:** `add` markiert Strings mit führendem `=,+,-,@` per `'` als Text.
- **XSS:** Freitext (`notizen`) wird in `renderLog()` via `escapeHtml()` ausgegeben.

### Diagnose-Tests

- `/exec`-URL im **Inkognito-Fenster** öffnen → muss `Burpee Tracker Backend aktiv.` zeigen (nicht Login). Simuliert den anonymen Zugriff der statischen Seite.
- Roh-CSV prüfen: `docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv` (zeigt, wie Datum/Spalten ankommen)
- **GET-Diagnose im Browser lesbar** (umgeht no-cors-Blindheit, read-only, nur ohnehin public Daten):
  - `<EXEC-URL>?action=debug` → zeigt `version` (Deploy-Check) + letzte Zeilen roh (wie Datum/Saetze gespeichert sind)
  - `<EXEC-URL>?action=dryrun&datum=2026-05-22&typ=Max%20Set&gesamt=46` → simuliert die Lösch-Suche OHNE zu löschen; zeigt pro Zeile, welche Bedingung (`datumOk`/`typOk`/`gesamtOk`) scheitert
- **Fallstrick „saved ≠ deployed":** Apps Script läuft nach Speichern weiter mit der alten Deployment-Version. Immer **Bereitstellen → Verwalten → Bearbeiten → Neue Version**. Der `?action=debug`-`version`-String bestätigt, ob der neue Code live ist.

## Timer-Engine

### Zustände

`idle` → `work` → `rest` → `work` → ... → `done`
`paused` kann von `work` oder `rest` aus erreicht werden.

### Ring-Countdown

SVG-Kreis (r=100, Circumference=628.318), `stroke-dashoffset` steuert die Füllung.
Zählt `curRepSec` runter (12s für Tag 1/2, 8-10s für Tag 3).
Wird rot + pulsiert bei ≤3 Sekunden.

### Pace-Beep

Alle `curRepSec` Sekunden ein kurzer Beep (880Hz, 80ms).
Markiert den Moment, an dem die nächste Rep beginnen sollte.

## Adaptive Logik

Im Plan-View werden automatisch Empfehlungen generiert:

- **Max Set stagniert** (3 Sessions ohne Steigerung) → Deload empfehlen
- **Pace 2/3x nicht gehalten** (Tag 2) → Stufenrückfall empfehlen
- **Pace teilweise** (2/3 Sessions) → Stufe wiederholen
- **Wochenvolumen sinkt** (2+ Wochen <80% des Vorwerts) → Overreaching-Warnung

## Konventionen

- Sprache: Deutsch (UI, Labels, Toasts). Code-Kommentare auf Englisch sind OK.
- CSS: Custom Properties, keine Frameworks. Mobile-first (max-width: 400px Breakpoint).
- JS: Vanilla, keine Module, alles in einem Script-Block. Funktionen statt Klassen.
- Keine externen API-Calls ausser Google Sheets CSV und Apps Script POST.
- Monolith-Prinzip: Alles in einer Datei. KISS.
- Kein localStorage für Session-Daten. Nur für Config (Sheet-ID, Script-URL).

## Offene Punkte / Roadmap

- [x] Google Sheet anlegen und verbinden (erledigt 2026-06-03)
- [x] Auf GitHub Pages deployen und testen (erledigt 2026-06-03)
- [x] Token-Auth aktiv + Eintragen funktioniert (erledigt 2026-06-04)
- [x] Löschen gefixt — `normDate` (Datum: Date/ISO/Altlast-`toString` → `yyyy-MM-dd`) + Match auf `Datum + Typ + abgeleitetes Gesamt`; Altzeilen mit leerem Gesamt / Komma-Saetzen lösbar (erledigt 2026-06-04, `83a8d60`)
- [x] Schema-Redesign v5: nur Rohdaten (`Datum | Typ | Saetze | Pace | Pausen | Stufe | Notizen`), Gesamt/MaxSet/Pace-Bewertung im Frontend abgeleitet; Code committed + gepusht (`83a8d60`)
- [ ] **Ausstehend (nur Deploy, User-Seite):** Apps Script **v5** in GAS einfügen → `setupSheet()` einmal ausführen (leert Sheet, importiert 6 echte Sessions) → **Neue Version** bereitstellen → `?action=debug` muss `version: v5` zeigen
- [ ] Session 6 (2026-06-03, Speed Endurance) Pace-BPM nachtragen (aktuell leer → „Pace n/a")
- [ ] Falls Mojibake in Notizen erneut auftaucht: `TextDecoder('utf-8')` in `fetchSessions` (reiner Anzeige-Fix; Alt-Bytes waren bereits korrupt gespeichert, `setupSheet` schreibt sauber)
- [ ] PWA-Manifest + Service Worker für Offline-Fähigkeit (Timer muss ohne Netz funktionieren)
- [ ] Vibration API als Alternative/Ergänzung zu Audio-Beeps (Handy in der Tasche beim Training)
- [ ] Max-Attempt-Modus: Spezieller Timer für Testläufe (alle 3-4 Wochen nach Deload)
- [ ] Wochenvolumen-Ziel und Deload-Wochen-Erkennung automatisieren
- [ ] Dark/Light Toggle (aktuell nur Dark)

## Begleitende Artefakte

- `100-navy-burpees-trainingsplan.md` — Vollständiges Trainingskonzept als Markdown
- `100-navy-burpees-trainingsplan.html` — Gleicher Inhalt als designtes HTML-Monolith
- `burpee-tracker-data.json` — Datenstruktur-Template mit allen Stufen

## Wissenschaftliche Quellen

- Bangsbo, J., Kissow, J., Hostrup, M. (2025). Speed Endurance Training to Improve Performance. *Scand J Med Sci Sports.*
- Skovgaard, C. et al. (2018). Effect of SET on running economy and single muscle fiber adaptations. *Physiological Reports*, 6(3).
- Bangsbo, J. et al. (2009). Reduced volume and increased training intensity. *J Appl Physiol*, 107(6).
- Issurin, V. (2008). Block periodization vs traditional training theory. *J Sports Med Phys Fitness*, 48(1).
- Verkhoshansky, Y. *Special Strength Training Manual for Coaches.*
- Magill, R. & Anderson, D. *Motor Learning and Control* (11th ed.).

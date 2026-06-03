# CLAUDE.md — 100 Navy Burpees

## Projekt

HIIT-Timer und Trainings-Tracker für das Ziel "100 Navy SEAL Burpees am Stück @ 5 BPM".
Gehostet als statische HTML-Seite auf GitHub Pages, Backend via Google Sheets.

**Repo:** `github.com/jopre0502/visuals` (Monorepo — dieses Projekt liegt im Unterordner `100NavyBurpees/`)
**Live:** `https://jopre0502.github.io/visuals/100NavyBurpees/`

## Architektur

```
100NavyBurpees/
├── index.html          # Kompletter Monolith (HTML + CSS + JS)
├── appscript.js        # Google Apps Script für Sheet-Backend (Copy-Paste in GAS Editor)
└── CLAUDE.md           # Diese Datei
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
// Session-Objekt
{
  date: "2026-05-27",       // ISO-Datum
  day: 1|2|3,               // Tag-Typ
  sets: [15, 10, 10, 9],    // Reps pro Satz
  total: 44,                // Summe
  maxSet: 15,               // Höchster Einzelsatz
  pace: "hit"|"miss"|"fail", // Pace-Bewertung
  stage: null|0-10,         // Index in ALL_STAGES (0-5 = STAGES, 6-10 = STAGES_OP)
  notes: "Freitext"
}
```

### Google Sheet Spalten

```
Datum | Tag | Typ | Saetze | Gesamt | MaxSet | Pace | Stufe | Notizen
```

Saetze werden mit Semikolon getrennt gespeichert ("15;10;10;9").

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

- [ ] Google Sheet tatsächlich anlegen und verbinden
- [ ] Auf GitHub Pages deployen und testen
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

# CLAUDE.md — visuals (Monorepo)

## Was ist das

**Monorepo** für publizierte, eigenständige HTML-Artifacts von Jonas Prechtel.
Jeder Top-Level-Unterordner ist ein **unabhängiges Static-Web-Projekt** (Monolith-Prinzip:
HTML/CSS/JS in einer Datei, kein Build-System). Trennung erfolgt über **Verzeichnisse**,
nicht über Branches.

**Repo:** `github.com/jopre0502/visuals` (public)
**Live:** `https://jopre0502.github.io/visuals/<ordnername>/` (GitHub Pages, `.nojekyll`)

## Struktur

| Ordner | Projekt | Live |
|---|---|---|
| `100NavyBurpees/` | HIIT-Timer & Trainings-Tracker | `…/visuals/100NavyBurpees/` |
| `roadtrip/` | Roadtrip Benelux (PWA, Cabrio-Tour) | `…/visuals/roadtrip/` |

Neue Projekte = neuer Top-Level-Ordner mit eigenem `index.html`. Danach `README.md`
(Root) um einen Artifact-Link ergänzen.

## Git-Disziplin (kritisch im Monorepo)

Die Git-Wurzel ist **`visuals/`**, nicht der Unterordner. Ein Commit ist immer ein
Snapshot des **gesamten Repos**, ein Push betrifft alle Projekte — egal aus welchem
Unter-Verzeichnis ausgelöst.

**Regel: Beim Arbeiten in einem Projekt immer mit explizitem Pfad stagen.**

```bash
# RICHTIG — staged nur das aktuelle Projekt
git add 100NavyBurpees/
git commit -m "..."

# FALSCH — zieht ungewollt offene Änderungen aus Geschwister-Ordnern (z.B. roadtrip/) mit
git add -A
git commit -am "..."
```

Staging-Verhalten je nach Befehl (aus einem Unterordner ausgeführt):

| Befehl | Was wird erfasst |
|---|---|
| `git add <ordner>/` | **nur** dieser Ordner (empfohlen) |
| `git add .` | nur cwd abwärts (aktueller Ordner) |
| `git add -A` / `--all` | **gesamtes Repo** — auch Geschwister-Projekte |
| `git commit -a` | alle getrackten Änderungen **im ganzen Repo** |
| `git status` | zeigt immer **das ganze Repo** (Pfade relativ zum cwd) |

**Vor jedem Commit `git status` lesen** — er zeigt projektübergreifend, was wirklich mitläuft.

## CLAUDE.md-Kaskade

Claude Code lädt CLAUDE.md hierarchisch: diese Root-Datei **plus** die projektspezifische
des Unterordners, in dem gearbeitet wird (z.B. `100NavyBurpees/CLAUDE.md`). Die Schichten
**addieren** sich — diese Datei enthält nur Monorepo-Übergreifendes, Projekt-Details
stehen in der jeweiligen Projekt-CLAUDE.md.

CLAUDE.md sind bewusst **getrackt** (geteiltes Projektwissen). Persönliches/Sensibles
gehört in `CLAUDE.local.md` (derzeit kein Pattern aktiv — Inhalte sind unkritisch).

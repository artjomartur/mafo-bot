# MaFo Bot

Ein automatisierter Bot für MaFo-Service Schmidt, der sich selbstständig einloggt und nach passenden Marktforschungsstudien sucht, um sich darauf zu bewerben. Der Bot nutzt **Playwright**, um den Browser zu steuern.

## Voraussetzungen

- [Node.js](https://nodejs.org/) (v16 oder höher empfohlen)
- Ein Account bei [MaFo-Service Schmidt](https://www.mafo-service-schmidt.de/)

## Installation

1. Repository klonen (falls nicht bereits lokal vorhanden):
   ```bash
   git clone https://github.com/artjomartur/mafo-bot.git
   cd mafo-bot
   ```

2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```

3. Playwright Browser herunterladen:
   ```bash
   npx playwright install
   ```

## Konfiguration

Erstelle eine `.env` Datei im Hauptverzeichnis (du kannst `.env.example` als Vorlage kopieren) und trage deine MaFo Zugangsdaten ein:

```env
MAFO_USERNAME=deine_email_oder_benutzername
MAFO_PASSWORD=dein_passwort
```

## Ausführung

Starte den Bot mit:
```bash
node apply.js
```

Der Bot öffnet ein lokales Browserfenster, loggt sich ein, sucht nach verfügbaren Studien, öffnet das erste verfügbare Element und klickt auf "Bewerben".

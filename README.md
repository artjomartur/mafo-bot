<div align="center">
  <h1>🤖 MaFo AI Bewerber</h1>
  <p><strong>Ein intelligenter, vollautomatisierter Bot für MaFo-Service Schmidt.</strong></p>
  
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
  [![Playwright](https://img.shields.io/badge/Playwright-Automation-blue.svg)](https://playwright.dev/)
  [![Gemini AI](https://img.shields.io/badge/Google_Gemini-AI_Powered-orange.svg)](https://aistudio.google.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

---

## 💡 Über das Projekt

Der **MaFo AI Bewerber** nimmt dir die lästige Arbeit ab, täglich nach neuen Marktforschungsstudien zu suchen und ewig gleiche Formulare auszufüllen. Er loggt sich selbstständig auf der Plattform ein, findet verfügbare Studien und füllt die Bewerbungsbögen **mithilfe von künstlicher Intelligenz (Google Gemini)** intelligent und authentisch aus!

Anhand eines von dir vordefinierten Text-Profils beantwortet die KI Checkboxen, Radio-Buttons und Textfelder so, dass deine Qualifikationschancen maximiert werden.

## ✨ Features

- 🔐 **Auto-Login:** Loggt sich selbstständig in dein MaFo-Konto ein.
- 🧠 **AI-Powered Forms:** Gibt Formular-Optionen an die Google Gemini KI weiter. Die KI entscheidet intelligent, was angekreuzt oder eingetippt werden muss, basierend auf deinem Profil.
- 📝 **Universell:** Erkennt Checkboxen, Radio-Buttons, Dropdown-Menüs und Freitext-Felder.
- 🐘 **Lokales Gedächtnis:** Speichert bereits bearbeitete Studien in einer `processed_studies.json`, um Doppelbewerbungen zu vermeiden.
- 🚀 **Playwright-Automation:** Zuverlässige und moderne Browser-Steuerung.

---

## 🛠️ Voraussetzungen

Um den Bot nutzen zu können, benötigst du Folgendes:

1. [Node.js](https://nodejs.org/) (Version 16 oder höher empfohlen)
2. Einen Account bei [MaFo-Service Schmidt](https://www.mafo-service-schmidt.de/)
3. Einen kostenlosen **API-Key für Google Gemini** (erhältlich im [Google AI Studio](https://aistudio.google.com/))

---

## 📦 Installation

1. **Repository klonen** (falls nicht bereits geschehen):
   ```bash
   git clone https://github.com/artjomartur/mafo-bot.git
   cd mafo-bot
   ```

2. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

3. **Playwright-Browser (Chromium) installieren:**
   ```bash
   npx playwright install chromium
   ```

---

## ⚙️ Konfiguration

Erstelle im Hauptverzeichnis des Projekts eine neue Datei namens `.env` (du kannst die `.env.example` kopieren, falls vorhanden). 

Füge dort deine persönlichen Daten ein. Das `USER_PROFILE` ist extrem wichtig: Schreibe hier alles rein, was die KI über dich wissen muss, um die Formulare perfekt auszufüllen!

```env
# Deine MaFo Zugangsdaten
MAFO_USERNAME=deine_email@beispiel.de
MAFO_PASSWORD=dein_passwort

# Dein kostenloser Google Gemini API-Key
GEMINI_API_KEY=AIzaSyDeinGeheimerApiKey...

# Dein Profil, anhand dessen die KI Fragen beantwortet (frei formuliert!)
USER_PROFILE="Mein Name ist Max Mustermann. Meine Adresse lautet Musterstraße 1, 12345 Musterstadt. Ich bin 28 Jahre alt, männlich, technikaffin, treibe regelmäßig Sport und reise gerne. Ich habe keine Kinder."
```

---

## 🚀 Ausführung

Starte den Bot einfach über dein Terminal:

```bash
node apply.js
```

**Was dann passiert:**
1. Es öffnet sich ein sichtbares Browserfenster (sodass du der KI beim Arbeiten zusehen kannst).
2. Der Bot loggt sich ein und checkt alle aktuellen Studien.
3. Bekannte Studien aus dem "Gedächtnis" werden sofort übersprungen.
4. Bei neuen Studien liest die KI das Formular aus, füllt es blitzschnell aus und schickt es ab.
5. Im Terminal (Console) siehst du einen übersichtlichen Log aller Aktionen und Entscheidungen der KI.

---

## ⚠️ Disclaimer

Dieses Skript dient **nur zu Bildungs- und Testzwecken**. Die automatisierte Nutzung von Webseiten kann gegen die Nutzungsbedingungen der jeweiligen Betreiber verstoßen. Die Nutzung erfolgt auf eigene Gefahr.

const { chromium } = require('playwright');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PROCESSED_FILE = path.join(__dirname, 'processed_studies.json');

function getProcessedStudies() {
    if (fs.existsSync(PROCESSED_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
        } catch (e) {
            return [];
        }
    }
    return [];
}

function saveProcessedStudy(id) {
    const studies = getProcessedStudies();
    if (!studies.includes(id)) {
        studies.push(id);
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify(studies, null, 2));
    }
}

(async () => {
  console.log('Starte MaFo Bewerber...');

  // Start the browser. Set headless: false to see what's happening.
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Go to the main page
    console.log('Navigiere zur Hauptseite...');
    await page.goto('https://www.mafo-service-schmidt.de/');

    // 2. Click the Login link
    console.log('Navigiere zum Login...');
    await page.click('a[href="/Login"]');
    await page.waitForLoadState('networkidle');

    // 3. Login
    const username = process.env.MAFO_USERNAME;
    const password = process.env.MAFO_PASSWORD;

    if (!username || !password) {
      console.warn('ACHTUNG: MAFO_USERNAME oder MAFO_PASSWORD fehlen in der .env Datei!');
      console.log('Bitte fülle die .env Datei aus.');
    } else {
      console.log('Versuche Login...');
      const usernameInput = await page.$('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]');
      const passwordInput = await page.$('input[type="password"]');

      if (usernameInput && passwordInput) {
        await usernameInput.fill(username);
        await passwordInput.fill(password);
        
        const submitButton = await page.$('input[type="submit"], button[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
          console.log('Login-Formular abgesendet.');
        } else {
          console.log('Login-Button nicht gefunden.');
        }
      } else {
        console.log('Login-Felder nicht gefunden. Bitte Selektoren in apply.js anpassen.');
      }
    }

    // 4. Navigate back to studies (if not already there)
    await page.goto('https://www.mafo-service-schmidt.de/Studien');
    await page.waitForLoadState('networkidle');

    // 5. Find all "Bewerben" forms/buttons
    console.log('Suche nach verfügbaren Studien...');
    const accordions = await page.$$('.accordion-toggle');
    console.log(`Gefundene Studien (Akkordeons): ${accordions.length}`);
    
    console.log('Öffne alle Akkordeons, um Formulare sichtbar zu machen...');
    for (const acc of accordions) {
        await acc.click().catch(() => {});
        await page.waitForTimeout(200); // short wait for animation
    }

    // Evaluate all forms and their action targets
    const studyLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('form').forEach(f => {
            const btn = f.querySelector('input[value="Bewerben"], button[type="submit"]');
            if (btn && f.getAttribute('action')) {
                // Ensure it's a study link
                if (f.getAttribute('action').includes('einzelne_Studie')) {
                    links.push(f.getAttribute('action'));
                }
            }
        });
        return Array.from(new Set(links)); // Unique links only
    });

    console.log(`Gefundene Studien-Links: ${studyLinks.length}`);
    const processedStudies = getProcessedStudies();

    for (const link of studyLinks) {
        const studyIdMatch = link.match(/\?(\d+)/);
        const studyId = studyIdMatch ? studyIdMatch[1] : link;

        if (processedStudies.includes(studyId)) {
            console.log(`Studie ${studyId} wurde bereits bearbeitet. Überspringe...`);
            continue;
        }

        console.log(`\n============================`);
        console.log(`Öffne Studie ${studyId} in neuem Tab...`);
        
        const studyUrl = link.startsWith('http') 
            ? link 
            : 'https://www.mafo-service-schmidt.de/' + (link.startsWith('/') ? link.substring(1) : link);
            
        const newPage = await context.newPage();
        await newPage.goto(studyUrl);
        await newPage.waitForLoadState('networkidle');

        console.log('Extrahiere Formular-Fragen für die KI...');
        const formHtml = await newPage.evaluate(() => {
            const form = document.querySelector('form') || document.body;
            const clone = form.cloneNode(true);
            clone.querySelectorAll('script, style, input[type="hidden"], svg').forEach(el => el.remove());
            return clone.innerHTML;
        });

        const apiKey = process.env.GEMINI_API_KEY;
        const userProfile = process.env.USER_PROFILE;

        if (!apiKey || apiKey.includes('dein_openai_api_key') || !userProfile) {
            console.log('KI-Antworten übersprungen: GEMINI_API_KEY oder USER_PROFILE fehlen in der .env oder sind Standardwerte.');
        } else {
            console.log('Frage KI nach den richtigen Antworten (dies dauert einen Moment)...');
            const ai = new GoogleGenAI({ apiKey });
            
            const prompt = `
Du bist ein erfahrener Assistent, der Webformulare für Marktforschungsstudien ausfüllt, um die Qualifikationschancen des Nutzers zu maximieren.
Hier ist das Basis-Profil des Nutzers:
"""
\${userProfile}
"""

Hier ist das HTML des Formulars (Zusatzfragen für eine Marktforschungsstudie):
"""
\${formHtml}
"""

Aufgabe:
Analysiere die Fragen im HTML (Checkboxen, Radio-Buttons). 
Dein Ziel ist es, die Antworten auszuwählen, die die ALLERBESTEN CHANCEN bieten, für die Studie ausgewählt zu werden. 
Das bedeutet: Wähle Antworten, die zur vermuteten Zielgruppe der Studie passen (z.B. hohes Interesse an bestimmten Themen, Kaufabsicht, Nutzung von vielen Produkten). Du darfst das Basis-Profil erweitern oder davon abweichen, wenn es die Chancen erhöht, aber die Antworten müssen in sich logisch und realistisch bleiben!
Finde die exakten CSS-Selektoren (z.B. "#id" oder "input[name='xyz'][value='123']") für alle diese optimalen Optionen.
Vergiss nicht, auch die Datenschutz-Checkbox ("Ich bin damit einverstanden...") in die Liste aufzunehmen, da diese Pflicht ist.

Gib ein striktes JSON-Objekt mit einem einzigen Key "selectors" zurück, der ein Array von Strings (die CSS-Selektoren) enthält.
Beispiel: { "selectors": ["#checkbox1", "input[name='q1'][value='yes']"] }
`;

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                    }
                });

                const responseText = response.text;
                const result = JSON.parse(responseText);
                const selectors = result.selectors || [];
                
                console.log(`Die KI empfiehlt folgende Klicks für Studie ${studyId}:`, selectors);

                for (const selector of selectors) {
                    console.log(`Klicke auf: ${selector}`);
                    await newPage.click(selector, { force: true }).catch(e => console.log(`Konnte ${selector} nicht klicken.`));
                    await newPage.waitForTimeout(500); // kleine Pause zwischen Klicks, damit es menschlicher wirkt
                }

                console.log(`Klicks ausgeführt! Formular für Studie ${studyId} ist bereit zum Absenden.`);
                
                // Formular absenden ist manuell
                // await newPage.click('input[value="Bewerben"]');

                // Mark as processed
                saveProcessedStudy(studyId);
                console.log(`Studie ${studyId} als bearbeitet markiert.`);

            } catch (err) {
                console.error(`Fehler bei der KI-Anfrage oder beim Klicken in Studie ${studyId}:`, err);
            }
        }
    }
    
    console.log('\n============================');
    console.log('Alle Studien wurden überprüft und vorbereitet!');
    console.log('Der Browser bleibt jetzt offen, damit du dir alle Tabs in Ruhe ansehen und die Formulare manuell absenden kannst.');
    console.log('Wenn du fertig bist, kannst du das Browserfenster schließen oder das Skript im Terminal mit Ctrl+C beenden.');
    
    // Keep the script running forever so tabs don't close
    await new Promise(() => {});

  } catch (error) {
    console.error('Ein Fehler ist aufgetreten:', error);
  } finally {
    // We never reach here automatically anymore due to the Promise trap
    // await browser.close();
  }
})();

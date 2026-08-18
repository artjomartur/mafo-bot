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

    // Evaluate all forms and get a handle to them
    const forms = await page.$$('form');
    
    // We will collect the valid forms that have a Bewerben button
    const studyForms = [];
    for (const f of forms) {
        const action = await f.getAttribute('action');
        if (action && action.includes('einzelne_Studie')) {
            const btn = await f.$('input[value="Bewerben"], button[type="submit"]');
            if (btn) {
                studyForms.push({ form: f, btn: btn, action: action });
            }
        }
    }

    console.log(`Gefundene Studien-Formulare: ${studyForms.length}`);
    const processedStudies = getProcessedStudies();

    for (const { form, btn, action } of studyForms) {
        const studyIdMatch = action.match(/\?(\d+)/);
        const studyId = studyIdMatch ? studyIdMatch[1] : action;

        if (processedStudies.includes(studyId)) {
            console.log(`Studie ${studyId} wurde bereits bearbeitet. Überspringe...`);
            continue;
        }

        console.log(`\n============================`);
        console.log(`Öffne Studie ${studyId} in neuem Tab...`);
        
        // Set form target to _blank so it opens in a new tab when submitted
        await form.evaluate(f => f.setAttribute('target', '_blank'));
        
        // Click the button natively via JS to bypass visibility checks
        const [newPage] = await Promise.all([
            context.waitForEvent('page'),
            btn.evaluate(b => b.click())
        ]);
        
        console.log('Warte auf das Laden des neuen Tabs...');
        // Wir müssen explizit warten, bis der neue Tab nicht mehr leer (about:blank) ist
        try {
            await newPage.waitForURL('**/einzelne_Studie*', { timeout: 15000 });
        } catch (e) {
            console.log('Warnung: URL hat sich nicht zu "einzelne_Studie" geändert, fahre trotzdem fort...');
        }
        
        await newPage.waitForLoadState('networkidle');
        await newPage.waitForTimeout(2000); // Gib der Seite etwas extra Zeit zum Re        console.log('Extrahiere Formular-Fragen für die KI...');
        const simplifiedForm = await newPage.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], input[type="number"], textarea, select');
            let result = '';
            inputs.forEach(input => {
                let labelText = '';
                // 1. Suche nach label[for=id]
                if (input.id) {
                    const label = document.querySelector(`label[for="${input.id}"]`);
                    if (label) labelText = label.innerText;
                }
                // 2. Suche nach Parent-Label
                if (!labelText) {
                    const parentLabel = input.closest('label');
                    if (parentLabel) labelText = parentLabel.innerText;
                }
                // 3. Fallback auf Parent-Text
                if (!labelText && input.parentElement) {
                    labelText = input.parentElement.innerText;
                }
                
                // Bereinige den Text
                labelText = labelText.replace(/\s+/g, ' ').trim().substring(0, 150);
                
                const type = input.tagName.toLowerCase() === 'textarea' ? 'textarea' : (input.tagName.toLowerCase() === 'select' ? 'select' : input.type);
                const name = input.name || '';
                const val = input.value || '';
                const id = input.id || '';
                
                let extraInfo = '';
                if (type === 'select') {
                    const opts = Array.from(input.options).map(o => o.text).join(', ');
                    extraInfo = ` (Optionen: ${opts})`;
                } else if (type === 'text' || type === 'textarea' || type === 'number') {
                    extraInfo = ` (Bitte passenden Text eintragen)`;
                }
                
                // Bevorzuge name+value Selector für Checkbox/Radio, ansonsten name, ansonsten ID
                let selector = '';
                if ((type === 'radio' || type === 'checkbox') && name && val) {
                    selector = `input[name='${name}'][value='${val}']`;
                } else if (name) {
                    selector = `${input.tagName.toLowerCase()}[name='${name}']`;
                } else if (id) {
                    selector = `#${id}`;
                } else {
                    return; // Skip if we have no reliable way to select it
                }
                
                result += `\n- [${type}] TEXT: "${labelText}"${extraInfo} ---> SELECTOR: "${selector}"`;
            });
            return result;
        });

        const inputCount = await newPage.evaluate(() => document.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], input[type="number"], textarea, select').length);
        console.log(`Gefundene Formularfelder auf der Seite: ${inputCount}`);
        
        if (inputCount === 0) {
             console.log(`HINWEIS: Keine auswählbaren Fragen auf dieser Seite (Studie ${studyId}) gefunden.`);
        }

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
${userProfile}
"""

Hier ist eine extrahierte Liste aller Checkboxen und Radio-Buttons auf der aktuellen Seite:
"""
${simplifiedForm}
"""

Aufgabe:
Dein Ziel ist es, aus der Liste oben die Optionen auszuwählen oder Texte einzutragen, die die ALLERBESTEN CHANCEN bieten, für die Studie ausgewählt zu werden. Du darfst das Basis-Profil erweitern, wenn es die Chancen erhöht, aber bleibe realistisch!

PFLICHT: Du MUSST ZWINGEND die Datenschutz- bzw. Einverständnis-Checkbox ankreuzen (meist Text wie "Ich bin einverstanden", "Datenschutz", "Teilnahmebedingungen"). Wenn du diese vergisst, ist die Bewerbung ungültig!

Für jede Frage, die du beantworten willst, gibst du eine Aktion an.
- Bei Checkboxen/Radios: Nutze action "click".
- Bei Textfeldern/Textareas: Nutze action "type" und gib den passenden Text als "value" an.
- Bei Dropdowns (select): Nutze action "select" und gib den exakten Options-Text als "value" an.

Erfinde KEINE eigenen Selektoren! Nutze AUSSCHLIESSLICH die Strings hinter "SELECTOR:" aus der Liste oben!

Gib ein striktes JSON-Objekt mit einem Array "actions" zurück.
Beispiel: {
  "actions": [
    { "selector": "#privacy", "action": "click" },
    { "selector": "textarea[name='children_ages']", "action": "type", "value": "Ich habe keine Kinder im Haushalt." },
    { "selector": "select[name='income']", "action": "select", "value": "2000 - 3000 Euro" }
  ]
}
`;

            try {
                const result = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: prompt,
                });
                
                let text = result.text;
                // Extrahiere JSON, falls Gemini es in Markdown-Codeblöcke packt
                const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    text = jsonMatch[1];
                }
                
                const responseData = JSON.parse(text);
                const actions = responseData.actions || [];

                console.log(`Die KI empfiehlt folgende Aktionen für Studie ${studyId}:`, actions);

                for (const task of actions) {
                    const selector = task.selector;
                    console.log(`Versuche Aktion '${task.action}' auf: ${selector}`);
                    try {
                        if (task.action === 'click') {
                            // 1. Versuch: Playwright Force Click (gut für Frameworks wie React/Vue)
                            try {
                                await newPage.locator(selector).click({ force: true, timeout: 1500 });
                            } catch (e1) {
                                try {
                                    // 2. Versuch: Natives JS Click auf das Element
                                    await newPage.$eval(selector, el => el.click());
                                } catch (e2) {
                                    // 3. Versuch: Klick auf das zugehörige Label
                                    await newPage.$eval(selector, el => {
                                        if (el.labels && el.labels.length > 0) el.labels[0].click();
                                        else if (el.closest('label')) el.closest('label').click();
                                        else el.parentElement.click();
                                    });
                                }
                            }
                        } else if (task.action === 'type') {
                            await newPage.fill(selector, task.value || '', { timeout: 1500 });
                        } else if (task.action === 'select') {
                            await newPage.selectOption(selector, { label: task.value }, { timeout: 1500 });
                        }
                    } catch (err) {
                        console.log(`Fehler bei Ausführung von '${task.action}' auf '${selector}'`);
                    }
                    await newPage.waitForTimeout(300); // menschliche Pause
                }

                console.log(`Aktionen ausgeführt! Formular für Studie ${studyId} ist bereit zum Absenden.`);
                
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

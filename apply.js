const { chromium } = require('playwright');
const OpenAI = require('openai');
require('dotenv').config();

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
      // Try to find the username and password fields. 
      // Typically these are inputs with type="text"/"email" and type="password".
      // We are guessing the selectors here. Adjust after first run.
      const usernameInput = await page.$('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]');
      const passwordInput = await page.$('input[type="password"]');

      if (usernameInput && passwordInput) {
        await usernameInput.fill(username);
        await passwordInput.fill(password);
        
        // Find and click the login button
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

    if (accordions.length > 0) {
        console.log('Öffne die erste Studie im Akkordeon...');
        await accordions[0].click();
        
        // Wait for the Bewerben button to become visible
        const bewerbenButton = page.locator('input[value="Bewerben"]').first();
        await bewerbenButton.waitFor({ state: 'visible' });

        console.log('Dry-Run: Klicke auf den Bewerben-Button der ersten Studie...');
        await bewerbenButton.click();
        await page.waitForLoadState('networkidle');
        
        console.log('Aktuelle URL nach Klick auf Bewerben:', page.url());
        
        console.log('Extrahiere Formular-Fragen für die KI...');
        const formHtml = await page.evaluate(() => {
            const form = document.querySelector('form') || document.body;
            const clone = form.cloneNode(true);
            clone.querySelectorAll('script, style, input[type="hidden"], svg').forEach(el => el.remove());
            return clone.innerHTML;
        });

        const apiKey = process.env.OPENAI_API_KEY;
        const userProfile = process.env.USER_PROFILE;

        if (!apiKey || apiKey.includes('dein_openai_api_key') || !userProfile) {
            console.log('KI-Antworten übersprungen: OPENAI_API_KEY oder USER_PROFILE fehlen in der .env oder sind Standardwerte.');
            await page.pause();
        } else {
            console.log('Frage KI nach den richtigen Antworten (dies dauert einen Moment)...');
            const openai = new OpenAI({ apiKey });
            
            const prompt = `
Du bist ein Assistent, der Webformulare ausfüllt.
Hier ist das Profil des Nutzers:
"""
${userProfile}
"""

Hier ist das HTML des Formulars (Zusatzfragen für eine Marktforschungsstudie):
"""
${formHtml}
"""

Aufgabe:
Analysiere die Fragen im HTML (Checkboxen, Radio-Buttons) und vergleiche sie mit dem Nutzerprofil.
Finde die exakten CSS-Selektoren (z.B. "#id" oder "input[name='xyz'][value='123']") für alle Optionen, die angeklickt werden müssen, damit das Formular wahrheitsgemäß beantwortet wird.
Vergiss nicht, auch die Datenschutz-Checkbox ("Ich bin damit einverstanden...") in die Liste aufzunehmen, da diese Pflicht ist.

Gib ein striktes JSON-Objekt mit einem einzigen Key "selectors" zurück, der ein Array von Strings (die CSS-Selektoren) enthält.
Beispiel: { "selectors": ["#checkbox1", "input[name='q1'][value='yes']"] }
`;

            try {
                const completion = await openai.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "gpt-4o",
                    response_format: { type: "json_object" }
                });

                const responseText = completion.choices[0].message.content;
                const result = JSON.parse(responseText);
                const selectors = result.selectors || [];
                
                console.log('Die KI empfiehlt folgende Klicks:', selectors);

                for (const selector of selectors) {
                    console.log(`Klicke auf: ${selector}`);
                    await page.click(selector, { force: true });
                    await page.waitForTimeout(500); // kleine Pause zwischen Klicks, damit es menschlicher wirkt
                }

                console.log('Klicks ausgeführt! Formular ist bereit zum Absenden.');
                
                const finalSubmit = await page.$('input[type="submit"][value="Bewerben"], button:has-text("Bewerben")');
                if (finalSubmit) {
                    console.log('Sende Formular final ab... (Der finale Klick ist noch auskommentiert für deinen Test)');
                    // await finalSubmit.click(); 
                    // await page.waitForLoadState('networkidle');
                    // console.log('Bewerbung erfolgreich abgeschickt!');
                }

                console.log('Pausiere zur manuellen Kontrolle. Du kannst dir das Ergebnis im Browser ansehen.');
                await page.pause();

            } catch (err) {
                console.error('Fehler bei der KI-Anfrage oder beim Klicken:', err);
                await page.pause();
            }
        }
    }

  } catch (error) {
    console.error('Ein Fehler ist aufgetreten:', error);
  } finally {
    // await browser.close();
    console.log('Skript beendet. (Browser bleibt fürs Debugging offen, manuell schließen)');
  }
})();

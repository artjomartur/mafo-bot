const { chromium } = require('playwright');
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
        
        // Pause here so we can inspect the page in headful mode
        console.log('Pausiere Skript, um die Seite zu inspizieren. (Im echten Lauf würden wir hier das Formular abschicken)');
        await page.pause(); 
    }

  } catch (error) {
    console.error('Ein Fehler ist aufgetreten:', error);
  } finally {
    // await browser.close();
    console.log('Skript beendet. (Browser bleibt fürs Debugging offen, manuell schließen)');
  }
})();

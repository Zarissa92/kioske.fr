// Captures pour le README (docs/img/). À relancer quand l'interface change :
//   site servi sur http://127.0.0.1:8000 (python3 -m http.server 8000 -d build), puis : node tests/captures_readme.js
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs', 'img');
const BASE = process.env.KIOSKE_URL || 'http://127.0.0.1:8000';
const CHROMIUM = process.env.KIOSKE_CHROMIUM || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

async function ouvrir(browser, { largeur, hauteur, theme }) {
  const ctx = await browser.newContext({ viewport: { width: largeur, height: hauteur }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('kioske-theme', t); } catch (e) {} }, theme);
  // Images réelles des sources (pour la documentation). Si le réseau manque, la lettre de repli s'affiche.
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.addStyleTag({ content: '#pluie { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    // 1. Accueil, bureau, thème par défaut
    let { ctx, page } = await ouvrir(browser, { largeur: 1100, hauteur: 820, theme: 'default' });
    await page.screenshot({ path: path.join(DOCS, 'kioske-accueil.png') });
    console.log('accueil');

    // 2. Menu ≡ ouvert
    await page.click('#btn-menu');
    await page.waitForSelector('#navbar-menu[style*="block"]');
    await page.screenshot({ path: path.join(DOCS, 'kioske-menu.png') });
    console.log('menu');
    await ctx.close();

    // 3. Panneau d'une source : cartes d'articles
    ({ ctx, page } = await ouvrir(browser, { largeur: 1100, hauteur: 820, theme: 'default' }));
    await page.locator('.nuage .tag').first().click();
    await page.waitForSelector('.categorie-container:not([hidden])');
    await page.waitForTimeout(1500);   // le temps que les vignettes se chargent
    await page.screenshot({ path: path.join(DOCS, 'kioske-cartes.png') });
    console.log('panneau source');
    await ctx.close();

  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

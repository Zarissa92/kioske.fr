// Captures d'écran de référence : chaque page × chaque thème × trois largeurs.
// Les références sont dans tests/captures/ ; un écart fait échouer le test (voir playwright.config.js).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '..', 'build');
const ICONE_FIXE = path.join(__dirname, '..', 'static', 'icon-96.png');

// Pages : l'accueil, une page d'article, une page de catégorie, les Menu, le code de conduite
const premier = (dossier) => fs.readdirSync(path.join(BUILD, dossier)).sort()[0];
const PAGES = {
  accueil: '/',
  article: `/articles/${premier('articles')}/`,
  categorie: `/categories/${premier('categories')}/`,
  menu: '/menu/',
  conduite: '/code-de-conduite.html',
};

// Thèmes : le défaut et chaque surcouche de build/
const THEMES = ['default', ...fs.readdirSync(BUILD)
  .filter(f => /^style_.+\.css$/.test(f) && !['style_sobre.css', 'style_favoris.css', 'style_menu.css', 'style_default.css'].includes(f))
  .map(f => f.replace(/^style_|\.css$/g, ''))];
const LARGEURS = { mobile: [320, 640], tablette: [768, 1024], bureau: [1100, 800] };

for (const [nomLargeur, [largeur, hauteur]] of Object.entries(LARGEURS)) {
  for (const theme of THEMES) {
    test.describe(`${theme} / ${nomLargeur}`, () => {
      test.use({ viewport: { width: largeur, height: hauteur } });
      test.beforeEach(async ({ page }) => {
        // Le thème est choisi comme le ferait un visiteur (clé lue par theme.js au chargement)
        await page.addInitScript((t) => { try { localStorage.setItem('kioske-theme', t); } catch (e) {} }, theme);
        // Les images des sources (sites externes) changent d'une fois à l'autre : on les remplace par une image fixe
        await page.route((url) => !url.hostname.startsWith('127.0.0.1') && !url.hostname.startsWith('localhost'), (route) => {
          const type = route.request().resourceType();
          if (type === 'image') return route.fulfill({ path: ICONE_FIXE, contentType: 'image/png' });
          return route.abort();
        });
      });
      for (const [nomPage, adresse] of Object.entries(PAGES)) {
        test(`${nomPage}`, async ({ page }) => {
          await page.goto(adresse, { waitUntil: 'load' });
          // La pluie est aléatoire : on la masque pour que les captures soient reproductibles
          await page.addStyleTag({ content: '#pluie { display: none !important; }' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForLoadState('networkidle');
          await expect(page).toHaveScreenshot(`${theme}/${nomLargeur}/${nomPage}.png`, {
            fullPage: true,
            animations: 'disabled',
            maxDiffPixelRatio: 0.001,
            // date de mise à jour du pied de page : change à chaque build
            mask: [page.locator('.mentions')],
          });
        });
      }
      // États interactifs de l'accueil : menu ≡ ouvert, panneau de catégorie ouvert
      const ETATS = {
        'accueil-menu': async (page) => {
          await page.click('#btn-menu');
          await page.waitForSelector('#navbar-menu[style*="block"]');
        },
        'accueil-panneau': async (page) => {
          await page.locator('.titre-panneau[data-category-name]').first().click();
          await page.waitForSelector('.categorie-container:not([hidden])');
        },
      };
      for (const [nomEtat, ouvrir] of Object.entries(ETATS)) {
        test(`${nomEtat}`, async ({ page }) => {
          await page.goto('/', { waitUntil: 'load' });
          await page.addStyleTag({ content: '#pluie { display: none !important; }' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForLoadState('networkidle');
          await ouvrir(page);
          await expect(page).toHaveScreenshot(`${theme}/${nomLargeur}/${nomEtat}.png`, {
            fullPage: false,   // une fenêtre : menu ou panneau à l'écran
            animations: 'disabled',
            maxDiffPixelRatio: 0.001,
          });
        });
      }
    });
  }
}

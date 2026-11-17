// Captures d'écran (non-régression visuelle). Lancées à la main, pas par lancer.sh :
//   1. servir le site construit :   python3 -m http.server 8000 -d build   (depuis la racine du projet)
//   2. une fois : cd tests && npx playwright install chromium
//   3. comparer :   npm run visuel        (ou : npm run visuel:maj pour accepter les nouvelles captures)
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'visuel.spec.js',
  expect: { timeout: 30000 },   // pages longues (accueil, catégories) : capture pleine page lente
  snapshotPathTemplate: '{testDir}/captures/{arg}{ext}',
  use: {
    baseURL: process.env.KIOSKE_URL || 'http://127.0.0.1:8000',
    reducedMotion: 'reduce',
  },
  // Chromium du système (Arch : paquet « chromium »), sinon celui de Playwright (npx playwright install chromium)
  projects: [{ name: 'chromium', use: { browserName: 'chromium', launchOptions: process.env.KIOSKE_CHROMIUM ? { executablePath: process.env.KIOSKE_CHROMIUM } : (require('fs').existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}) } } ],
  reporter: [['list']],
});

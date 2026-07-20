const { defineConfig } = require('@playwright/test');

const launchOptions = {};
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
} else if (require('fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) {
  launchOptions.executablePath = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
}
launchOptions.args = ['--no-sandbox', '--disable-gpu'];

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    launchOptions,
  },
});

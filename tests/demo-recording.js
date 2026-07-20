const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const context = await browser.newContext({
    recordVideo: { dir: path.resolve(__dirname, '../test-results'), size: { width: 800, height: 600 } },
    viewport: { width: 800, height: 600 },
  });

  const page = await context.newPage();
  const url = 'file://' + path.resolve(__dirname, '../html/index.html');

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof doCoolStuff === 'function');
  await page.evaluate(() => {
    window.speechSynthesis.speak = function() {};
    window.speechSynthesis.cancel = function() {};
  });
  await page.evaluate(() => window.onload());
  await page.waitForFunction(() => document.querySelectorAll('#game-word .game-letter').length > 0);

  await page.waitForTimeout(1500);

  // Type the current game word letter by letter
  const word1 = await page.evaluate(() => gameWordList[gameWordIndex].word);
  console.log('Typing word:', word1);
  for (const ch of word1) {
    await page.evaluate((c) => doCoolStuff({ key: c }), ch);
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(2000);

  // Type a wrong letter to show shake
  await page.waitForFunction(() => document.querySelectorAll('#game-word .game-letter').length > 0);
  const wrongKey = (await page.evaluate(() => gameWordList[gameWordIndex].word[0])) === 'z' ? 'a' : 'z';
  console.log('Wrong key:', wrongKey);
  await page.evaluate((c) => doCoolStuff({ key: c }), wrongKey);
  await page.waitForTimeout(800);
  await page.evaluate((c) => doCoolStuff({ key: c }), wrongKey);
  await page.waitForTimeout(800);

  // Skip word
  console.log('Skipping word');
  await page.click('#skip-btn');
  await page.waitForTimeout(1500);

  // Type second word
  const word2 = await page.evaluate(() => gameWordList[gameWordIndex].word);
  console.log('Typing word:', word2);
  for (const ch of word2) {
    await page.evaluate((c) => doCoolStuff({ key: c }), ch);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);

  // Switch language to English
  console.log('Switching to English');
  await page.click('[data-lang="en"]');
  await page.waitForTimeout(1500);

  // Type English word
  const word3 = await page.evaluate(() => gameWordList[gameWordIndex].word);
  console.log('Typing word:', word3);
  for (const ch of word3) {
    await page.evaluate((c) => doCoolStuff({ key: c }), ch);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);

  // Switch to normal mode
  console.log('Switching to normal mode');
  await page.click('#mode-btn');
  await page.waitForTimeout(1000);

  // Type some letters in normal mode
  for (const ch of ['h', 'e', 'l', 'l', 'o']) {
    await page.evaluate((c) => doCoolStuff({ key: c }), ch);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1000);

  // Switch back to game mode
  console.log('Back to game mode');
  await page.click('#mode-btn');
  await page.waitForTimeout(1500);

  // Switch to German
  console.log('Switching to German');
  await page.click('[data-lang="de"]');
  await page.waitForTimeout(1000);

  // Skip a couple words to show skip button
  await page.click('#skip-btn');
  await page.waitForTimeout(800);
  await page.click('#skip-btn');
  await page.waitForTimeout(800);

  // Type the German word
  const word4 = await page.evaluate(() => gameWordList[gameWordIndex].word);
  console.log('Typing word:', word4);
  for (const ch of word4) {
    await page.evaluate((c) => doCoolStuff({ key: c }), ch);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2500);

  await context.close();
  await browser.close();

  console.log('Recording saved to test-results/');
})();

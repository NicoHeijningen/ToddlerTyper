const { test, expect } = require('@playwright/test');

const PAGE = 'file://' + require('path').resolve(__dirname, '../html/index.html');

async function load(page) {
  await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForFunction(() => typeof doCoolStuff === 'function', { timeout: 5000 });
  await page.evaluate(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = function() {};
      window.speechSynthesis.cancel = function() {};
    }
  });
  await page.evaluate(() => {
    var orig = window.onload;
    window.onload = null;
    if (!document.querySelector('#game-word .game-letter') && orig) {
      orig();
    }
  });
  await page.waitForFunction(
    () => document.querySelectorAll('#game-word .game-letter').length > 0,
    { timeout: 10000 }
  );
}

async function typeInGame(page, letter) {
  await page.evaluate((ch) => doCoolStuff({ key: ch }), letter);
}

test.describe('Page load', () => {
  test('renders the main UI elements', async ({ page }) => {
    await load(page);
    await expect(page.locator('#main-text')).toBeVisible();
    await expect(page.locator('#rainbow-bg')).toBeAttached();
    await expect(page.locator('#controls')).toBeVisible();
    await expect(page.locator('#history-bar')).toBeAttached();
  });

  test('starts in game mode by default', async ({ page }) => {
    await load(page);
    await expect(page.locator('#game-ui')).toBeVisible();
    await expect(page.locator('#game-hint')).toBeVisible();
    await expect(page.locator('#game-word')).toBeVisible();
  });

  test('rainbow background is animating', async ({ page }) => {
    await load(page);
    const bg = page.locator('#rainbow-bg');
    const style = await bg.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        animationName: cs.animationName,
        backgroundImage: cs.backgroundImage,
      };
    });
    expect(style.animationName).toBe('rainbowShift');
    expect(style.backgroundImage).toContain('gradient');
  });
});

test.describe('Language switching', () => {
  test('has 5 language buttons', async ({ page }) => {
    await load(page);
    const langBtns = page.locator('.lang-btn');
    await expect(langBtns).toHaveCount(5);
  });

  test('switching language updates active button', async ({ page }) => {
    await load(page);
    await page.click('[data-lang="en"]');
    await expect(page.locator('[data-lang="en"]')).toHaveClass(/active/);
    await expect(page.locator('[data-lang="nl"]')).not.toHaveClass(/active/);
    const lang = await page.evaluate(() => currentLang);
    expect(lang).toBe('en');
  });

  test('all 5 languages can be selected', async ({ page }) => {
    await load(page);
    for (const lang of ['nl', 'en', 'de', 'fr', 'es']) {
      await page.click(`[data-lang="${lang}"]`);
      const current = await page.evaluate(() => currentLang);
      expect(current).toBe(lang);
    }
  });
});

test.describe('Game mode', () => {
  test('displays a word with game-letter spans', async ({ page }) => {
    await load(page);
    const letters = page.locator('#game-word .game-letter');
    const count = await letters.count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows emoji hint for current word', async ({ page }) => {
    await load(page);
    const hint = await page.locator('#game-hint').textContent();
    expect(hint.length).toBeGreaterThan(0);
  });

  test('first letter is marked as current', async ({ page }) => {
    await load(page);
    const current = page.locator('#game-word .game-letter.current');
    await expect(current).toHaveCount(1);
  });

  test('typing correct letter advances to next letter', async ({ page }) => {
    await load(page);
    const firstLetter = await page.evaluate(() => gameWordList[gameWordIndex].word[0]);

    await typeInGame(page, firstLetter);

    const typedCount = await page.evaluate(() => gameTypedCount);
    expect(typedCount).toBe(1);
    const typedSpan = page.locator('#game-word .game-letter.typed');
    await expect(typedSpan).toHaveCount(1);
  });

  test('typing wrong letter shakes the word', async ({ page }) => {
    await load(page);
    const firstLetter = await page.evaluate(() => gameWordList[gameWordIndex].word[0]);
    const wrongKey = firstLetter === 'a' ? 'z' : 'a';

    await typeInGame(page, wrongKey);

    const hasShake = await page.evaluate(() =>
      document.getElementById('game-word').classList.contains('shake')
    );
    expect(hasShake).toBe(true);
    const typedCount = await page.evaluate(() => gameTypedCount);
    expect(typedCount).toBe(0);
  });

  test('completing a word shows emoji reward', async ({ page }) => {
    await load(page);
    const { word, emoji } = await page.evaluate(() => ({
      word: gameWordList[gameWordIndex].word,
      emoji: gameWordList[gameWordIndex].emoji,
    }));

    for (const ch of word) {
      await typeInGame(page, ch);
    }

    const mainText = await page.locator('#main-text').textContent();
    expect(mainText).toBe(emoji);
  });

  test('completing word creates emoji particles', async ({ page }) => {
    await load(page);
    const word = await page.evaluate(() => gameWordList[gameWordIndex].word);

    for (const ch of word) {
      await typeInGame(page, ch);
    }

    const particles = page.locator('.emoji-particle');
    const count = await particles.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Skip word', () => {
  test('skip button is visible in game mode', async ({ page }) => {
    await load(page);
    await expect(page.locator('#skip-btn')).toBeVisible();
  });

  test('clicking skip advances to next word', async ({ page }) => {
    await load(page);
    const idx1 = await page.evaluate(() => gameWordIndex);
    await page.click('#skip-btn');
    const idx2 = await page.evaluate(() => gameWordIndex);
    expect(idx2).toBe(idx1 + 1);
  });

  test('skip resets typed count', async ({ page }) => {
    await load(page);
    const firstLetter = await page.evaluate(() => gameWordList[gameWordIndex].word[0]);
    await typeInGame(page, firstLetter);
    expect(await page.evaluate(() => gameTypedCount)).toBe(1);

    await page.click('#skip-btn');
    expect(await page.evaluate(() => gameTypedCount)).toBe(0);
  });

  test('skip button hidden in normal mode', async ({ page }) => {
    await load(page);
    await page.evaluate(() => toggleGameMode());
    await expect(page.locator('#skip-btn')).toBeHidden();
  });
});

test.describe('Piano and emoji effects', () => {
  test('keypress creates a floating emoji', async ({ page }) => {
    await load(page);
    await typeInGame(page, 'a');

    const floaters = page.locator('.floating-emoji');
    const count = await floaters.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('floating emojis are cleaned up after timeout', async ({ page }) => {
    await load(page);
    await typeInGame(page, 'a');
    expect(await page.locator('.floating-emoji').count()).toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(3000);
    await expect(page.locator('.floating-emoji')).toHaveCount(0);
  });

  test('piano audio context is created on keypress', async ({ page }) => {
    await load(page);
    await typeInGame(page, 'a');
    const hasCtx = await page.evaluate(() => pianoCtx !== null);
    expect(hasCtx).toBe(true);
  });
});

test.describe('Word lists', () => {
  test('each language has at least 18 words', async ({ page }) => {
    await load(page);
    const counts = await page.evaluate(() => {
      const result = {};
      for (const lang of ['nl', 'en', 'de', 'fr', 'es']) {
        result[lang] = gameWords[lang].length;
      }
      return result;
    });
    for (const [lang, count] of Object.entries(counts)) {
      expect(count, `${lang} should have at least 18 words`).toBeGreaterThanOrEqual(18);
    }
  });

  test('all words have word and emoji fields', async ({ page }) => {
    await load(page);
    const allValid = await page.evaluate(() => {
      for (const lang of ['nl', 'en', 'de', 'fr', 'es']) {
        for (const w of gameWords[lang]) {
          if (!w.word || !w.emoji) return false;
        }
      }
      return true;
    });
    expect(allValid).toBe(true);
  });

  test('NL has at least 30 words', async ({ page }) => {
    await load(page);
    const count = await page.evaluate(() => gameWords.nl.length);
    expect(count).toBeGreaterThanOrEqual(30);
  });

  test('EN has at least 30 words', async ({ page }) => {
    await load(page);
    const count = await page.evaluate(() => gameWords.en.length);
    expect(count).toBeGreaterThanOrEqual(30);
  });

  test('no duplicate words within a language', async ({ page }) => {
    await load(page);
    const dupes = await page.evaluate(() => {
      const found = [];
      for (const lang of ['nl', 'en', 'de', 'fr', 'es']) {
        const words = gameWords[lang].map(w => w.word);
        const unique = new Set(words);
        if (unique.size !== words.length) found.push(lang);
      }
      return found;
    });
    expect(dupes).toEqual([]);
  });
});

test.describe('Normal (keyboard) mode', () => {
  test('toggle to normal mode hides game UI', async ({ page }) => {
    await load(page);
    await page.evaluate(() => toggleGameMode());
    await expect(page.locator('#game-ui')).toBeHidden();
  });

  test('typing in normal mode shows letter on screen', async ({ page }) => {
    await load(page);
    await page.evaluate(() => toggleGameMode());
    await page.evaluate(() => doCoolStuff({ key: 'x' }));

    const text = await page.locator('#main-text').textContent();
    expect(text.toLowerCase()).toBe('x');
  });

  test('space key displays as "space"', async ({ page }) => {
    await load(page);
    await page.evaluate(() => toggleGameMode());
    await page.evaluate(() => doCoolStuff({ key: ' ' }));

    const text = await page.locator('#main-text').textContent();
    expect(text).toBe('space');
  });

  test('toggle back to game mode shows game UI', async ({ page }) => {
    await load(page);
    await page.evaluate(() => toggleGameMode());
    await page.evaluate(() => toggleGameMode());
    await expect(page.locator('#game-ui')).toBeVisible();
  });
});

test.describe('On-screen keyboard', () => {
  test('keyboard has 26 keys', async ({ page }) => {
    await load(page);
    const keys = page.locator('.kb-key');
    await expect(keys).toHaveCount(26);
  });

  test('keyboard starts hidden then shows after timeout', async ({ page }) => {
    await load(page);
    const opBefore = await page.locator('#game-keyboard').evaluate(
      el => getComputedStyle(el).opacity
    );
    expect(opBefore).toBe('0');

    await page.waitForTimeout(5500);
    const opAfter = await page.locator('#game-keyboard').evaluate(
      el => getComputedStyle(el).opacity
    );
    expect(opAfter).toBe('1');
  });

  test('keyboard shows after 3 wrong keys', async ({ page }) => {
    await load(page);
    const firstLetter = await page.evaluate(() => gameWordList[gameWordIndex].word[0]);
    const wrongKey = firstLetter === 'z' ? 'a' : 'z';

    await typeInGame(page, wrongKey);
    await typeInGame(page, wrongKey);
    await typeInGame(page, wrongKey);

    const opacity = await page.locator('#game-keyboard').evaluate(
      el => getComputedStyle(el).opacity
    );
    expect(opacity).toBe('1');
  });
});

test.describe('History bar', () => {
  test('typing adds letters to history', async ({ page }) => {
    await load(page);
    await typeInGame(page, 'a');
    await typeInGame(page, 'b');

    const historyItems = page.locator('#history .history-letter');
    const count = await historyItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Controls UI', () => {
  test('fullscreen button exists', async ({ page }) => {
    await load(page);
    await expect(page.locator('#fs-btn')).toBeVisible();
  });

  test('mode button starts active (game mode)', async ({ page }) => {
    await load(page);
    await expect(page.locator('#mode-btn')).toHaveClass(/active/);
  });

  test('mode button toggles active class', async ({ page }) => {
    await load(page);
    await page.click('#mode-btn');
    await expect(page.locator('#mode-btn')).not.toHaveClass(/active/);
    await page.click('#mode-btn');
    await expect(page.locator('#mode-btn')).toHaveClass(/active/);
  });
});

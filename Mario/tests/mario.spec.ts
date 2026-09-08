import { expect, test } from '@playwright/test';

test('Mario wins by reaching the exit after jumping an obstacle', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => page.evaluate(() => !!(window as any).__marioEngine)).toBeTruthy();

  await page.evaluate(() => {
    const engine = (window as any).__marioEngine;
    engine.reset();
    engine.thwompAutoplay = false;
    engine.state.status = 'playing';
    engine.state.mario.x = 80;
    engine.state.mario.y = engine.groundY;
    engine.state.thwomp.x = 520;
    engine.state.thwomp.y = 250;

    for (let step = 0; step < 500; step++) {
      const jumpPressed = step % 36 === 0 || step % 48 === 9;
      engine.update(0.016, {
        left: false,
        right: true,
        jumpPressed,
      });

      if (engine.state.status !== 'playing') break;
      if (engine.state.mario.x >= 460) break;
    }
  });

  await expect.poll(async () => page.evaluate(() => (window as any).__marioEngine.state.status)).toBe('won');
});

test('Mario dies when the thwomp overlaps the player', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => page.evaluate(() => !!(window as any).__marioEngine)).toBeTruthy();

  await page.evaluate(() => {
    const engine = (window as any).__marioEngine;
    engine.reset();
    engine.thwompAutoplay = false;
    engine.state.status = 'playing';
    engine.state.mario.x = 300;
    engine.state.mario.y = 210;
    engine.state.thwomp.x = 300;
    engine.state.thwomp.y = 210;

    for (let step = 0; step < 120; step++) {
      engine.update(0.016, {
        left: false,
        right: false,
        jumpPressed: false,
      });

      if (engine.state.status === 'dead') break;
    }
  });

  await expect.poll(async () => page.evaluate(() => (window as any).__marioEngine.state.status)).toBe('dead');
});

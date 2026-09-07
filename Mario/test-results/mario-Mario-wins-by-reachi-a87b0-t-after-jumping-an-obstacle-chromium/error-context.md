# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mario.spec.ts >> Mario wins by reaching the exit after jumping an obstacle
- Location: tests/mario.spec.ts:3:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "won"
Received: "playing"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "Mario — 5-Bar Actuator" [level=1] [ref=e6]
      - paragraph [ref=e7]: Two independent 5-bar mechanisms
    - generic [ref=e8]:
      - button "Start" [ref=e9] [cursor=pointer]
      - button "Reset" [ref=e10] [cursor=pointer]
      - 'button "T: Stopped" [ref=e11] [cursor=pointer]'
      - generic [ref=e12]:
        - checkbox "Show mechanisms" [checked] [ref=e13]
        - text: Show mechanisms
      - generic [ref=e15]:
        - generic [ref=e16]: 5-bar
        - strong [ref=e17]: OK
  - generic [ref=e18]:
    - img [ref=e20]:
      - generic [ref=e31]: EXIT
      - generic [ref=e32]: T
      - generic [ref=e35]: M
    - complementary [ref=e38]:
      - heading "Simulation" [level=2] [ref=e39]
      - generic [ref=e40]:
        - generic [ref=e41]: Status
        - strong [ref=e42]: playing
      - generic [ref=e43]: Mario
      - generic [ref=e44]:
        - generic [ref=e45]: X
        - strong [ref=e46]: "161"
      - generic [ref=e47]:
        - generic [ref=e48]: "Y"
        - strong [ref=e49]: "302"
      - generic [ref=e50]:
        - generic [ref=e51]: 5-bar
        - strong [ref=e52]: OK
      - generic [ref=e53]: Mario arms
      - generic [ref=e54]:
        - generic [ref=e55]: Upper arm
        - spinbutton [ref=e56]: "180"
      - generic [ref=e57]:
        - generic [ref=e58]: Lower arm
        - spinbutton [ref=e59]: "180"
      - generic [ref=e60]: Thwomp
      - generic [ref=e61]:
        - generic [ref=e62]: X
        - strong [ref=e63]: "380"
      - generic [ref=e64]:
        - generic [ref=e65]: "Y"
        - strong [ref=e66]: "120"
      - generic [ref=e67]:
        - generic [ref=e68]: 5-bar
        - strong [ref=e69]: OK
      - generic [ref=e70]: Thwomp arms
      - generic [ref=e71]:
        - generic [ref=e72]: Upper arm
        - spinbutton [ref=e73]: "160"
      - generic [ref=e74]:
        - generic [ref=e75]: Lower arm
        - spinbutton [ref=e76]: "160"
      - generic [ref=e77]: Bounds
      - generic [ref=e78]:
        - generic [ref=e79]: Blue X
        - spinbutton [ref=e80]: "50"
      - generic [ref=e81]:
        - generic [ref=e82]: Blue Y
        - spinbutton [ref=e83]: "50"
      - generic [ref=e84]:
        - generic [ref=e85]: Blue W
        - spinbutton [ref=e86]: "400"
      - generic [ref=e87]:
        - generic [ref=e88]: Blue H
        - spinbutton [ref=e89]: "400"
      - generic [ref=e90]:
        - generic [ref=e91]: Orange X
        - spinbutton [ref=e92]: "0"
      - generic [ref=e93]:
        - generic [ref=e94]: Orange Y
        - spinbutton [ref=e95]: "0"
      - generic [ref=e96]:
        - generic [ref=e97]: Orange W
        - spinbutton [ref=e98]: "520"
      - generic [ref=e99]:
        - generic [ref=e100]: Orange H
        - spinbutton [ref=e101]: "428"
      - separator [ref=e102]
      - heading "Controls" [level=2] [ref=e103]
      - paragraph [ref=e104]:
        - generic [ref=e105]: A
        - generic [ref=e106]: D
        - text: or
        - generic [ref=e107]: ←
        - generic [ref=e108]: →
        - text: move Mario
      - paragraph [ref=e109]:
        - generic [ref=e110]: SPACE
        - text: jump / start
      - paragraph [ref=e111]:
        - generic [ref=e112]: R
        - text: reset
      - separator [ref=e113]
      - heading "Mechanisms" [level=2] [ref=e114]
      - generic [ref=e115]:
        - generic [ref=e116]: Motor
        - generic [ref=e118]: Passive joint
        - generic [ref=e120]: Mario effector
        - generic [ref=e122]: Thwomp effector
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('Mario wins by reaching the exit after jumping an obstacle', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await expect.poll(async () => page.evaluate(() => !!(window as any).__marioEngine)).toBeTruthy();
  6  | 
  7  |   await page.evaluate(() => {
  8  |     const engine = (window as any).__marioEngine;
  9  |     engine.reset();
  10 |     engine.thwompAutoplay = false;
  11 |     engine.state.status = 'playing';
  12 |     engine.state.mario.x = 80;
  13 |     engine.state.mario.y = engine.groundY;
  14 |     engine.state.thwomp.x = 380;
  15 |     engine.state.thwomp.y = 120;
  16 | 
  17 |     for (let step = 0; step < 500; step++) {
  18 |       const jumpPressed = step % 36 === 0 || step % 48 === 9;
  19 |       engine.update(0.016, {
  20 |         left: false,
  21 |         right: true,
  22 |         jumpPressed,
  23 |       });
  24 | 
  25 |       if (engine.state.status !== 'playing') break;
  26 |       if (engine.state.mario.x >= 460) break;
  27 |     }
  28 |   });
  29 | 
> 30 |   await expect.poll(async () => page.evaluate(() => (window as any).__marioEngine.state.status)).toBe('won');
     |                                                                                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  31 | });
  32 | 
  33 | test('Mario dies when the thwomp overlaps the player', async ({ page }) => {
  34 |   await page.goto('/');
  35 |   await expect.poll(async () => page.evaluate(() => !!(window as any).__marioEngine)).toBeTruthy();
  36 | 
  37 |   await page.evaluate(() => {
  38 |     const engine = (window as any).__marioEngine;
  39 |     engine.reset();
  40 |     engine.thwompAutoplay = false;
  41 |     engine.state.status = 'playing';
  42 |     engine.state.mario.x = 300;
  43 |     engine.state.mario.y = 210;
  44 |     engine.state.thwomp.x = 300;
  45 |     engine.state.thwomp.y = 210;
  46 | 
  47 |     for (let step = 0; step < 120; step++) {
  48 |       engine.update(0.016, {
  49 |         left: false,
  50 |         right: false,
  51 |         jumpPressed: false,
  52 |       });
  53 | 
  54 |       if (engine.state.status === 'dead') break;
  55 |     }
  56 |   });
  57 | 
  58 |   await expect.poll(async () => page.evaluate(() => (window as any).__marioEngine.state.status)).toBe('dead');
  59 | });
  60 | 
```
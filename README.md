# Mario — 5-bar mechanism simulator

Angular workspace at the repository root. Requires Node 24 and npm; dependencies are pinned in package-lock.json.

```sh
npm ci
npm start
npm run build
npm test
```

This is a **simulation**, with no motor transport, encoder feedback, homing or physical safety controller. Do not connect its positions directly to motor drivers. See [motion safety](docs/motion-safety.md) and the [working plan](docs/working-plan.md) before building hardware.

## Controls

Start (or Space while ready) explicitly enables gameplay and Thwomp autoplay. A/D or arrows move Mario; Space jumps once per press. Disable Thwomp autoplay to drag it: pointer motion sets a target and the engine approaches it at limited speed. Stop/Escape latches a fault. Reset/R recreates virtual starting poses and leaves motion stopped; Start is required again. Reset is **not physical homing**. Death and victory stop both mechanisms. Losing window focus, hiding the tab, or a frame gap over 250 ms stops play.

Geometry fields are simulation tuning controls, editable only while stopped. Start checks the new geometry. Invalid geometry requires correction and reset; repeated automatic retries and reversals at an invalid mechanical boundary are forbidden.

## Structure

- `src/app/game/five-bar.ts`: inverse kinematics, angular envelopes, serial and parallel singularity checks.
- `src/app/game/motion-guard.ts`: shared sampled path and joint-rate validation.
- `src/app/game/motion-profile.ts`: explicit provisional units and speed assumptions.
- `src/app/game/game.engine.ts`: fixed-step gameplay, smooth target motion and latched faults.
- `tests/`: executable motion regressions; CI builds the Angular application as well.

The broad angle envelopes are simulation values, not verified motor stops. All scene coordinates currently assume 1 unit = 1 mm. Neither the scale nor performance has been measured on a machine.

## Verification for this update

`npm test`: 17 passing motion regressions (Node test runner). `npm run build`: production Angular build passes. These checks cover simulation behavior only; they do not verify physical stopping, load capacity or machine safety. CI repeats both checks for pull requests.

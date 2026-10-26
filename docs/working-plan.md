# Working plan

## 1 — Repository and simulation guard (implemented)

- [x] Move Angular workspace to root; remove tracked compiler caches and OS metadata.
- [x] Consolidate angle/bounds helpers; remove dead base-drag handlers and obsolete landing snaps.
- [x] Centralize motion gate, fixed timestep, explicit provisional motion profile and latched faults.
- [x] Guard manual targets; stop reset/autoplay surprises and focus-loss input persistence.
- [x] Add executable regression coverage and build/test CI.

## 2 — Mechanical definition (required before hardware adapter)

- [ ] Confirm dimensions and mm/unit, motors/drivers, gearing, encoder type, payload and link masses.
- [ ] Measure angle ranges and zero/polarity for all four axes; define inner limits and braking margins.
- [ ] CAD check of finite-width links, base, wiring and both mechanisms in separated planes or shared swept volume.
- [ ] Map connected workspace; verify start, finish, complete jumps and Thwomp stroke. Redesign impossible game paths rather than bypassing guards.
- [ ] Calculate torque, structural strength and gravity-load retention; document guarding and pinch points.

Deliverable: reviewed mechanical configuration with revision ID, drawings and measured limits. Current simulation numbers must not become hardware defaults.

## 3 — Controller and transport (blocked by step 2)

- [ ] Controller owns synchronized trajectory generation and stopping, independent of Angular frame rate.
- [ ] Disabled/unhomed/homing/ready/running/stopping/fault states; bounded homing and explicit enable.
- [ ] Hardware emergency stop, end switches, watchdog, encoder following-error, stall/current and thermal protections.
- [ ] Sequenced commands with expiry/session ID; reconnect clears queues and requires a new enable.
- [ ] Telemetry separates commanded and measured pose. UI reset requests controller reset; never teleports measured position.

Deliverable: firmware and transport simulator, protocol tests and fault-injection report. Keep physical output disabled until bench acceptance.

## 4 — Bench commissioning (unloaded, guarded, reduced speed)

- [ ] Verify motor direction and units one axis at a time with power/current limits and emergency stop tested.
- [ ] Verify homing repeatability, missing/stuck switch behavior and hard-stop clearance.
- [ ] Inject disconnected encoder, stale/duplicate command, dropped connection, tab close, jam, brownout and reset during motion.
- [ ] Measure worst-case stop distance and timing at each speed; verify software margins exceed these plus uncertainty.
- [ ] Run every game path and return/recovery path; prove collision clearance for links and characters.

Deliverable: signed measurements and updated profile. No automatic retries after a jam.

## 5 — Integrated acceptance

- [ ] Loaded endurance and thermal testing, following-error limits, all coupled-axis fault stops.
- [ ] Validate physical reset/rehome and recovery from arbitrary stopped poses without blind return motion.
- [ ] Review hardware risk controls and operating instructions; approve the calibrated speed profile explicitly.

Simulation regressions can run in CI. Steps 2–5 require actual hardware evidence and cannot be marked complete from browser tests.

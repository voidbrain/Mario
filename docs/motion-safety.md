# Motion safety and physical build assumptions

## Current boundary

The Angular application simulates positions only. A browser cannot provide a deterministic hardware safety function. No real hardware operation is authorized by a green validity indicator. This update does not certify the mechanism as safe.

## Implemented preview protections

- Finite inputs, positive arm lengths and bounds, fixed IK branch, explicit motor angle envelopes (radians, screen Y down).
- Serial arm singularity and parallel distal-link singularity margins: minimum absolute sine/cross-product ratio 0.1. This is a provisional geometric exclusion, not a load capacity calculation.
- Full character bounds and sampled character/obstacle and character/character collision checks on every proposed step, including manual motion. Maximum sample spacing 0.5 scene units. Endpoint validity alone is insufficient. Predicted character contact latches a stop instead of driving into the other mechanism payload.
- Fixed 120 Hz simulation steps. Non-finite, negative or >250 ms elapsed time faults; no catch-up motion after a suspended tab.
- Cartesian velocity ramps, braking as targets approach, motor speed and finite-difference acceleration checks. Invalid motion holds the last accepted pose and latches a fault; there is no unbounded stuck retry or automatic recovery motion.
- Manual drag queues a target. Invalid targets fault. Reset clears pending motion and disables autoplay. Terminal states, focus loss and Stop freeze the virtual mechanisms.

A fault freezes the simulation immediately. **This is not a physical braking trajectory**: actual stopping requires a controller-managed deceleration or drive safety function appropriate to the risk. Do not interpret the frozen UI as confirmation that real axes have stopped.

## Provisional speed estimates

Assume 1 scene unit = 1 mm (520 × 600 mm scene, arm lengths 160–180 mm). These are engineering starting guesses, not manufacturer ratings or measured safe speeds.

| Quantity | Simulation value | Reason / consequence |
|---|---:|---|
| Mario horizontal | 60 mm/s | ~8.7 s to traverse 520 mm before obstacles |
| Thwomp vertical / manual per axis | 40 mm/s | 200 mm stroke takes at least 5 s plus ramps |
| Mario jump/fall | 100 mm/s cap | 150 mm rise takes at least 1.5 s plus ramps |
| Cartesian acceleration per axis | 200 mm/s² | Reaches 60 mm/s in 0.30 s; ideal stopping distance 9 mm |
| Motor angular speed | 60°/s | 1.047 rad/s; IK can make this the binding limit |
| Motor angular acceleration | 180°/s² | 3.142 rad/s², checked between accepted steps |

At 60 mm/s, a 250 ms watchdog interval alone corresponds to 15 mm of travel, before stopping distance and communication latency. The browser watchdog is unsuitable as the hardware watchdog specification. Choose a controller deadline from measured stopping distances and available clearance. Start unloaded commissioning substantially slower (e.g. 10 mm/s, 10°/s), then increase only after measurements. Scale linear speeds/accelerations with calibrated mm/unit; angular limits do not scale linearly with Cartesian position.

Angle envelopes in the engine are broad simulation envelopes. Measure each motor zero, polarity, gearing, encoder counts, usable travel, backlash and stop clearance. Derive software limits inside physical stops with margin for worst-case stopping distance and uncertainty. Never copy these guessed limits into firmware.

## Remaining physical hazards

The preview checks 2D point-link kinematics and rectangular character obstacles. It does **not** model link thickness, link-to-link contact, base collisions, wiring, flex, torque, inertia, temperature, payload, backlash, manufacturing tolerance or inter-mechanism swept volumes. The two mechanisms overlap in the drawing: design separated planes and verify spacers, shafts and payload clearance in CAD, or add a shared volume model. Sampling is not a proof of continuous collision freedom. Final trajectories need a controller-side certified/validated envelope or conservative continuous collision checks and measured margins.

A blocked geometric move faults immediately. Real stalled motors cannot be detected from simulated positions. The hardware controller must detect encoder following error/no progress, overcurrent and motion deadline expiry, latch a fault and stop **all coupled axes**. Do not retry a jam. Mechanical inspection and an explicit recovery decision are required.

## Required controller behavior before powered use

1. Power-up, reconnect, reset, watchdog expiry and brownout enter disabled/unhomed. Discard old commands. Never auto-resume.
2. Require a physical enable and guarded area. Provide a hardwired emergency stop and independent travel switches; remove energy or use drive safety functions as the mechanism risk requires. Hold/brake gravity-loaded axes safely.
3. Home with a bounded, slow, controller-owned sequence: switch plausibility, release if necessary, seek, backoff, repeatability verification and offset. Every phase has distance/time/current limits. Fault on missing or contradictory feedback.
4. Accept sequenced, expiring commands only while enabled and homed. Independently enforce calibrated angle, speed, acceleration, clearance and following-error limits. A UI reset can request state clearing, never assign an assumed measured position.
5. On fault: latch diagnostic code, axis, measured pose, target, current and timestamp; cancel queues, stop axes, require acknowledgement and inspect/rehome as needed. Acknowledge does not enable motion.
6. Recovery jogs require hold-to-run, reduced speed, verified clearance and a known pose. Unknown pose requires supervised rehoming; no blind straight-line return-to-home.

Acceptance tests and dependencies are tracked in the working plan. Hardware tests remain open until the actual machine is measured.

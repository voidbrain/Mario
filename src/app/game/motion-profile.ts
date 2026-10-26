/** Simulation assumptions only: one scene unit = 1 mm. Not measured hardware ratings. */
export const MOTION = Object.freeze({
  mmPerUnit: 1,
  stepSeconds: 1 / 120,
  watchdogSeconds: 0.25,
  marioSpeed: 60, // mm/s horizontal
  thwompSpeed: 40, // mm/s vertical
  verticalSpeed: 100, // mm/s jump and fall cap
  acceleration: 200, // mm/s² per Cartesian axis
  motorSpeed: Math.PI / 3, // 60 deg/s
  motorAcceleration: Math.PI, // 180 deg/s²
  jumpHeight: 150,
  pathResolution: 0.5, // scene units; sampled preview, not a collision proof
});

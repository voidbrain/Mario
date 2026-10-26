import { FiveBarActuator } from './five-bar-actuator';
import { normalizeAngle, overlap } from './geometry';
import { MOTION } from './motion-profile';
import { Character, FiveBarGeometry, Point, Rect } from './types';

export interface MotorVelocity { left: number; right: number }
export interface MotionCheck { ok: boolean; reason: string; velocity: MotorVelocity }

/** Common preview gate for autoplay, gameplay and manual target motion. */
export function checkMotion(
  actuator: FiveBarActuator, from: Character, to: Point, dt: number,
  previousVelocity: MotorVelocity, obstacles: readonly Rect[], previousCartesian: Point = { x: 0, y: 0 },
): MotionCheck {
  const fail = (reason: string): MotionCheck => ({ ok: false, reason, velocity: previousVelocity });
  if (![from.x, from.y, from.width, from.height, to.x, to.y, dt, previousVelocity.left, previousVelocity.right, previousCartesian.x, previousCartesian.y].every(Number.isFinite) || dt <= 0) return fail('Non-finite motion or invalid timestep');
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance > MOTION.verticalSpeed * Math.SQRT2 * dt + 1e-6) return fail('Cartesian speed exceeded');
  const cartesian = { x: (to.x - from.x) / dt, y: (to.y - from.y) / dt };
  if (Math.max(Math.abs(cartesian.x - previousCartesian.x), Math.abs(cartesian.y - previousCartesian.y)) / dt > MOTION.acceleration + 1e-5)
    return fail('Cartesian acceleration exceeded');
  const center = (p: Point): Point => ({ x: p.x + from.width / 2, y: p.y + from.height / 2 });
  let previous: FiveBarGeometry = actuator.calculate(center(from));
  if (!previous.valid) return fail('Current pose invalid; reset simulation or recalibrate');
  const samples = Math.max(1, Math.ceil(distance / MOTION.pathResolution));
  let leftTravel = 0;
  let rightTravel = 0;
  for (let i = 1; i <= samples; i++) {
    const p = { x: from.x + (to.x - from.x) * i / samples, y: from.y + (to.y - from.y) * i / samples };
    if (p.x < actuator.bounds.x || p.y < actuator.bounds.y ||
      p.x + from.width > actuator.bounds.x + actuator.bounds.width ||
      p.y + from.height > actuator.bounds.y + actuator.bounds.height) return fail('Character outside workspace');
    if (obstacles.some(o => overlap({ ...from, ...p }, o))) return fail('Path intersects obstacle');
    const geometry = actuator.calculate(center(p));
    if (!geometry.valid) return fail('Path reaches motor, workspace or singularity limit');
    const dl = normalizeAngle(geometry.leftMotorAngle - previous.leftMotorAngle);
    const dr = normalizeAngle(geometry.rightMotorAngle - previous.rightMotorAngle);
    if (Math.max(Math.abs(dl), Math.abs(dr)) / (dt / samples) > MOTION.motorSpeed) return fail('Motor speed exceeded');
    leftTravel += dl;
    rightTravel += dr;
    previous = geometry;
  }
  const velocity = { left: leftTravel / dt, right: rightTravel / dt };
  if (Math.max(Math.abs(velocity.left - previousVelocity.left), Math.abs(velocity.right - previousVelocity.right)) / dt > MOTION.motorAcceleration) return fail('Motor acceleration exceeded');
  return { ok: true, reason: '', velocity };
}

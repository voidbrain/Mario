import { angleInsideRange, normalizeAngle, pointInsideRect } from './geometry';
import { FiveBarConfig, FiveBarGeometry, Point, Rect } from './types';

export interface FiveBarMotorLimits {
  leftMin: number;
  leftMax: number;
  rightMin: number;
  rightMax: number;
}

export interface FiveBarPhysicalConfig extends FiveBarConfig {
  motorLimits?: FiveBarMotorLimits;

  /*
   * Minimum allowed absolute sine of the angle
   * between the upper and lower link.
   *
   * 0    = exact singularity
   * 0.05 = close to singularity
   * 0.10 = more conservative
   */
  singularityMargin?: number;
}

export interface JointSolution {
  point: Point;
  angle: number;
  valid: boolean;
}

export function calculateFiveBar(
  config: FiveBarPhysicalConfig,
  target: Point,
  jointBounds: Rect,
  elbowUp = false,
): FiveBarGeometry {
  const left = solveTwoLink(config.baseLeft, target, config.upperArm, config.lowerArm, elbowUp);
  const right = solveTwoLink(config.baseRight, target, config.upperArm, config.lowerArm, !elbowUp);
  const leftJointInside = pointInsideRect(left.point, jointBounds);
  const rightJointInside = pointInsideRect(right.point, jointBounds);
  const limits = config.motorLimits;

  const leftAngleValid =
    limits === undefined || angleInsideRange(left.angle, limits.leftMin, limits.leftMax);
  const rightAngleValid =
    limits === undefined || angleInsideRange(right.angle, limits.rightMin, limits.rightMax);

  /*
   * Physical singularity detection.
   *
   * A two-link arm becomes singular when the upper
   * and lower links are approximately collinear.
   */

  const leftSingularity = isSingular(left, target, config.singularityMargin ?? 0.1);
  const rightSingularity = isSingular(right, target, config.singularityMargin ?? 0.1);

  const finiteConfig = [config.baseLeft.x, config.baseLeft.y, config.baseRight.x,
    config.baseRight.y, config.upperArm, config.lowerArm, config.singularityMargin ?? 0.1]
    .every(Number.isFinite) && config.upperArm > 0 && config.lowerArm > 0 &&
    (config.singularityMargin ?? 0.1) > 0 && (config.singularityMargin ?? 0.1) < 1;
  // Parallel singularity: the two distal links must not become collinear either.
  const distalCross = Math.abs(
    (target.x - left.point.x) * (target.y - right.point.y) -
    (target.y - left.point.y) * (target.x - right.point.x)
  ) / (config.lowerArm * config.lowerArm);

  return {
    baseLeft: config.baseLeft,
    baseRight: config.baseRight,
    leftJoint: left.point,
    rightJoint: right.point,
    effector: target,
    leftMotorAngle: left.angle,
    rightMotorAngle: right.angle,

    valid:
      finiteConfig &&
      distalCross >= (config.singularityMargin ?? 0.1) &&
      left.valid &&
      right.valid &&
      leftJointInside &&
      rightJointInside &&
      leftAngleValid &&
      rightAngleValid &&
      !leftSingularity &&
      !rightSingularity,
  };
}

function solveTwoLink(
  base: Point,
  target: Point,
  upperArm: number,
  lowerArm: number,
  elbowUp: boolean,
): JointSolution {
  const dx = target.x - base.x;

  const dy = target.y - base.y;

  const distance = Math.hypot(dx, dy);

  /*
   * Target is too close to the motor.
   *
   * Do NOT clamp it.
   */

  const minReach = Math.abs(upperArm - lowerArm);

  /*
   * Maximum physical reach.
   */

  const maxReach = upperArm + lowerArm;

  if (distance < minReach || distance > maxReach || distance < 0.000001) {
    return {
      point: {
        x: base.x,
        y: base.y,
      },

      angle: 0,

      valid: false,
    };
  }

  const direction = Math.atan2(dy, dx);

  const cosOffset =
    (upperArm * upperArm + distance * distance - lowerArm * lowerArm) / (2 * upperArm * distance);

  const offset = Math.acos(Math.max(-1, Math.min(1, cosOffset)));

  const angle = elbowUp ? direction - offset : direction + offset;

  const joint: Point = {
    x: base.x + Math.cos(angle) * upperArm,

    y: base.y + Math.sin(angle) * upperArm,
  };

  /*
   * Verify the second link actually reaches
   * the target.
   */

  const secondLinkDistance = Math.hypot(target.x - joint.x, target.y - joint.y);

  const tolerance = 0.0001;

  const valid = Math.abs(secondLinkDistance - lowerArm) <= tolerance;

  return {
    point: joint,

    angle,

    valid,
  };
}

function isSingular(joint: JointSolution, target: Point, margin?: number): boolean {
  if (margin === undefined || margin <= 0 || !joint.valid) {
    return false;
  }

  /*
   * Vector from base -> joint is represented by
   * joint.angle.
   *
   * Vector joint -> target is the second link.
   */

  const secondAngle = Math.atan2(target.y - joint.point.y, target.x - joint.point.x);

  const relativeAngle = normalizeAngle(secondAngle - joint.angle);

  /*
   * sin(relativeAngle) approaches zero when
   * the two links become collinear.
   */

  return Math.abs(Math.sin(relativeAngle)) < margin;
}

import {
  FiveBarConfig,
  FiveBarGeometry,
  Point,
  Rect,
} from './types';


export interface FiveBarMotorLimits {
  leftMin: number;
  leftMax: number;

  rightMin: number;
  rightMax: number;
}


export interface FiveBarPhysicalConfig
  extends FiveBarConfig {

  motorLimits?: FiveBarMotorLimits;

  /*
   * Minimum allowed absolute cosine of the angle
   * between the two links at each elbow.
   *
   * 0   = allow 90 degrees and everything farther away.
   * 1   = extremely restrictive.
   *
   * Keeping this around 0.05-0.15 is usually a useful
   * starting point for a physical mechanism.
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

  const left =
    solveTwoLink(
      config.baseLeft,
      target,
      config.upperArm,
      config.lowerArm,
      elbowUp,
    );


  const right =
    solveTwoLink(
      config.baseRight,
      target,
      config.upperArm,
      config.lowerArm,
      !elbowUp,
    );


  const leftJointInside =
    pointInsideRect(
      left.point,
      jointBounds,
    );


  const rightJointInside =
    pointInsideRect(
      right.point,
      jointBounds,
    );


  const limits =
    config.motorLimits;


  const leftAngleValid =
    limits === undefined ||
    angleInsideRange(
      left.angle,
      limits.leftMin,
      limits.leftMax,
    );


  const rightAngleValid =
    limits === undefined ||
    angleInsideRange(
      right.angle,
      limits.rightMin,
      limits.rightMax,
    );


  return {

    baseLeft:
      config.baseLeft,

    baseRight:
      config.baseRight,

    leftJoint:
      left.point,

    rightJoint:
      right.point,

    effector:
      target,

    leftMotorAngle:
      left.angle,

    rightMotorAngle:
      right.angle,

    valid:
      left.valid &&
      right.valid &&
      leftJointInside &&
      rightJointInside &&
      leftAngleValid &&
      rightAngleValid,
  };
}


function solveTwoLink(
  base: Point,
  target: Point,
  upperArm: number,
  lowerArm: number,
  elbowUp: boolean,
): JointSolution {

  const dx =
    target.x -
    base.x;

  const dy =
    target.y -
    base.y;


  const distance =
    Math.hypot(
      dx,
      dy,
    );


  /*
   * Target is too close to the motor.
   *
   * Do NOT clamp it.
   *
   * A real mechanism cannot magically reach it.
   */
  const minReach =
    Math.abs(
      upperArm -
      lowerArm,
    );


  /*
   * Maximum physical reach.
   */
  const maxReach =
    upperArm +
    lowerArm;


  if (
    distance < minReach ||
    distance > maxReach ||
    distance < 0.000001
  ) {

    return {

      point: {
        x: base.x,
        y: base.y,
      },

      angle: 0,

      valid: false,
    };
  }


  const direction =
    Math.atan2(
      dy,
      dx,
    );


  /*
   * Law of cosines.
   *
   * upperArm^2 + distance^2
   * --------------------------------
   *       2 * upperArm * distance
   */
  const cosOffset =
    (
      upperArm * upperArm +
      distance * distance -
      lowerArm * lowerArm
    ) /
    (
      2 *
      upperArm *
      distance
    );


  /*
   * Numerical protection only.
   *
   * This does NOT change the target distance.
   */
  const offset =
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          cosOffset,
        ),
      ),
    );


  const angle =
    elbowUp
      ? direction - offset
      : direction + offset;


  const joint: Point = {

    x:
      base.x +
      Math.cos(angle) *
      upperArm,

    y:
      base.y +
      Math.sin(angle) *
      upperArm,
  };


  /*
   * Verify the second link actually reaches
   * the target after calculating the elbow.
   *
   * This protects against numerical problems and
   * makes the returned configuration physically honest.
   */
  const secondLinkDistance =
    Math.hypot(
      target.x - joint.x,
      target.y - joint.y,
    );


  const tolerance =
    0.0001;


  const valid =
    Math.abs(
      secondLinkDistance -
      lowerArm,
    ) <= tolerance;


  return {

    point:
      joint,

    angle,

    valid,
  };
}


function pointInsideRect(
  point: Point,
  rect: Rect,
): boolean {

  return (

    point.x >= rect.x &&

    point.x <=
      rect.x +
      rect.width &&

    point.y >= rect.y &&

    point.y <=
      rect.y +
      rect.height
  );
}


/*
 * Handles normal angular ranges.
 *
 * Example:
 *
 * -90 -> +90
 *
 * Also supports wrapped ranges such as:
 *
 * 170 -> -170
 */
function angleInsideRange(
  angle: number,
  min: number,
  max: number,
): boolean {

  const a =
    normalizeAngle(angle);

  const lo =
    normalizeAngle(min);

  const hi =
    normalizeAngle(max);


  if (lo <= hi) {

    return (
      a >= lo &&
      a <= hi
    );
  }


  /*
   * Wrapped interval.
   *
   * Example:
   *
   * 170 -> -170
   *
   * means:
   *
   * 170 ... 180 ... -180 ... -170
   */
  return (
    a >= lo ||
    a <= hi
  );
}


function normalizeAngle(
  angle: number,
): number {

  let result =
    angle % (Math.PI * 2);


  if (result > Math.PI) {
    result -= Math.PI * 2;
  }


  if (result < -Math.PI) {
    result += Math.PI * 2;
  }


  return result;
}

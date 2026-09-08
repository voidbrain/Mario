import {
  FiveBarConfig,
  FiveBarGeometry,
  Point,
  Rect,
  PhysicalLimit,
  PhysicalLimitNode,
} from './types';

import { calculateFiveBar, FiveBarMotorLimits } from './five-bar';

export interface FiveBarActuatorParams {
  upperArm: number;

  lowerArm: number;

  baseLeft: Point;

  baseRight: Point;

  /*
   * Physical motor limits in radians.
   */

  motorLimits?: FiveBarMotorLimits;

  /*
   * Minimum allowed distance from a singular
   * linkage configuration.
   */

  singularityMargin?: number;
}

export class FiveBarActuator {
  readonly bounds: Rect;
  readonly jointBounds: Rect;
  readonly params: FiveBarActuatorParams;

  constructor(bounds: Rect, jointBounds: Rect, params: FiveBarActuatorParams) {
    this.bounds = bounds;
    this.jointBounds = jointBounds;
    this.params = params;
  }

  calculate(effector: Point): FiveBarGeometry {
    const config: FiveBarConfig & {
      motorLimits?: FiveBarMotorLimits;
      singularityMargin?: number;
    } = {
      baseLeft: this.params.baseLeft,
      baseRight: this.params.baseRight,
      upperArm: this.params.upperArm,
      lowerArm: this.params.lowerArm,
      motorLimits: this.params.motorLimits,
      singularityMargin: this.params.singularityMargin,
    };

    const geometry = calculateFiveBar(config, effector, this.jointBounds, false);

    /*
     * The effector itself must remain inside
     * the permitted actuator workspace.
     */

    const effectorInside = pointInsideRect(effector, this.bounds);

    return {
      ...geometry,

      valid: effectorInside && geometry.valid,
    };
  }

  physicalLimits(geometry: FiveBarGeometry): PhysicalLimit {
    const left = this.calculateNodeLimit(
      geometry.leftJoint,
      geometry.leftMotorAngle,
      this.params.motorLimits?.leftMin,
      this.params.motorLimits?.leftMax,
      geometry.baseLeft,
      geometry.effector,
    );

    const right = this.calculateNodeLimit(
      geometry.rightJoint,
      geometry.rightMotorAngle,
      this.params.motorLimits?.rightMin,
      this.params.motorLimits?.rightMax,
      geometry.baseRight,
      geometry.effector,
    );

    return {
      invalid: !geometry.valid || this.hasNodeLimit(left) || this.hasNodeLimit(right),
      left,
      right,
    };
  }

  private calculateNodeLimit(
    joint: Point,
    motorAngle: number,
    motorMin: number | undefined,
    motorMax: number | undefined,
    base: Point,
    effector: Point,
  ): PhysicalLimitNode {
    const north = joint.y < this.jointBounds.y;
    const south = joint.y > this.jointBounds.y + this.jointBounds.height;
    const west = joint.x < this.jointBounds.x;
    const east = joint.x > this.jointBounds.x + this.jointBounds.width;

    const motor =
      motorMin !== undefined &&
      motorMax !== undefined &&
      !angleInsideRange(motorAngle, motorMin, motorMax);

    const singularity = this.isSingularity(joint, effector, base);

    return {
      north,
      south,
      west,
      east,
      motor,
      singularity,
    };
  }

  private isSingularity(joint: Point, effector: Point, base: Point): boolean {
    const margin = this.params.singularityMargin;

    if (margin === undefined || margin <= 0) {
      return false;
    }

    const firstAngle = Math.atan2(joint.y - base.y, joint.x - base.x);

    const secondAngle = Math.atan2(effector.y - joint.y, effector.x - joint.x);

    const relativeAngle = normalizeAngle(secondAngle - firstAngle);

    return Math.abs(Math.sin(relativeAngle)) < margin;
  }

  private hasNodeLimit(node: PhysicalLimitNode): boolean {
    return node.north || node.south || node.west || node.east || node.motor || node.singularity;
  }
}

function pointInsideRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function angleInsideRange(angle: number, min: number, max: number): boolean {
  const a = normalizeAngle(angle);

  const lo = normalizeAngle(min);

  const hi = normalizeAngle(max);

  if (lo <= hi) {
    return a >= lo && a <= hi;
  }

  return a >= lo || a <= hi;
}

function normalizeAngle(angle: number): number {
  let result = angle % (Math.PI * 2);

  if (result > Math.PI) {
    result -= Math.PI * 2;
  }

  if (result < -Math.PI) {
    result += Math.PI * 2;
  }

  return result;
}

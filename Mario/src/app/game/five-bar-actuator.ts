import {
  FiveBarConfig,
  FiveBarGeometry,
  Point,
  Rect,
} from './types';

import {
  calculateFiveBar,
  FiveBarMotorLimits,
} from './five-bar';


export interface FiveBarActuatorParams {

  upperArm: number;

  lowerArm: number;

  baseLeft: Point;

  baseRight: Point;

  /*
   * Physical motor limits in radians.
   *
   * Example:
   *
   * -Math.PI / 2
   * +Math.PI / 2
   */
  motorLimits?: FiveBarMotorLimits;

  /*
   * Reserved for additional physical
   * safety restrictions.
   */
  singularityMargin?: number;
}


export class FiveBarActuator {

  readonly bounds: Rect;

  readonly jointBounds: Rect;

  readonly params: FiveBarActuatorParams;


  constructor(
    bounds: Rect,
    jointBounds: Rect,
    params: FiveBarActuatorParams,
  ) {

    this.bounds =
      bounds;

    this.jointBounds =
      jointBounds;

    this.params =
      params;
  }


  calculate(
    effector: Point,
  ): FiveBarGeometry {

    const config:
      FiveBarConfig & {
        motorLimits?: FiveBarMotorLimits;
        singularityMargin?: number;
      } = {

      baseLeft:
        this.params.baseLeft,

      baseRight:
        this.params.baseRight,

      upperArm:
        this.params.upperArm,

      lowerArm:
        this.params.lowerArm,

      motorLimits:
        this.params.motorLimits,

      singularityMargin:
        this.params.singularityMargin,
    };


    const geometry =
      calculateFiveBar(
        config,
        effector,
        this.jointBounds,
        false,
      );


    /*
     * The effector itself must also remain inside
     * the permitted actuator workspace.
     */
    const effectorInside =
      pointInsideRect(
        effector,
        this.bounds,
      );


    return {

      ...geometry,

      valid:
        effectorInside &&
        geometry.valid,
    };
  }
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

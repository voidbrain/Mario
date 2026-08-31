import {
  FiveBarConfig,
  FiveBarGeometry,
  Point,
  Rect,
} from './types';

import {
  calculateFiveBar,
} from './five-bar';


export interface FiveBarActuatorParams {

  upperArm: number;

  lowerArm: number;

  baseLeft: Point;

  baseRight: Point;
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
      FiveBarConfig = {

      baseLeft:
        this.params.baseLeft,

      baseRight:
        this.params.baseRight,

      upperArm:
        this.params.upperArm,

      lowerArm:
        this.params.lowerArm,
    };


    const geometry =
      calculateFiveBar(
        config,
        effector,
        this.jointBounds,
        false,
      );


    return {

      ...geometry,

      valid:
        pointInsideRect(
          effector,
          this.bounds,
        ) &&
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

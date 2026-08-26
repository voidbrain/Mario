import {
  FiveBarConfig,
  FiveBarGeometry,
  Point,
  Rect,
} from './types';

import {
  calculateFiveBar,
} from './five-bar';


export interface DoubleFiveBarGeometry {

  upper: FiveBarGeometry;

  lower: FiveBarGeometry;

  effector: Point;

  valid: boolean;
}


export class DoubleFiveBar {

  readonly bounds: Rect;

  readonly jointBounds: Rect;


  /*
   * ============================================================
   * UPPER FIVE-BAR
   * ============================================================
   */

  readonly upperConfig: FiveBarConfig = {

    baseLeft: {
      x: 80,
      y: 80,
    },

    baseRight: {
      x: 520,
      y: 80,
    },

    upperArm: 220,

    lowerArm: 220,
  };


  /*
   * ============================================================
   * LOWER FIVE-BAR
   * ============================================================
   */

  readonly lowerConfig: FiveBarConfig = {

    baseLeft: {
      x: 80,
      y: 420,
    },

    baseRight: {
      x: 520,
      y: 420,
    },

    upperArm: 220,

    lowerArm: 220,
  };


  constructor(
    bounds: Rect,
    jointBounds: Rect,
  ) {

    this.bounds =
      bounds;

    this.jointBounds =
      jointBounds;
  }


  calculate(
    effector: Point,
  ): DoubleFiveBarGeometry {

    const effectorInside =
      pointInsideRect(
        effector,
        this.bounds,
      );


    const upper =
      calculateFiveBar(
        this.upperConfig,
        effector,
        this.jointBounds,
        false,
      );


    const lower =
      calculateFiveBar(
        this.lowerConfig,
        effector,
        this.jointBounds,
        true,
      );


    return {

      upper,

      lower,

      effector,

      valid:
        effectorInside &&
        upper.valid &&
        lower.valid,
    };
  }
}


function pointInsideRect(
  point: Point,
  rect: Rect,
): boolean {

  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

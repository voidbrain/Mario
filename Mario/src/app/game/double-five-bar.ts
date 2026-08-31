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


export interface DoubleFiveBarParams {

  upperArm: number;

  lowerArm: number;

  upperBaseLeft: Point;

  upperBaseRight: Point;

  lowerBaseLeft: Point;

  lowerBaseRight: Point;
}


export class DoubleFiveBar {

  readonly bounds: Rect;

  readonly jointBounds: Rect;

  readonly params: DoubleFiveBarParams;


  constructor(
    bounds: Rect,
    jointBounds: Rect,
    params?: Partial<DoubleFiveBarParams>,
  ) {

    this.bounds =
      bounds;

    this.jointBounds =
      jointBounds;


    this.params = {

      upperArm:
        params?.upperArm ??
        220,

      lowerArm:
        params?.lowerArm ??
        220,

      upperBaseLeft:
        params?.upperBaseLeft ??
        {
          x: bounds.x + 40,
          y: bounds.y,
        },

      upperBaseRight:
        params?.upperBaseRight ??
        {
          x:
            bounds.x +
            bounds.width -
            40,

          y:
            bounds.y,
        },

      lowerBaseLeft:
        params?.lowerBaseLeft ??
        {
          x: bounds.x + 40,

          y:
            bounds.y +
            bounds.height,
        },

      lowerBaseRight:
        params?.lowerBaseRight ??
        {
          x:
            bounds.x +
            bounds.width -
            40,

          y:
            bounds.y +
            bounds.height,
        },
    };
  }


  calculate(
    effector: Point,
  ): DoubleFiveBarGeometry {

    const upperConfig:
      FiveBarConfig = {

      baseLeft:
        this.params.upperBaseLeft,

      baseRight:
        this.params.upperBaseRight,

      upperArm:
        this.params.upperArm,

      lowerArm:
        this.params.lowerArm,
    };


    const lowerConfig:
      FiveBarConfig = {

      baseLeft:
        this.params.lowerBaseLeft,

      baseRight:
        this.params.lowerBaseRight,

      upperArm:
        this.params.upperArm,

      lowerArm:
        this.params.lowerArm,
    };


    const upper =
      calculateFiveBar(
        upperConfig,
        effector,
        this.jointBounds,
        false,
      );


    const lower =
      calculateFiveBar(
        lowerConfig,
        effector,
        this.jointBounds,
        true,
      );


    return {

      upper,

      lower,

      effector,

      valid:
        pointInsideRect(
          effector,
          this.bounds,
        ) &&
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

    point.x <=
      rect.x +
      rect.width &&

    point.y >= rect.y &&

    point.y <=
      rect.y +
      rect.height
  );
}

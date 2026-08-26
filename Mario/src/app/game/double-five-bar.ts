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

  /*
   * Back-compat alias so views and callers that
   * still look up the old single envelope property
   * continue to work.
   */

  readonly bounds: Rect;


  /*
   * Maximum freedom of movement for this
   * complete double 5-bar.
   *
   * The rectangle is a constraint/envelope
   * for the effector. It does NOT move the
   * effector.
   */

  readonly effectorBounds: Rect;


  /*
   * Boundary for the passive joints.
   * Optional: if omitted we do not enforce an
   * extra passive-joint rectangle, preserving
   * the prior fluid mechanics behaviour.
   */

  readonly jointBounds?: Rect;


  /*
   * Upper 5-bar
   */

  private readonly upperConfig:
    FiveBarConfig = {

    baseLeft: {
      x: 80,
      y: 80,
    },

    baseRight: {
      x: 520,
      y: 80,
    },

    upperArm: 420,

    lowerArm: 420,
  };


  /*
   * Lower 5-bar
   */

  private readonly lowerConfig:
    FiveBarConfig = {

    baseLeft: {
      x: 80,
      y: 820,
    },

    baseRight: {
      x: 520,
      y: 820,
    },

    upperArm: 420,

    lowerArm: 420,
  };


  constructor(
    effectorBounds: Rect,
    jointBounds?: Rect,
  ) {

    this.effectorBounds =
      effectorBounds;

    this.jointBounds =
      jointBounds;

    this.bounds =
      effectorBounds;
  }


  calculate(
    effector: Point,
  ): DoubleFiveBarGeometry {

    const upper =
      calculateFiveBar(
        this.upperConfig,
        effector,
        this.effectorBounds,
        this.jointBounds,
      );


    const lower =
      calculateFiveBar(
        this.lowerConfig,
        effector,
        this.effectorBounds,
        this.jointBounds,
      );


    return {

      upper,

      lower,

      effector,

      valid:
        upper.valid &&
        lower.valid,
    };
  }
}
// import {
//   FiveBarConfig,
//   FiveBarGeometry,
//   Point,
//   Rect,
// } from './types';

// import {
//   calculateFiveBar,
// } from './five-bar';


// export interface DoubleFiveBarGeometry {

//   upper: FiveBarGeometry;

//   lower: FiveBarGeometry;

//   effector: Point;

//   valid: boolean;
// }


// export class DoubleFiveBar {

//   /*
//    * ----------------------------------------------------------
//    * EFFECTOR BOUNDARY
//    * ----------------------------------------------------------
//    *
//    * This is the rectangle you already had around M/T.
//    */

//   readonly effectorBounds: Rect;


//   /*
//    * ----------------------------------------------------------
//    * PASSIVE JOINT BOUNDARY
//    * ----------------------------------------------------------
//    *
//    * Separate boundary for the two passive joints.
//    *
//    * Adjust this independently from the M/T rectangle.
//    */

//   readonly jointBounds: Rect;


//   /*
//    * ----------------------------------------------------------
//    * UPPER 5-BAR
//    * ----------------------------------------------------------
//    */

//   private readonly upperConfig:
//     FiveBarConfig = {

//     baseLeft: {
//       x: 80,
//       y: 80,
//     },

//     baseRight: {
//       x: 520,
//       y: 80,
//     },

//     upperArm: 420,

//     lowerArm: 420,
//   };


//   /*
//    * ----------------------------------------------------------
//    * LOWER 5-BAR
//    * ----------------------------------------------------------
//    */

//   private readonly lowerConfig:
//     FiveBarConfig = {

//     baseLeft: {
//       x: 80,
//       y: 820,
//     },

//     baseRight: {
//       x: 520,
//       y: 820,
//     },

//     upperArm: 420,

//     lowerArm: 420,
//   };


//   constructor(
//     effectorBounds: Rect,
//     jointBounds: Rect,
//   ) {

//     this.effectorBounds =
//       effectorBounds;

//     this.jointBounds =
//       jointBounds;
//   }


//   calculate(
//     effector: Point,
//   ): DoubleFiveBarGeometry {

//     const upper =
//       calculateFiveBar(

//         this.upperConfig,

//         effector,

//         this.effectorBounds,

//         this.jointBounds,
//       );


//     const lower =
//       calculateFiveBar(

//         this.lowerConfig,

//         effector,

//         this.effectorBounds,

//         this.jointBounds,
//       );


//     return {

//       upper,

//       lower,

//       effector,

//       valid:
//         upper.valid &&
//         lower.valid,
//     };
//   }
// }

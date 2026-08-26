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
   * Maximum freedom of movement for this
   * complete double 5-bar.
   *
   * The rectangle is a constraint/envelope.
   * It does NOT move the effector.
   */

  readonly bounds: Rect;


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
    bounds: Rect,
  ) {

    this.bounds = bounds;
  }


  calculate(
    effector: Point,
  ): DoubleFiveBarGeometry {

    const upper =
      calculateFiveBar(
        this.upperConfig,
        effector,
        this.bounds,
      );


    const lower =
      calculateFiveBar(
        this.lowerConfig,
        effector,
        this.bounds,
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

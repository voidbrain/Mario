import {
  FiveBarConfig,
  FiveBarGeometry,
  Point,
  Rect,
} from './types';


export function calculateFiveBar(
  config: FiveBarConfig,
  target: Point,
  effectorBounds?: Rect,
  jointBounds?: Rect,
): FiveBarGeometry {

  const left =
    solveTwoLink(
      config.baseLeft,
      target,
      config.upperArm,
      config.lowerArm,
      false,
    );


  const right =
    solveTwoLink(
      config.baseRight,
      target,
      config.upperArm,
      config.lowerArm,
      true,
    );


  /*
   * Mechanism must be physically reachable.
   */

  const kinematicallyValid =
    left.valid &&
    right.valid;


  /*
   * Effector constraint.
   */

  const effectorValid =
    effectorBounds === undefined ||
    pointInsideRect(
      target,
      effectorBounds,
    );


  /*
   * Passive-joint constraints.
   */

  const leftJointValid =
    jointBounds === undefined ||
    pointInsideRect(
      left.point,
      jointBounds,
    );


  const rightJointValid =
    jointBounds === undefined ||
    pointInsideRect(
      right.point,
      jointBounds,
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

    valid:
      kinematicallyValid &&
      effectorValid &&
      leftJointValid &&
      rightJointValid,
  };
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


interface JointSolution {

  point: Point;

  valid: boolean;
}


function solveTwoLink(
  base: Point,
  target: Point,
  upperArm: number,
  lowerArm: number,
  mirrored: boolean,
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


  const maxReach =
    upperArm +
    lowerArm;


  const minReach =
    Math.abs(
      upperArm -
      lowerArm,
    );


  const valid =
    distance >= minReach &&
    distance <= maxReach;


  /*
   * Clamp only the calculation used to draw
   * the links. It does NOT change validity.
   */

  const d =
    Math.max(
      minReach + 0.001,
      Math.min(
        maxReach - 0.001,
        distance,
      ),
    );


  const direction =
    Math.atan2(
      dy,
      dx,
    );


  const cosElbow =
    (
      upperArm * upperArm +
      d * d -
      lowerArm * lowerArm
    ) /
    (
      2 *
      upperArm *
      d
    );


  const elbowOffset =
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          cosElbow,
        ),
      ),
    );


  const angle =
    mirrored
      ? direction - elbowOffset
      : direction + elbowOffset;


  return {

    point: {

      x:
        base.x +
        Math.cos(angle) *
        upperArm,

      y:
        base.y +
        Math.sin(angle) *
        upperArm,
    },

    valid,
  };
}
// import {
//   FiveBarConfig,
//   FiveBarGeometry,
//   Point,
//   Rect,
// } from './types';


// export function calculateFiveBar(
//   config: FiveBarConfig,
//   target: Point,
//   effectorBounds: Rect,
//   jointBounds: Rect,
// ): FiveBarGeometry {

//   const left =
//     solveTwoLink(
//       config.baseLeft,
//       target,
//       config.upperArm,
//       config.lowerArm,
//       false,
//     );


//   const right =
//     solveTwoLink(
//       config.baseRight,
//       target,
//       config.upperArm,
//       config.lowerArm,
//       true,
//     );


//   /*
//    * The mechanism must be physically reachable.
//    */

//   const kinematicallyValid =
//     left.valid &&
//     right.valid;


//   /*
//    * Effector constraint.
//    */

//   const effectorValid =
//     pointInsideRect(
//       target,
//       effectorBounds,
//     );


//   /*
//    * Passive-joint constraints.
//    */

//   const leftJointValid =
//     pointInsideRect(
//       left.point,
//       jointBounds,
//     );


//   const rightJointValid =
//     pointInsideRect(
//       right.point,
//       jointBounds,
//     );


//   return {

//     baseLeft:
//       config.baseLeft,

//     baseRight:
//       config.baseRight,

//     leftJoint:
//       left.point,

//     rightJoint:
//       right.point,

//     effector:
//       target,

//     valid:
//       kinematicallyValid &&

//       effectorValid &&

//       leftJointValid &&

//       rightJointValid,
//   };
// }


// function pointInsideRect(
//   point: Point,
//   rect: Rect,
// ): boolean {

//   return (

//     point.x >= rect.x &&

//     point.x <=
//       rect.x + rect.width &&

//     point.y >= rect.y &&

//     point.y <=
//       rect.y + rect.height
//   );
// }


// interface JointSolution {

//   point: Point;

//   valid: boolean;
// }


// function solveTwoLink(
//   base: Point,
//   target: Point,
//   upperArm: number,
//   lowerArm: number,
//   mirrored: boolean,
// ): JointSolution {

//   const dx =
//     target.x -
//     base.x;


//   const dy =
//     target.y -
//     base.y;


//   const distance =
//     Math.hypot(
//       dx,
//       dy,
//     );


//   const maxReach =
//     upperArm +
//     lowerArm;


//   const minReach =
//     Math.abs(
//       upperArm -
//       lowerArm,
//     );


//   const valid =
//     distance >= minReach &&
//     distance <= maxReach;


//   /*
//    * Clamp only the IK calculation so that
//    * an unreachable target does not generate NaN.
//    */

//   const d =
//     Math.max(

//       minReach + 0.001,

//       Math.min(
//         maxReach - 0.001,
//         distance,
//       ),
//     );


//   const direction =
//     Math.atan2(
//       dy,
//       dx,
//     );


//   const cosElbow =
//     (
//       upperArm * upperArm +

//       d * d -

//       lowerArm * lowerArm
//     )

//     /

//     (
//       2 *

//       upperArm *

//       d
//     );


//   const elbowOffset =
//     Math.acos(

//       Math.max(

//         -1,

//         Math.min(
//           1,
//           cosElbow,
//         ),
//       ),
//     );


//   const angle =
//     mirrored

//       ?

//       direction -
//       elbowOffset

//       :

//       direction +
//       elbowOffset;


//   return {

//     point: {

//       x:
//         base.x +

//         Math.cos(angle) *

//         upperArm,

//       y:
//         base.y +

//         Math.sin(angle) *

//         upperArm,
//     },

//     valid,
//   };
// }

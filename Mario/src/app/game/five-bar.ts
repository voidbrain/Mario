import {
  FiveBarConfig,
  FiveBarGeometry,
  Point,
  Rect,
} from './types';


export function calculateFiveBar(
  config: FiveBarConfig,
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
      false,
      elbowUp,
    );


  const right =
    solveTwoLink(
      config.baseRight,
      target,
      config.upperArm,
      config.lowerArm,
      true,
      elbowUp,
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
      left.valid &&
      right.valid &&
      leftJointInside &&
      rightJointInside,
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


  const maxReach =
    upperArm +
    lowerArm;


  const minReach =
    Math.abs(
      upperArm -
      lowerArm,
    );


  /*
   * ============================================================
   * UNREACHABLE: TOO FAR
   * ============================================================
   *
   * IMPORTANT:
   *
   * Do NOT put the passive joint at maxReach.
   *
   * The passive joint belongs to the FIRST arm, therefore its
   * distance from the base must NEVER exceed upperArm.
   *
   * The returned point is only a diagnostic point because
   * valid = false.
   */

  if (
    distance >
    maxReach
  ) {

    if (
      distance <
      0.000001
    ) {

      return {
        point: {
          x:
            base.x +
            upperArm,

          y:
            base.y,
        },

        valid: false,
      };
    }


    const scale =
      upperArm /
      distance;


    return {

      point: {

        x:
          base.x +
          dx *
          scale,

        y:
          base.y +
          dy *
          scale,
      },

      valid: false,
    };
  }


  /*
   * ============================================================
   * UNREACHABLE: TOO CLOSE
   * ============================================================
   */

  if (
    distance <
    minReach
  ) {

    /*
     * Equal-length arms have minReach = 0, so this normally
     * only matters for a different arm configuration.
     */

    if (
      distance <
      0.000001
    ) {

      return {

        point: {

          x:
            base.x +
            (
              mirrored
                ? -upperArm
                : upperArm
            ),

          y:
            base.y,
        },

        valid: false,
      };
    }


    const scale =
      minReach /
      distance;


    /*
     * Keep the passive joint exactly upperArm away from the
     * base while reporting the configuration as invalid.
     *
     * This point is diagnostic only.
     */

    const direction =
      Math.atan2(
        dy,
        dx,
      );


    const angle =
      mirrored
        ? direction + Math.PI
        : direction;


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

      valid: false,
    };
  }


  /*
   * ============================================================
   * NORMAL TWO-LINK IK
   * ============================================================
   */

  const direction =
    Math.atan2(
      dy,
      dx,
    );


  const cosAngle =
    (
      upperArm *
      upperArm +

      distance *
      distance -

      lowerArm *
      lowerArm
    ) /
    (
      2 *
      upperArm *
      distance
    );


  const offset =
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          cosAngle,
        ),
      ),
    );


  let angle: number;


  if (!elbowUp) {

    angle =
      mirrored
        ? direction - offset
        : direction + offset;

  } else {

    angle =
      mirrored
        ? direction + offset
        : direction - offset;
  }


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

    valid: true,
  };
}

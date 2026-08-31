import {
  Character,
  GameState,
  InputState,
  Rect,
  FiveBarGeometry,
} from './types';

import {
  FiveBarActuator,
} from './five-bar-actuator';


export class GameEngine {

  readonly state: GameState = {

    width: 520,
    height: 600,
    status: 'ready',

    mario: {
      id: 'mario',
      x: 10,
      y: 380,
      width: 34,
      height: 48,
    },

    thwomp: {
      id: 'thwomp',
      x: 390,
      y: 120,
      width: 80,
      height: 80,
    },
  };


  /*
   * ============================================================
   * OBSTACLES
   * ============================================================
   */

  readonly obstacles: Rect[] = [
    {
      x: 170,
      y: 350,
      width: 70,
      height: 30,
    },

    {
      x: 300,
      y: 320,
      width: 90,
      height: 52,
    },

    {
      x: 410,
      y: 350,
      width: 70,
      height: 30,
    },
  ];


  /*
   * ============================================================
   * WORLD
   * ============================================================
   */

  private readonly groundTop = 428;

  private readonly groundY =
    this.groundTop -
    this.state.mario.height;


  /*
   * ============================================================
   * BOUNDS
   * ============================================================
   */

  readonly characterBounds: Rect = {
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  };

  readonly jointBounds: Rect = {
    x: -150,
    y: -200,
    width: 1100,
    height: 950,
  };

  readonly marioBounds: Rect = {
    ...this.characterBounds,
  };

  readonly marioJointBounds: Rect = {
    ...this.jointBounds,
  };

  readonly thwompBounds: Rect = {
    ...this.characterBounds,
  };

  readonly thwompJointBounds: Rect = {
    ...this.jointBounds,
  };


  /*
   * ============================================================
   * MARIO 5-BAR
   * ============================================================
   */

  readonly marioActuator =
    new FiveBarActuator(
      this.marioBounds,
      this.marioJointBounds,
      {
        upperArm: 220,
        lowerArm: 220,

        baseLeft: {
          x: 90,
          y: 300,
        },

        baseRight: {
          x: 450,
          y: 300,
        },
      },
    );


  /*
   * ============================================================
   * THWOMP 5-BAR
   * ============================================================
   */

  readonly thwompActuator =
    new FiveBarActuator(
      this.thwompBounds,
      this.thwompJointBounds,
      {
        upperArm: 190,
        lowerArm: 190,

        baseLeft: {
          x: 80,
          y: 300,
        },

        baseRight: {
          x: 360,
          y: 300,
        },
      },
    );


  marioMechanism:
    FiveBarGeometry;

  thwompMechanism:
    FiveBarGeometry;


  /*
   * ============================================================
   * MARIO PHYSICS
   * ============================================================
   */

  private readonly moveSpeed = 220;

  private readonly jumpDuration = 0.9;

  private readonly jumpHeight = 250;

  private jumpTime = 0;

  /*
   * Y from which the current jump started.
   */
  private jumpBaseY = this.groundY;

  /*
   * Mario can be standing on:
   *
   *   - ground
   *   - an obstacle
   *   - nothing
   *
   * We store the actual support instead of searching for
   * something underneath and moving Mario onto it.
   */
  private supportObstacle:
    Rect | null = null;


  /*
   * ============================================================
   * THWOMP
   * ============================================================
   */

  private readonly thwompTop = 120;

  private readonly thwompBottom = 360;

  private readonly thwompSpeed = 180;

  private thwompDirection = 1;

  thwompAutoplay = true;


  /*
   * ============================================================
   * CONSTRUCTOR
   * ============================================================
   */

  constructor() {

    this.state.mario.y =
      this.groundY;

    this.marioMechanism =
      this.calculateMarioMechanism();

    this.thwompMechanism =
      this.calculateThwompMechanism();
  }


  /*
   * ============================================================
   * GAME CONTROL
   * ============================================================
   */

  start(): void {

    if (
      this.state.status === 'dead' ||
      this.state.status === 'won'
    ) {
      this.reset();
    }

    this.state.status =
      'playing';
  }


  reset(): void {

    this.state.status =
      'ready';

    this.state.mario.x =
      10;

    this.state.mario.y =
      this.groundY;

    this.state.thwomp.x =
      380;

    this.state.thwomp.y =
      this.thwompTop;

    this.jumpTime =
      0;

    this.jumpBaseY =
      this.groundY;

    this.supportObstacle =
      null;

    this.thwompDirection =
      1;

    this.updateActuators();
  }


  /*
   * ============================================================
   * UPDATE
   * ============================================================
   */

  update(
    deltaTime: number,
    input: InputState,
  ): void {

    const dt =
      Math.max(
        0,
        Math.min(
          deltaTime,
          0.05,
        ),
      );

    if (
      this.state.status !== 'playing'
    ) {

      this.updateActuators();

      return;
    }

    this.updateMario(
      dt,
      input,
    );

    this.updateThwomp(
      dt,
    );

    this.updateActuators();

    this.checkCollision();

    if (
      this.state.status === 'playing'
    ) {
      this.checkWin();
    }
  }


  /*
   * ============================================================
   * ACTUATORS
   * ============================================================
   */

  private updateActuators(): void {

    this.marioMechanism =
      this.calculateMarioMechanism();

    this.thwompMechanism =
      this.calculateThwompMechanism();
  }


  private calculateMarioMechanism():
    FiveBarGeometry {

    return this.marioActuator.calculate({
      x:
        this.state.mario.x +
        this.state.mario.width / 2,

      y:
        this.state.mario.y +
        this.state.mario.height / 2,
    });
  }


  private calculateThwompMechanism():
    FiveBarGeometry {

    return this.thwompActuator.calculate({
      x:
        this.state.thwomp.x +
        this.state.thwomp.width / 2,

      y:
        this.state.thwomp.y +
        this.state.thwomp.height / 2,
    });
  }


  /*
   * ============================================================
   * THWOMP MANUAL POSITION
   * ============================================================
   */

  setThwompCenter(
    centerX: number,
    centerY: number,
  ): void {

    if (
      this.thwompAutoplay
    ) {
      return;
    }

    this.state.thwomp.x =
      centerX -
      this.state.thwomp.width / 2;

    this.state.thwomp.y =
      centerY -
      this.state.thwomp.height / 2;

    this.state.thwomp.x =
      Math.max(
        this.thwompBounds.x,

        Math.min(
          this.thwompBounds.x +
            this.thwompBounds.width -
            this.state.thwomp.width,

          this.state.thwomp.x,
        ),
      );

    this.state.thwomp.y =
      Math.max(
        this.thwompBounds.y,

        Math.min(
          this.thwompBounds.y +
            this.thwompBounds.height -
            this.state.thwomp.height,

          this.state.thwomp.y,
        ),
      );

    this.thwompMechanism =
      this.calculateThwompMechanism();
  }


  /*
   * ============================================================
   * MARIO
   * ============================================================
   */

  private updateMario(
    deltaTime: number,
    input: InputState,
  ): void {

    let direction = 0;

    if (input.left) {
      direction--;
    }

    if (input.right) {
      direction++;
    }


    /*
     * ----------------------------------------------------------
     * HORIZONTAL MOVEMENT
     * ----------------------------------------------------------
     *
     * Mario can walk normally on the ground.
     *
     * If he walks into an obstacle from the side,
     * horizontal movement stops.
     *
     * Being ABOVE an obstacle is completely fine.
     */

    if (
      direction !== 0
    ) {

      const oldX =
        this.state.mario.x;

      const newX =
        Math.max(
          0,

          Math.min(
            this.state.width -
              this.state.mario.width,

            oldX +
            direction *
            this.moveSpeed *
            deltaTime,
          ),
        );

      this.state.mario.x =
        newX;

      /*
       * Side collision only.
       */
      if (
        this.collidesWithObstacleFromSide(
          this.state.mario,
        )
      ) {

        this.state.mario.x =
          oldX;
      }

      /*
       * Mechanical validity.
       */
      if (
        !this.calculateMarioMechanism().valid
      ) {

        this.state.mario.x =
          oldX;
      }
    }


    /*
     * ----------------------------------------------------------
     * CHECK WHETHER MARIO IS STILL ON HIS CURRENT SUPPORT
     * ----------------------------------------------------------
     */

    if (
      this.supportObstacle !== null
    ) {

      const obstacle =
        this.supportObstacle;

      const platformY =
        obstacle.y -
        this.state.mario.height;

      const horizontallyOver =
        this.isHorizontallyOverlapping(
          this.state.mario,
          obstacle,
        );

      const correctlySupported =
        Math.abs(
          this.state.mario.y -
          platformY,
        ) < 1;

      if (
        !horizontallyOver ||
        !correctlySupported
      ) {

        this.supportObstacle =
          null;
      }
    }


    /*
     * ----------------------------------------------------------
     * JUMP START
     * ----------------------------------------------------------
     *
     * Crucially, jump is allowed from:
     *
     *   - ground
     *   - current obstacle
     *
     * But ONLY when jumpPressed.
     */

    const standingOnGround =
      Math.abs(
        this.state.mario.y -
        this.groundY,
      ) < 1;

    const standingOnObstacle =
      this.supportObstacle !== null;


    if (
      input.jumpPressed &&
      this.jumpTime === 0 &&
      (
        standingOnGround ||
        standingOnObstacle
      )
    ) {

      this.jumpBaseY =
        standingOnObstacle
          ? this.state.mario.y
          : this.groundY;

      this.jumpTime =
        this.jumpDuration;

      this.supportObstacle =
        null;
    }


    /*
     * ----------------------------------------------------------
     * JUMP
     * ----------------------------------------------------------
     */

    if (
      this.jumpTime > 0
    ) {

      const oldY =
        this.state.mario.y;

      const progress =
        1 -
        this.jumpTime /
        this.jumpDuration;

      const newY =
        this.jumpBaseY -
        Math.sin(
          progress *
          Math.PI,
        ) *
        this.jumpHeight;


      /*
       * Landing detection.
       */

      const oldBottom =
        oldY +
        this.state.mario.height;

      const newBottom =
        newY +
        this.state.mario.height;


      const descending =
        newY > oldY;


      if (
        descending
      ) {

        const landing =
          this.findLandingObstacle(
            oldBottom,
            newBottom,
          );


        if (
          landing !== null
        ) {

          this.state.mario.y =
            landing.y -
            this.state.mario.height;

          this.supportObstacle =
            landing;

          this.jumpTime =
            0;

          return;
        }


        /*
         * Ground landing.
         */

        if (
          oldBottom <=
            this.groundTop
          &&
          newBottom >=
            this.groundTop
        ) {

          this.state.mario.y =
            this.groundY;

          this.supportObstacle =
            null;

          this.jumpTime =
            0;

          return;
        }
      }


      this.state.mario.y =
        newY;


      /*
       * Mechanical validity.
       */

      if (
        !this.calculateMarioMechanism().valid
      ) {

        this.state.mario.y =
          oldY;
      }


      this.jumpTime -=
        deltaTime;


      if (
        this.jumpTime <= 0
      ) {

        this.jumpTime =
          0;

        /*
         * End of jump means land at the actual
         * surface below Mario, but NEVER move upward.
         */
        this.landAfterJump();
      }

      return;
    }


    /*
     * ----------------------------------------------------------
     * FALLING
     * ----------------------------------------------------------
     *
     * If Mario walks off a platform, he falls.
     *
     * This is the other important difference from the previous
     * version: we do NOT call getSupportY() and teleport him.
     */

    if (
      !standingOnGround &&
      !standingOnObstacle
    ) {

      this.fallMario(
        deltaTime,
      );
    }
  }


  /*
   * ============================================================
   * FALLING
   * ============================================================
   */

  private fallMario(
    deltaTime: number,
  ): void {

    const oldY =
      this.state.mario.y;

    const fallSpeed =
      500;

    const newY =
      oldY +
      fallSpeed *
      deltaTime;


    const oldBottom =
      oldY +
      this.state.mario.height;

    const newBottom =
      newY +
      this.state.mario.height;


    /*
     * Find the first surface below Mario.
     */

    let landing:
      Rect | null =
      null;


    for (
      const obstacle of this.obstacles
    ) {

      if (
        !this.isHorizontallyOverlapping(
          this.state.mario,
          obstacle,
        )
      ) {
        continue;
      }

      if (
        oldBottom <=
          obstacle.y
        &&
        newBottom >=
          obstacle.y
      ) {

        if (
          landing === null ||
          obstacle.y <
            landing.y
        ) {

          landing =
            obstacle;
        }
      }
    }


    if (
      landing !== null
    ) {

      this.state.mario.y =
        landing.y -
        this.state.mario.height;

      this.supportObstacle =
        landing;

      return;
    }


    /*
     * Ground.
     */

    if (
      oldBottom <=
        this.groundTop
      &&
      newBottom >=
        this.groundTop
    ) {

      this.state.mario.y =
        this.groundY;

      this.supportObstacle =
        null;

      return;
    }


    this.state.mario.y =
      newY;


    /*
     * Prevent mechanism-invalid movement.
     */

    if (
      !this.calculateMarioMechanism().valid
    ) {

      this.state.mario.y =
        oldY;
    }
  }


  /*
   * ============================================================
   * LAND AFTER JUMP
   * ============================================================
   */

  private landAfterJump(): void {

    const mario =
      this.state.mario;

    let best:
      Rect | null =
      null;


    for (
      const obstacle of this.obstacles
    ) {

      if (
        !this.isHorizontallyOverlapping(
          mario,
          obstacle,
        )
      ) {
        continue;
      }


      const platformY =
        obstacle.y -
        mario.height;


      /*
       * Only surfaces BELOW or exactly at Mario.
       *
       * Never move Mario upward.
       */

      if (
        platformY >=
        mario.y
      ) {

        if (
          best === null ||
          platformY <
            best.y -
            mario.height
        ) {

          best =
            obstacle;
        }
      }
    }


    if (
      best !== null
    ) {

      mario.y =
        best.y -
        mario.height;

      this.supportObstacle =
        best;

      return;
    }


    /*
     * If no platform catches him, ground catches him.
     */

    if (
      mario.y <=
      this.groundY
    ) {

      mario.y =
        this.groundY;

      this.supportObstacle =
        null;
    }
  }


  /*
   * ============================================================
   * FIND JUMP LANDING
   * ============================================================
   */

  private findLandingObstacle(
    oldBottom: number,
    newBottom: number,
  ): Rect | null {

    let landing:
      Rect | null =
      null;


    for (
      const obstacle of this.obstacles
    ) {

      if (
        !this.isHorizontallyOverlapping(
          this.state.mario,
          obstacle,
        )
      ) {
        continue;
      }


      if (
        oldBottom <=
          obstacle.y
        &&
        newBottom >=
          obstacle.y
      ) {

        if (
          landing === null ||
          obstacle.y <
            landing.y
        ) {

          landing =
            obstacle;
        }
      }
    }


    return landing;
  }


  /*
   * ============================================================
   * THWOMP
   * ============================================================
   */

  private updateThwomp(
    deltaTime: number,
  ): void {

    if (
      !this.thwompAutoplay
    ) {
      return;
    }


    const oldY =
      this.state.thwomp.y;

    const oldBottom =
      oldY +
      this.state.thwomp.height;


    let newY =
      oldY +
      this.thwompDirection *
      this.thwompSpeed *
      deltaTime;


    /*
     * ----------------------------------------------------------
     * OBSTACLE COLLISION
     * ----------------------------------------------------------
     */

    if (
      this.thwompDirection > 0
    ) {

      const newBottom =
        newY +
        this.state.thwomp.height;


      let stopY:
        number | null =
        null;


      for (
        const obstacle of this.obstacles
      ) {

        if (
          !this.isHorizontallyOverlapping(
            this.state.thwomp,
            obstacle,
          )
        ) {
          continue;
        }


        if (
          oldBottom <=
            obstacle.y
          &&
          newBottom >=
            obstacle.y
        ) {

          const candidate =
            obstacle.y -
            this.state.thwomp.height;


          if (
            stopY === null ||
            candidate < stopY
          ) {

            stopY =
              candidate;
          }
        }
      }


      if (
        stopY !== null
      ) {

        newY =
          stopY;

        this.thwompDirection =
          -1;
      }
    }


    /*
     * ----------------------------------------------------------
     * LIMITS
     * ----------------------------------------------------------
     */

    newY =
      Math.max(
        this.thwompTop,

        Math.min(
          this.thwompBottom,
          newY,
        ),
      );


    this.state.thwomp.y =
      newY;


    if (
      this.state.thwomp.y >=
      this.thwompBottom
    ) {

      this.state.thwomp.y =
        this.thwompBottom;

      this.thwompDirection =
        -1;
    }


    if (
      this.state.thwomp.y <=
      this.thwompTop
    ) {

      this.state.thwomp.y =
        this.thwompTop;

      this.thwompDirection =
        1;
    }


    /*
     * 5-bar validity.
     */

    if (
      !this.calculateThwompMechanism().valid
    ) {

      this.state.thwomp.y =
        oldY;

      this.thwompDirection *=
        -1;
    }
  }


  /*
   * ============================================================
   * MARIO SIDE COLLISION
   * ============================================================
   */

  private collidesWithObstacleFromSide(
    mario: Character,
  ): boolean {

    for (
      const obstacle of this.obstacles
    ) {

      if (
        !this.isHorizontallyOverlapping(
          mario,
          obstacle,
        )
      ) {
        continue;
      }


      const bottom =
        mario.y +
        mario.height;


      /*
       * Mario is completely above the obstacle.
       */
      if (
        bottom <=
        obstacle.y
      ) {
        continue;
      }


      /*
       * Mario is completely below it.
       */
      if (
        mario.y >=
        obstacle.y +
        obstacle.height
      ) {
        continue;
      }


      return true;
    }


    return false;
  }


  /*
   * ============================================================
   * COLLISION
   * ============================================================
   */

  private checkCollision(): void {

    if (
      this.overlap(
        this.state.mario,
        this.state.thwomp,
      )
    ) {

      this.state.status =
        'dead';
    }
  }


  /*
   * ============================================================
   * WIN
   * ============================================================
   */

  private checkWin(): void {

    const finishX =
      this.state.width -
      60;


    if (
      this.state.mario.x >=
      finishX
    ) {

      this.state.status =
        'won';
    }
  }


  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  private isHorizontallyOverlapping(
    a: Rect,
    b: Rect,
  ): boolean {

    return (
      a.x <
        b.x +
        b.width
      &&
      a.x +
        a.width >
        b.x
    );
  }


  private overlap(
    a: Character | Rect,
    b: Character | Rect,
  ): boolean {

    return (
      a.x <
        b.x +
        b.width
      &&
      a.x +
        a.width >
        b.x
      &&
      a.y <
        b.y +
        b.height
      &&
      a.y +
        a.height >
        b.y
    );
  }
}

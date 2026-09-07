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


    physicalLimit: {

      mario: {

        invalid: false,

        left: {
          north: false,
          south: false,
          west: false,
          east: false,
          motor: false,
          singularity: false,
        },

        right: {
          north: false,
          south: false,
          west: false,
          east: false,
          motor: false,
          singularity: false,
        },

      },


      thwomp: {

        invalid: false,

        left: {
          north: false,
          south: false,
          west: false,
          east: false,
          motor: false,
          singularity: false,
        },

        right: {
          north: false,
          south: false,
          west: false,
          east: false,
          motor: false,
          singularity: false,
        },

      },

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

  private readonly jumpCooldownDuration = 0.4;

  private jumpCooldown = 0;


  /*
   * ============================================================
   * BOUNDS
   * ============================================================
   */

  readonly characterBounds: Rect = {

    x: 0,

    y: 0,

    width: 520,

    height: 600,

  };


  readonly jointBounds: Rect = {

    x: 0,

    y: 0,

    width: 520,

    height: 428,

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

        upperArm: 180,

        lowerArm: 180,


        baseLeft: {

          x: 185,

          y: 240,

        },


        baseRight: {

          x: 335,

          y: 240,

        },

        /*
         * Set your REAL motor limits here when known.
         *
         * Example:
         *
         * motorLimits: {
         *   leftMin: -Math.PI / 2,
         *   leftMax: Math.PI / 2,
         *   rightMin: -Math.PI / 2,
         *   rightMax: Math.PI / 2,
         * },
         *
         * Do not invent these for the physical hardware.
         */

        singularityMargin: 0.10,

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

        upperArm: 160,

        lowerArm: 160,


        baseLeft: {

          x: 180,

          y: 220,

        },


        baseRight: {

          x: 340,

          y: 220,

        },


        singularityMargin: 0.10,

      },

    );


  marioMechanism: FiveBarGeometry;

  thwompMechanism: FiveBarGeometry;


  /*
   * ============================================================
   * MARIO PHYSICS
   * ============================================================
   */

  private readonly moveSpeed = 220;

  private readonly jumpDuration = 0.9;

  private readonly jumpHeight = 150;

  private jumpTime = 0;

  private jumpBaseY = this.groundY;

  private supportObstacle: Rect | null = null;


  /*
   * ============================================================
   * THWOMP
   * ============================================================
   */

  private readonly thwompTop = 100;

  private readonly thwompBottom = 360;

  private readonly thwompSpeed = 120;

  private thwompDirection = 1;

  thwompAutoplay = true;


  /*
   * ============================================================
   * EXPLICIT THWOMP REVERSE POINT
   * ============================================================
   *
   * The Thwomp reverses when its TOP reaches this Y.
   *
   * CHANGE THIS VALUE.
   *
   * Example:
   *
   * 300 = reverse at y = 300
   *
   * ============================================================
   */

  private readonly thwompReversePointY = 300;


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

    this.updatePhysicalLimits();

  }


  /*
   * ============================================================
   * GAME CONTROL
   * ============================================================
   */

  start(): void {

    this.reset();

    this.state.status = 'playing';

  }


  reset(): void {

    this.state.status = 'ready';

    this.state.mario.x = 10;

    this.state.mario.y =
      this.groundY;

    this.state.thwomp.x = 380;

    this.state.thwomp.y =
      this.thwompTop;

    this.jumpTime = 0;

    this.jumpBaseY =
      this.groundY;

    this.supportObstacle = null;

    this.thwompDirection = 1;

    this.jumpCooldown = 0;

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


    /*
    * Thwomp autoplay is independent of game status.
    * It must continue moving while the game is ready,
    * playing, dead, etc.
    */
    this.updateThwomp(dt);


    /*
    * Mario only updates while playing.
    */
    if (this.state.status !== 'playing') {

      this.updateActuators();

      return;
    }


    this.updateMario(
      dt,
      input,
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

    this.updatePhysicalLimits();

  }


  private updatePhysicalLimits(): void {

    this.state.physicalLimit.mario =
      this.marioActuator.physicalLimits(
        this.marioMechanism,
      );


    this.state.physicalLimit.thwomp =
      this.thwompActuator.physicalLimits(
        this.thwompMechanism,
      );

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

    if (this.thwompAutoplay) {
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

    this.updatePhysicalLimits();

  }


  /*
   * ============================================================
   * THWOMP
   * ============================================================
   */

  private updateThwomp(
    deltaTime: number,
  ): void {

    if (!this.thwompAutoplay) {
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
     * EXPLICIT REVERSE POINT
     * ----------------------------------------------------------
     */

    if (
      this.thwompDirection > 0 &&
      newY >= this.thwompReversePointY
    ) {

      newY =
        this.thwompReversePointY;

      this.thwompDirection = -1;

    }


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


      let stopY: number | null =
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
          oldBottom <= obstacle.y &&
          newBottom >= obstacle.y
        ) {

          const candidate =
            obstacle.y -
            this.state.thwomp.height;


          if (
            stopY === null ||
            candidate < stopY
          ) {

            stopY = candidate;

          }

        }

      }


      if (stopY !== null) {

        newY = stopY;

        this.thwompDirection = -1;

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

      this.thwompDirection = -1;

    }


    if (
      this.state.thwomp.y <=
      this.thwompTop
    ) {

      this.state.thwomp.y =
        this.thwompTop;

      this.thwompDirection = 1;

    }


    /*
     * Mechanical validity.
     */

    if (
      !this.calculateThwompMechanism().valid
    ) {

      this.state.thwomp.y =
        oldY;

      this.thwompDirection *= -1;

    }

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

    if (this.jumpCooldown > 0) {

      this.jumpCooldown =
        Math.max(
          0,
          this.jumpCooldown -
          deltaTime,
        );

    }


    let direction = 0;


    if (input.left) {
      direction--;
    }


    if (input.right) {
      direction++;
    }


    if (direction !== 0) {

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


      if (
        this.collidesWithObstacleFromSide(
          this.state.mario,
        )
      ) {

        this.state.mario.x =
          oldX;

      }


      if (
        !this.calculateMarioMechanism().valid
      ) {

        this.state.mario.x =
          oldX;

      }

    }


    const standingOnGround =
      Math.abs(
        this.state.mario.y -
        this.groundY,
      ) < 1;


    const standingOnObstacle =
      this.supportObstacle !== null &&

      Math.abs(
        this.state.mario.y -
        (
          this.supportObstacle.y -
          this.state.mario.height
        ),
      ) < 1 &&

      this.isHorizontallyOverlapping(
        this.state.mario,
        this.supportObstacle,
      );


    if (!standingOnObstacle) {
      this.supportObstacle = null;
    }


    if (
      input.jumpPressed &&

      this.jumpTime === 0 &&

      this.jumpCooldown === 0 &&

      (
        standingOnGround ||
        standingOnObstacle
      )
    ) {

      this.jumpBaseY =
        this.state.mario.y;

      this.jumpTime =
        this.jumpDuration;

      this.jumpCooldown =
        this.jumpCooldownDuration;

      this.supportObstacle = null;

    }


    if (this.jumpTime > 0) {

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


      const oldBottom =
        oldY +
        this.state.mario.height;


      const newBottom =
        newY +
        this.state.mario.height;


      const ascending =
        newY < oldY;


      const descending =
        newY > oldY;


      if (ascending) {

        const ceiling =
          this.findHeadCollision(
            oldY,
            newY,
          );


        if (ceiling !== null) {

          this.state.mario.y =
            ceiling.y +
            ceiling.height;

          this.jumpTime = 0;

          return;

        }


        this.state.mario.y =
          newY;

      }


      else if (descending) {

        const landing =
          this.findLandingObstacle(
            oldBottom,
            newBottom,
          );


        if (landing !== null) {

          this.state.mario.y =
            landing.y -
            this.state.mario.height;

          this.supportObstacle =
            landing;

          this.jumpTime = 0;

          return;

        }


        if (
          oldBottom <= this.groundTop &&
          newBottom >= this.groundTop
        ) {

          this.state.mario.y =
            this.groundY;

          this.supportObstacle = null;

          this.jumpTime = 0;

          return;

        }


        this.state.mario.y =
          newY;

      }


      if (
        !this.calculateMarioMechanism().valid
      ) {

        this.state.mario.y =
          oldY;

      }


      this.jumpTime -=
        deltaTime;


      if (this.jumpTime <= 0) {

        this.jumpTime = 0;

        this.landAfterJump();

      }


      return;

    }


    if (
      !standingOnGround &&
      !standingOnObstacle
    ) {

      this.fallMario(deltaTime);

    }

  }


  /*
   * ============================================================
   * HEAD COLLISION
   * ============================================================
   */

  private findHeadCollision(
    oldY: number,
    newY: number,
  ): Rect | null {

    let collision: Rect | null =
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


      const obstacleBottom =
        obstacle.y +
        obstacle.height;


      if (
        oldY >= obstacleBottom &&
        newY <= obstacleBottom
      ) {

        if (
          collision === null ||
          obstacleBottom >
          collision.y +
          collision.height
        ) {

          collision = obstacle;

        }

      }

    }


    return collision;

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


    const fallSpeed = 500;


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


    let landing: Rect | null =
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
        oldBottom <= obstacle.y &&
        newBottom >= obstacle.y
      ) {

        if (
          landing === null ||
          obstacle.y < landing.y
        ) {

          landing = obstacle;

        }

      }

    }


    if (landing !== null) {

      this.state.mario.y =
        landing.y -
        this.state.mario.height;

      this.supportObstacle =
        landing;

      return;

    }


    if (
      oldBottom <= this.groundTop &&
      newBottom >= this.groundTop
    ) {

      this.state.mario.y =
        this.groundY;

      this.supportObstacle = null;

      return;

    }


    this.state.mario.y =
      newY;


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


    let best: Rect | null =
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


      if (platformY >= mario.y) {

        if (
          best === null ||
          platformY <
          best.y -
          mario.height
        ) {

          best = obstacle;

        }

      }

    }


    if (best !== null) {

      mario.y =
        best.y -
        mario.height;

      this.supportObstacle =
        best;

      return;

    }


    if (mario.y <= this.groundY) {

      mario.y =
        this.groundY;

      this.supportObstacle = null;

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

    let landing: Rect | null =
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
        oldBottom <= obstacle.y &&
        newBottom >= obstacle.y
      ) {

        if (
          landing === null ||
          obstacle.y < landing.y
        ) {

          landing = obstacle;

        }

      }

    }


    return landing;

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


      if (bottom <= obstacle.y) {
        continue;
      }


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
   * MARIO / THWOMP COLLISION
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
      this.state.mario.x >= finishX
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
      b.x + b.width &&

      a.x + a.width >
      b.x

    );

  }


  private overlap(
    a: Character | Rect,
    b: Character | Rect,
  ): boolean {

    return (

      a.x <
      b.x + b.width &&

      a.x + a.width >
      b.x &&

      a.y <
      b.y + b.height &&

      a.y + a.height >
      b.y

    );

  }

}

import {
  Character,
  GameState,
  InputState,
  Rect,
} from './types';

import {
  DoubleFiveBar,
  DoubleFiveBarGeometry,
} from './double-five-bar';


export class GameEngine {

  readonly state: GameState = {

    width: 600,

    height: 900,

    status: 'ready',

    mario: {
      id: 'mario',

      x: 60,

      y: 760,

      width: 34,

      height: 48,
    },

    thwomp: {
      id: 'thwomp',

      x: 430,

      y: 150,

      width: 80,

      height: 80,
    },
  };


  /*
   * ============================================================
   * MECHANICAL ENVELOPES
   * ============================================================
   *
   * These are independent.
   *
   * Change these rectangles to define the maximum freedom of
   * each complete actuator.
   */

  readonly marioBounds: Rect = {

    x: 20,

    y: 20,

    width: 560,

    height: 820,
  };


  readonly thwompBounds: Rect = {

    x: 20,

    y: 20,

    width: 560,

    height: 820,
  };


  /*
   * ============================================================
   * ACTUATORS
   * ============================================================
   */

  readonly marioActuator =
    new DoubleFiveBar(
      this.marioBounds,
    );


  readonly thwompActuator =
    new DoubleFiveBar(
      this.thwompBounds,
    );

  marioMechanism:
    DoubleFiveBarGeometry;

  thwompMechanism:
    DoubleFiveBarGeometry;


  /*
   * ============================================================
   * GAME PARAMETERS
   * ============================================================
   */

  private readonly moveSpeed = 220;

  private readonly groundY = 760;

  private readonly jumpDuration = 0.9;

  private readonly jumpHeight = 250;

  private jumpTime = 0;


  private readonly thwompTop = 120;

  private readonly thwompBottom = 680;

  private readonly thwompSpeed = 180;

  private thwompDirection = 1;


  constructor() {

    this.marioMechanism =
      this.calculateMarioMechanism();

    this.thwompMechanism =
      this.calculateThwompMechanism();
  }


  start(): void {

    if (
      this.state.status === 'dead' ||
      this.state.status === 'won'
    ) {

      this.reset();
    }

    this.state.status = 'playing';
  }


  reset(): void {

    this.state.status = 'ready';

    this.state.mario.x = 60;

    this.state.mario.y =
      this.groundY;

    this.state.thwomp.x = 430;

    this.state.thwomp.y =
      this.thwompTop;

    this.jumpTime = 0;

    this.thwompDirection = 1;

    this.updateActuators();
  }


  update(
    deltaTime: number,
    input: InputState,
  ): void {

    if (
      this.state.status !== 'playing'
    ) {

      this.updateActuators();

      return;
    }


    this.updateMario(
      deltaTime,
      input,
    );


    this.updateThwomp(
      deltaTime,
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
    DoubleFiveBarGeometry {

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
    DoubleFiveBarGeometry {

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
   * MARIO
   * ============================================================
   */

  private updateMario(
    deltaTime: number,
    input: InputState,
  ): void {

    let direction = 0;


    if (input.left) {

      direction -= 1;
    }


    if (input.right) {

      direction += 1;
    }


    /*
     * ----------------------------------------------------------
     * Horizontal movement
     * ----------------------------------------------------------
     */

    if (direction !== 0) {

      const oldX =
        this.state.mario.x;


      const newX =
        oldX +
        direction *
        this.moveSpeed *
        deltaTime;


      this.state.mario.x =
        Math.max(
          0,
          Math.min(
            this.state.width -
              this.state.mario.width,
            newX,
          ),
        );


      /*
       * Calculate the mechanism at the
       * proposed position.
       */

      const mechanism =
        this.calculateMarioMechanism();


      /*
       * If the mechanism cannot physically
       * occupy that position, reject it.
       */

      if (!mechanism.valid) {

        this.state.mario.x =
          oldX;
      }
    }


    /*
     * ----------------------------------------------------------
     * Jump
     * ----------------------------------------------------------
     */

    if (
      input.jumpPressed &&
      this.jumpTime === 0 &&
      this.state.mario.y ===
        this.groundY
    ) {

      this.jumpTime =
        this.jumpDuration;
    }


    if (
      this.jumpTime > 0
    ) {

      const progress =
        1 -
        this.jumpTime /
          this.jumpDuration;


      const newY =
        this.groundY -

        Math.sin(
          progress * Math.PI,
        ) *

        this.jumpHeight;


      const oldY =
        this.state.mario.y;


      this.state.mario.y =
        newY;


      /*
       * The vertical movement is subject to
       * exactly the same mechanical constraint.
       */

      const mechanism =
        this.calculateMarioMechanism();


      if (!mechanism.valid) {

        this.state.mario.y =
          oldY;
      }


      this.jumpTime -=
        deltaTime;


      if (
        this.jumpTime <= 0
      ) {

        this.jumpTime = 0;

        this.state.mario.y =
          this.groundY;
      }
    }
  }


  /*
   * ============================================================
   * THWOMP
   * ============================================================
   */

  private updateThwomp(
    deltaTime: number,
  ): void {

    const oldY =
      this.state.thwomp.y;


    const newY =
      oldY +
      this.thwompDirection *
      this.thwompSpeed *
      deltaTime;


    this.state.thwomp.y =
      newY;


    /*
     * Normal movement limits.
     */

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
     * Mechanical envelope.
     */

    const mechanism =
      this.calculateThwompMechanism();


    if (!mechanism.valid) {

      this.state.thwomp.y =
        oldY;

      this.thwompDirection *= -1;
    }
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
      this.state.width - 60;


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
   * COLLISION HELPERS
   * ============================================================
   */

  private overlap(
    a: Character,
    b: Character,
  ): boolean {

    return (

      a.x <
      b.x + b.width

      &&

      a.x + a.width >
      b.x

      &&

      a.y <
      b.y + b.height

      &&

      a.y + a.height >
      b.y
    );
  }
}

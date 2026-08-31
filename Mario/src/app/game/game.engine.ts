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
      x: 0,
      y: 372,
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
   *
   * One 5-bar:
   *
   *        left base                 right base
   *            ●-------------------------●
   *             \                       /
   *              ●                     ●
   *                \                 /
   *                     M
   *
   * 2 main joints
   * 2 passive joints
   * 1 effector
   *
   * These dimensions were checked against Mario's complete
   * movement range, including the jump.
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
   *
   * One independent 5-bar.
   *
   * T can move vertically without requiring a second linkage.
   */

  readonly thwompActuator =
    new FiveBarActuator(

      this.thwompBounds,

      this.thwompJointBounds,

      {

        upperArm:
          190,

        lowerArm:
          190,


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
   * GAME PARAMETERS
   * ============================================================
   */

  private readonly moveSpeed =
    220;


  private readonly groundY =
    372;


  private readonly jumpDuration =
    0.9;


  private readonly jumpHeight =
    250;


  private jumpTime =
    0;


  /*
   * ============================================================
   * THWOMP
   * ============================================================
   */

  private readonly thwompTop =
    120;


  private readonly thwompBottom =
    360;


  private readonly thwompSpeed =
    180;


  private thwompDirection =
    1;


  thwompAutoplay =
    true;


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

    this.recalculateMechanisms();
  }


  private recalculateMechanisms(): void {

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


    /*
     * Keep T itself inside the actuator bounds.
     */

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

    let direction =
      0;


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


      const mechanism =
        this.calculateMarioMechanism();


      if (
        !mechanism.valid
      ) {

        this.state.mario.x =
          oldX;
      }
    }


    /*
     * ----------------------------------------------------------
     * Jump start
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


    /*
     * ----------------------------------------------------------
     * Jump
     * ----------------------------------------------------------
     */

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
          progress *
          Math.PI,
        ) *

        this.jumpHeight;


      const oldY =
        this.state.mario.y;


      this.state.mario.y =
        newY;


      const mechanism =
        this.calculateMarioMechanism();


      if (
        !mechanism.valid
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

    if (
      !this.thwompAutoplay
    ) {

      return;
    }


    const oldY =
      this.state.thwomp.y;


    const newY =
      oldY +

      this.thwompDirection *

      this.thwompSpeed *

      deltaTime;


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


    const mechanism =
      this.calculateThwompMechanism();


    if (
      !mechanism.valid
    ) {

      this.state.thwomp.y =
        oldY;


      this.thwompDirection *=
        -1;
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
   * COLLISION HELPERS
   * ============================================================
   */

  private overlap(
    a: Character,
    b: Character,
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

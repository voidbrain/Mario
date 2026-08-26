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

    width: 800,

    height: 500,

    status: 'ready',

    /*
     * Mario starts at a mechanically valid position.
     *
     * y is the TOP of Mario.
     */

    mario: {
      id: 'mario',
      x: 300,
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
   * MARIO EFFECTOR BOUNDS
   * ============================================================
   *
   * These are bounds for Mario's CENTER POINT, because the
   * actuator receives Mario's center.
   *
   * X:
   *   20 ... 780
   *
   * Y:
   *   20 ... 480
   */

  readonly marioBounds: Rect = {
    x: -10000,
    y: -10000,
    width: 20000,
    height: 20000,
  };

  readonly marioJointBounds: Rect = {
    x: -10000,
    y: -10000,
    width: 20000,
    height: 20000,
  };

  readonly thwompBounds: Rect = {
    x: -10000,
    y: -10000,
    width: 20000,
    height: 20000,
  };

  readonly thwompJointBounds: Rect = {
    x: -10000,
    y: -10000,
    width: 20000,
    height: 20000,
  };


  /*
   * ============================================================
   * ACTUATORS
   * ============================================================
   */

  readonly marioActuator =
    new DoubleFiveBar(
      this.marioBounds,
      this.marioJointBounds,
    );


  readonly thwompActuator =
    new DoubleFiveBar(
      this.thwompBounds,
      this.thwompJointBounds,
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

  private readonly moveSpeed =
    220;


  /*
   * Mario's Y is the TOP of the character.
   *
   * 500 - 48 = 452
   *
   * But the mechanism cannot reach that center position with
   * the current 80/420 base arrangement.
   *
   * Therefore keep Mario's feet at 420:
   *
   * 420 - 48 = 372
   */

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
    340;


  private readonly thwompSpeed =
    180;


  private thwompDirection =
    1;


  constructor() {

    /*
     * Ensure initial positions are exactly the positions
     * represented by the state.
     */

    this.state.mario.y =
      this.groundY;


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


    this.state.status =
      'playing';
  }


  reset(): void {

    this.state.status =
      'ready';


    this.state.mario.x =
      300;


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


  update(
    deltaTime: number,
    input: InputState,
  ): void {

    /*
     * Prevent a bad frame from destroying the mechanism.
     */

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


      /*
       * Keep the character itself inside the game.
       */

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


      /*
       * Do NOT accept a position that breaks the
       * double five-bar.
       */

      if (!mechanism.valid) {

        this.state.mario.x =oldX;
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


      if (!mechanism.valid) {

        this.state.mario.y = oldY;
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


    /*
     * If the new position makes ANY passive joint invalid,
     * restore the old position and reverse direction.
     */

    if (!mechanism.valid) {

      this.state.thwomp.y = oldY;


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

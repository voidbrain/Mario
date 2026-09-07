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

import { SimBridge } from '../sim/sim-bridge.service';


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

  // SimBridge exists for future worker use, but the runtime is intentionally
  // kept on the main thread until it is proven stable in-browser.
  private simBridge: SimBridge | null = null;
  private readonly useWorkerPhysics = false;


  /*
   * ============================================================
   * MARIO PHYSICS
   * ============================================================
   */

  private readonly moveSpeed = 220;

  private readonly motionPredictionHorizon = 6;

  private readonly maxHorizontalStep = 12;

  private readonly maxVerticalStep = 10;

  private readonly maxHorizontalAcceleration = 1000;

  private readonly maxHorizontalDeceleration = 1400;

  private readonly maxHorizontalJerk = 1800;

  private readonly maxVerticalAcceleration = 2000;

  private readonly maxVerticalJerk = 2600;

  private readonly maxMotorAngularRate = 4.2;

  private readonly maxMotorTorqueDemand = 1.8;

  // Thermal / torque model (simple approximations)
  private motorTempLeft = 25; // Celsius
  private motorTempRight = 25; // Celsius
  private readonly motorAmbientTemp = 25; // Celsius
  private readonly motorMaxTemp = 80; // Celsius - critical
  private readonly motorHeatingCoeff = 0.6; // temp rise per (torque^2 * s)
  private readonly motorCoolingCoeff = 0.25; // cooling rate toward ambient per second
  private readonly motorTorqueCapacity = 2.2; // peak torque capacity (arbitrary units)

  private readonly maxJumpPlannerSamples = 6;

  private readonly trajectoryCandidateCount = 5;

  private marioVelocityX = 0;

  private marioAccelerationX = 0;

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

    // Intentionally keep the simulation on the main thread until the worker is
    // stable enough to drive the game reliably in-browser.
    if (this.useWorkerPhysics) {
      try {
        if (!this.simBridge) this.simBridge = new SimBridge();
        this.simBridge.start({ scale: 100, timeStep: 1 / 120, publishHz: 60, ambientTemp: 25, timeoutMs: 3000 })
          .then(() => {
            if (!this.simBridge) return;
            this.simBridge.onState((msg: any) => {
              if (!msg || !msg.bodies) return;
              const marioBody = msg.bodies['mario-payload'];
              const thwompBody = msg.bodies['thwomp-payload'];
              if (marioBody) {
                this.state.mario.x = Math.max(0, Math.min(this.state.width - this.state.mario.width, marioBody.x * 100 - this.state.mario.width / 2));
                this.state.mario.y = Math.max(0, Math.min(this.state.height - this.state.mario.height, marioBody.y * 100 - this.state.mario.height / 2));
              }
              if (thwompBody) {
                this.state.thwomp.x = Math.max(0, Math.min(this.state.width - this.state.thwomp.width, thwompBody.x * 100 - this.state.thwomp.width / 2));
                this.state.thwomp.y = Math.max(0, Math.min(this.state.height - this.state.thwomp.height, thwompBody.y * 100 - this.state.thwomp.height / 2));
              }
              if (msg.motors) {
                const left = msg.motors['mario-baseLeftJoint'];
                const right = msg.motors['mario-baseRightJoint'];
                if (left && typeof left.temp === 'number') this.motorTempLeft = left.temp;
                if (right && typeof right.temp === 'number') this.motorTempRight = right.temp;
              }
            });

            const scale = 100;
            const mBaseLeft = this.marioActuator.params.baseLeft;
            const mBaseRight = this.marioActuator.params.baseRight;
            const mEff = { x: (this.state.mario.x + this.state.mario.width / 2) / scale, y: (this.state.mario.y + this.state.mario.height / 2) / scale };
            this.simBridge.createFiveBar('mario', {
              baseLeft: { x: mBaseLeft.x / scale, y: mBaseLeft.y / scale },
              baseRight: { x: mBaseRight.x / scale, y: mBaseRight.y / scale },
              effector: mEff,
              upperArm: this.marioActuator.params.upperArm / scale,
              lowerArm: this.marioActuator.params.lowerArm / scale,
              payloadSize: { w: this.state.mario.width / scale, h: this.state.mario.height / scale },
              motor: { maxTorque: this.motorTorqueCapacity, initTemp: this.motorTempLeft, kP: 80, kD: 2 },
            });

            const tBaseLeft = this.thwompActuator.params.baseLeft;
            const tBaseRight = this.thwompActuator.params.baseRight;
            const tEff = { x: (this.state.thwomp.x + this.state.thwomp.width / 2) / scale, y: (this.state.thwomp.y + this.state.thwomp.height / 2) / scale };
            this.simBridge.createFiveBar('thwomp', {
              baseLeft: { x: tBaseLeft.x / scale, y: tBaseLeft.y / scale },
              baseRight: { x: tBaseRight.x / scale, y: tBaseRight.y / scale },
              effector: tEff,
              upperArm: this.thwompActuator.params.upperArm / scale,
              lowerArm: this.thwompActuator.params.lowerArm / scale,
              payloadSize: { w: this.state.thwomp.width / scale, h: this.state.thwomp.height / scale },
              motor: { maxTorque: this.motorTorqueCapacity, initTemp: this.motorTempRight, kP: 80, kD: 2 },
            });

            this.simBridge.post({ type: 'start' });
          })
          .catch((err) => {
            console.warn('SimBridge failed to initialize:', err);
            this.simBridge = null;
          });
      } catch (e) {
        console.warn('SimBridge start failed, continuing without worker', e);
        this.simBridge = null;
      }
    } else {
      this.simBridge = null;
    }

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

    this.marioVelocityX = 0;

    this.marioAccelerationX = 0;

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

    // Update motor thermal model continuously (cooling)
    this.updateMotorThermals(dt);

    /*
    * Mario only updates while playing.
    */
    if (this.state.status !== 'playing') {

      this.updateActuators();

      return;
    }


    // Keep the main-thread path as the authoritative runtime. The worker bridge
    // is left in place for future integration, but it is not allowed to override
    // the known-good game loop while it remains unstable.
    this.updateThwomp(dt);
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


  // Simple motor thermal model: cool toward ambient and cap temps.
  private updateMotorThermals(dt: number): void {

    // passive cooling toward ambient
    const leftDelta = -this.motorCoolingCoeff * (this.motorTempLeft - this.motorAmbientTemp);
    const rightDelta = -this.motorCoolingCoeff * (this.motorTempRight - this.motorAmbientTemp);

    this.motorTempLeft = Math.max(this.motorAmbientTemp, this.motorTempLeft + leftDelta * dt);
    this.motorTempRight = Math.max(this.motorAmbientTemp, this.motorTempRight + rightDelta * dt);

    // clamp to safe extremes
    this.motorTempLeft = Math.min(this.motorTempLeft, this.motorMaxTemp * 1.5);
    this.motorTempRight = Math.min(this.motorTempRight, this.motorMaxTemp * 1.5);

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

    if (
      !this.thwompAutoplay ||
      this.state.status !== 'playing'
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

      const optimized =
        this.optimizeHorizontalTrajectory(
          oldX,
          direction,
          deltaTime,
        );

      this.state.mario.x =
        optimized.x;

      this.marioVelocityX =
        optimized.velocity;

      this.marioAccelerationX =
        optimized.acceleration;


      if (
        this.collidesWithObstacleFromSide(
          this.state.mario,
        )
      ) {

        this.state.mario.x =
          oldX;

        this.marioVelocityX =
          0;

        this.marioAccelerationX =
          0;

      }


      if (
        !this.calculateMarioMechanism().valid
      ) {

        this.state.mario.x =
          oldX;

        this.marioVelocityX =
          0;

        this.marioAccelerationX =
          0;

      }

    } else {

      const drag =
        this.maxHorizontalDeceleration *
        deltaTime;

      if (Math.abs(this.marioVelocityX) <= drag) {

        this.marioVelocityX = 0;

      } else {

        this.marioVelocityX -=
          Math.sign(this.marioVelocityX) *
          drag;

      }

      this.marioAccelerationX =
        0;

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

      const targetVerticalVelocity =
        this.maxVerticalAcceleration *
        deltaTime;

      const jerkLimitedVerticalVelocity =
        this.maxVerticalJerk *
        deltaTime;

      const newY =
        this.jumpBaseY -
        Math.sin(
          progress *
          Math.PI,
        ) *
        this.jumpHeight;

      if (
        Math.abs(
          newY -
          oldY,
        ) >
        Math.min(
          targetVerticalVelocity,
          jerkLimitedVerticalVelocity,
        )
      ) {

        const clippedY =
          oldY +
          Math.sign(
            newY -
            oldY,
          ) *
          Math.min(
            Math.abs(
              newY -
              oldY,
            ),
            Math.min(
              targetVerticalVelocity,
              jerkLimitedVerticalVelocity,
            ),
          );

        const predictedY =
          this.validateMotionPath(
            oldY,
            clippedY,
            'y',
          );

        if (predictedY !== clippedY) {

          this.state.mario.y =
            oldY;

          this.jumpTime = 0;

          return;

        }

        this.state.mario.y =
          clippedY;

        this.jumpTime -=
          deltaTime;

        if (this.jumpTime <= 0) {

          this.jumpTime = 0;
          this.landAfterJump();

        }

        return;

      }


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


        const predictedY =
          this.validateMotionPath(
            oldY,
            newY,
            'y',
          );


        if (predictedY !== newY) {

          this.state.mario.y =
            oldY;

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


        const predictedY =
          this.validateMotionPath(
            oldY,
            newY,
            'y',
          );


        if (predictedY !== newY) {

          this.state.mario.y =
            oldY;

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


  private buildTrajectoryCandidates(
   startX: number,
   direction: number,
   deltaTime: number,
  ): Array<{
   position: number;
   velocity: number;
   acceleration: number;
  }> {

   const baseVelocity =
     this.marioVelocityX;

   const targetVelocity =
     direction *
     this.moveSpeed;

   const accelerationRamp =
     this.marioVelocityX +
     Math.sign(
       targetVelocity -
       this.marioVelocityX,
     ) *
     this.maxHorizontalAcceleration *
     deltaTime;

   const velocitySteps =
     [
       baseVelocity,
       targetVelocity,
       accelerationRamp,
       direction *
       this.moveSpeed *
       0.9,
       direction *
       this.moveSpeed *
       0.75,
       direction *
       this.moveSpeed *
       0.5,
       direction *
       this.moveSpeed *
       0.25,
       0,
     ];

   const uniqueVelocities =
     Array.from(
       new Set(
         velocitySteps.map(
           (velocity) =>
             Math.max(
               -this.moveSpeed,
               Math.min(
                 this.moveSpeed,
                 velocity,
               ),
             ),
         ),
       ),
     );

   return uniqueVelocities
     .map((velocity) => {
       const clampedVelocity =
         Math.max(
           -this.moveSpeed,
           Math.min(
             this.moveSpeed,
             velocity,
           ),
         );

       const position =
         Math.max(
           0,
           Math.min(
             this.state.width -
             this.state.mario.width,
             startX +
             clampedVelocity *
             deltaTime,
           ),
         );

       return {
         position,
         velocity: clampedVelocity,
         acceleration:
           (clampedVelocity -
             this.marioVelocityX) /
           Math.max(deltaTime, 0.016),
       };
     })
     .filter(
       (candidate) =>
         Math.abs(
           candidate.position -
           startX,
         ) > 0 ||
         Math.abs(candidate.velocity) > 0,
     )
     .slice(0, this.trajectoryCandidateCount);

  }


  private optimizeHorizontalTrajectory(
   startX: number,
   direction: number,
   deltaTime: number,
  ): {
   x: number;
   velocity: number;
   acceleration: number;
  } {

   const candidates =
     this.buildTrajectoryCandidates(
       startX,
       direction,
       deltaTime,
     );

   let best = {
     x: startX,
     velocity: this.marioVelocityX,
     acceleration: this.marioAccelerationX,
     score: Number.NEGATIVE_INFINITY,
   };

   for (
     const candidate of candidates
   ) {

     if (
       !this.isTrajectoryPlannerCandidateValid(
         startX,
         candidate.position,
         direction,
         deltaTime,
       )
     ) {
       continue;
     }

     const predictedX =
       this.validateMotionPath(
         startX,
         candidate.position,
         'x',
       );

     if (
       predictedX !== candidate.position ||
       !this.isMotorMotionFeasible(
         startX,
         candidate.position,
         deltaTime,
       )
     ) {
       continue;
     }

     const score =
       this.scoreTrajectoryCandidate(
         candidate.position,
         startX,
         candidate.velocity,
         candidate.acceleration,
         direction,
       );

     if (
       score > best.score
     ) {

       best = {
         x: candidate.position,
         velocity: candidate.velocity,
         acceleration: candidate.acceleration,
         score,
       };

     }

   }

   if (
     best.x === startX
   ) {

     const fallbackX =
       Math.max(
         0,
         Math.min(
           this.state.width -
           this.state.mario.width,
           startX +
           direction *
           Math.min(
             this.moveSpeed *
             deltaTime,
             this.maxHorizontalStep *
             2,
           ),
         ),
       );

     const fallbackValid =
       this.isTrajectoryPlannerCandidateValid(
         startX,
         fallbackX,
         direction,
         deltaTime,
       ) &&
       this.validateMotionPath(
         startX,
         fallbackX,
         'x',
       ) === fallbackX &&
       this.isMotorMotionFeasible(
         startX,
         fallbackX,
         deltaTime,
       );

     if (fallbackValid) {

       return {
         x: fallbackX,
         velocity:
           direction *
           this.moveSpeed *
           0.85,
         acceleration:
           (direction *
             this.moveSpeed *
             0.85 -
             this.marioVelocityX) /
           Math.max(deltaTime, 0.016),
       };

     }

   }

   return {
     x: best.x,
     velocity: best.velocity,
     acceleration: best.acceleration,
   };

  }


  private isTrajectoryPlannerCandidateValid(
   startX: number,
   targetX: number,
   direction: number,
   deltaTime: number,
  ): boolean {

   if (startX === targetX) {
     return true;
   }

   const span =
     targetX - startX;

   const stepCount =
     Math.max(
       2,
       Math.min(
         this.motionPredictionHorizon,
         Math.ceil(
           Math.abs(span) /
           Math.max(
             this.maxHorizontalStep,
             8,
           ),
         ),
       ),
     );

   let previousX = startX;

   for (
     let step = 1;
     step <= stepCount;
     step++
   ) {

     const sampleX =
       startX +
       span *
       (step / stepCount);

     const deltaX =
       sampleX -
       previousX;

     const jerk =
       Math.abs(deltaX) /
       Math.max(
         deltaTime /
         Math.max(stepCount, 1),
         0.016,
       );

     if (
       jerk >
       this.maxHorizontalJerk
     ) {
       return false;
     }

     const samplePose = {
       ...this.state.mario,
       x: sampleX,
     };

     if (
       !this.isPoseValid(
         samplePose.x,
         samplePose.y,
       ) ||
       this.collidesWithObstacleFromSide(
         samplePose,
       ) ||
       this.estimateDynamicObstacleRisk(
         samplePose,
         step,
         stepCount,
       ) > 0
     ) {
       return false;
     }

     if (
       Math.abs(sampleX - startX) >
       this.moveSpeed *
       deltaTime *
       1.6 &&
       direction *
       (sampleX - startX) < 0
     ) {
       return false;
     }

     previousX = sampleX;
   }

   return true;

  }


  private estimateDynamicObstacleRisk(
   pose: Character,
   step: number,
   stepCount: number,
  ): number {

   const timeFraction =
     step / Math.max(stepCount, 1);

   const thwompPrediction =
     this.predictThwompFutureAt(
       timeFraction,
     );

   const projectedPose: Character = {
     ...pose,
     x: pose.x,
     y: pose.y,
   };

   if (
     !this.overlap(
       projectedPose,
       thwompPrediction,
     )
   ) {
     return 0;
   }

   const overlapArea =
     Math.max(
       0,
       Math.min(
         pose.x + pose.width,
         thwompPrediction.x +
         thwompPrediction.width,
       ) -
       Math.max(
         pose.x,
         thwompPrediction.x,
       ),
     ) *
     Math.max(
       0,
       Math.min(
         pose.y + pose.height,
         thwompPrediction.y +
         thwompPrediction.height,
       ) -
       Math.max(
         pose.y,
         thwompPrediction.y,
       ),
     );

   return overlapArea > 0 ? 1 : 0;

  }


  private predictThwompFutureAt(
   timeFraction: number,
  ): Character {

   // More conservative future prediction: allow the thwomp to continue along
   // its current direction, but account for the reverse point and clamping.
   const projected = { ...this.state.thwomp };

   // Project forward in smaller time slice steps to respect reversal.
   const steps = Math.max(1, Math.ceil(timeFraction * 6));
   let y = this.state.thwomp.y;
   let dir = this.thwompDirection;

   for (let s = 0; s < steps; s++) {
     const frac = (s + 1) / steps * timeFraction;
     y = y + dir * this.thwompSpeed * (frac / timeFraction) * 0.6;

     if (dir > 0 && y >= this.thwompReversePointY) {
       y = this.thwompReversePointY;
       dir = -1;
     }

     y = Math.max(this.thwompTop, Math.min(this.thwompBottom, y));
   }

   projected.y = y;

   return projected;

  }


  private validateMultiStepCandidate(
   startX: number,
   targetX: number,
   direction: number,
   deltaTime: number,
  ): boolean {

   if (startX === targetX) {
     return true;
   }

   const span =
     targetX - startX;

   const stepCount =
     Math.max(
       2,
       Math.ceil(
         Math.abs(span) /
         Math.max(
           this.maxHorizontalStep,
           8,
         ),
       ),
     );

   // Estimate per-step dt to allocate thermal and jerk checks
   const perStepDt = Math.max(deltaTime / stepCount, 0.016);

   let previousX = startX;

   for (
     let step = 1;
     step <= stepCount;
     step++
   ) {

     const sampleX =
       startX +
       span *
       (step / stepCount);

     const samplePose: Character = {
       ...this.state.mario,
       x: sampleX,
     };

     if (
       !this.isPoseValid(
         samplePose.x,
         samplePose.y,
       ) ||
       this.collidesWithObstacleFromSide(
         samplePose,
       )
     ) {
       return false;
     }

     // Calculate small-step kinematics for this segment
     const startG = this.calculateMarioMechanismAtPose({ ...this.state.mario, x: previousX });
     const endG = this.calculateMarioMechanismAtPose(samplePose);

     const leftRate = Math.abs(endG.leftMotorAngle - startG.leftMotorAngle) / perStepDt;
     const rightRate = Math.abs(endG.rightMotorAngle - startG.rightMotorAngle) / perStepDt;

     const leftTorqueDemand = Math.abs(endG.leftMotorAngle - startG.leftMotorAngle) / perStepDt;
     const rightTorqueDemand = Math.abs(endG.rightMotorAngle - startG.rightMotorAngle) / perStepDt;

     const leftCapacity = Math.max(0.01, this.motorTorqueCapacity * (1 - Math.pow(leftRate / this.maxMotorAngularRate, 2)));
     const rightCapacity = Math.max(0.01, this.motorTorqueCapacity * (1 - Math.pow(rightRate / this.maxMotorAngularRate, 2)));

     if (leftTorqueDemand > leftCapacity || rightTorqueDemand > rightCapacity) {
       return false;
     }

     const predictedLeftTemp = this.motorTempLeft + leftTorqueDemand * leftTorqueDemand * this.motorHeatingCoeff * perStepDt;
     const predictedRightTemp = this.motorTempRight + rightTorqueDemand * rightTorqueDemand * this.motorHeatingCoeff * perStepDt;

     if (predictedLeftTemp > this.motorMaxTemp || predictedRightTemp > this.motorMaxTemp) {
       return false;
     }

     // dynamic obstacle check for denser forecasting
     if (this.estimateDynamicObstacleRisk(samplePose, step, stepCount) > 0) {
       return false;
     }

     // Jerk check (per-step)
     const deltaX = sampleX - previousX;
     const jerk = Math.abs(deltaX) / perStepDt;
     if (jerk > this.maxHorizontalJerk) {
       return false;
     }

     previousX = sampleX;
   }

   return true;

  }


  private scoreTrajectoryCandidate(
   candidatePosition: number,
   startX: number,
   candidateVelocity: number,
   candidateAcceleration: number,
   direction: number,
  ): number {

   const progress =
     Math.abs(
       candidatePosition -
       startX,
     );

   const directionalBias =
     direction *
     (candidatePosition -
       startX);

   const velocityMatch =
     direction *
     candidateVelocity;

   const accelerationPenalty =
     Math.abs(candidateAcceleration) /
     (this.maxHorizontalAcceleration * 2);

   const velocityPenalty =
     Math.max(
       0,
       Math.abs(candidateVelocity) -
       this.moveSpeed *
       0.7,
     ) /
     this.moveSpeed;

   return (
     progress *
     7 +
     Math.max(
       0,
       directionalBias,
     ) *
     2.25 +
     Math.max(
       0,
       velocityMatch,
     ) *
     0.08 -
     accelerationPenalty *
     3 -
     velocityPenalty *
     2.5
   );

  }


  private isMotorMotionFeasible(
   fromX: number,
   toX: number,
   deltaTime: number,
  ): boolean {

   const fromPose =
     this.state.mario;

   const candidatePose: Character = {
     ...fromPose,
     x: toX,
   };

   const startGeometry =
     this.calculateMarioMechanismAtPose(
       fromPose,
     );

   const endGeometry =
     this.calculateMarioMechanismAtPose(
       candidatePose,
     );

   const leftRate =
     Math.abs(
       endGeometry.leftMotorAngle -
       startGeometry.leftMotorAngle,
     ) /
     Math.max(deltaTime, 0.016);

   const rightRate =
     Math.abs(
       endGeometry.rightMotorAngle -
       startGeometry.rightMotorAngle,
     ) /
     Math.max(deltaTime, 0.016);

   // Simple torque demand estimate (proportional to angular change speed)
   const leftTorqueDemand =
     Math.abs(
       endGeometry.leftMotorAngle -
       startGeometry.leftMotorAngle,
     ) / Math.max(deltaTime, 0.016);

   const rightTorqueDemand =
     Math.abs(
       endGeometry.rightMotorAngle -
       startGeometry.rightMotorAngle,
     ) / Math.max(deltaTime, 0.016);

   // Capacity reduces with angular rate (simple curve)
   const leftCapacity =
     Math.max(
       0.01,
       this.motorTorqueCapacity *
       (1 - Math.pow(leftRate / this.maxMotorAngularRate, 2)),
     );

   const rightCapacity =
     Math.max(
       0.01,
       this.motorTorqueCapacity *
       (1 - Math.pow(rightRate / this.maxMotorAngularRate, 2)),
     );

   // Thermal prediction (do not apply - just predict)
   const predictedLeftTemp =
     this.motorTempLeft +
     leftTorqueDemand * leftTorqueDemand *
     this.motorHeatingCoeff * Math.max(deltaTime, 0.016);

   const predictedRightTemp =
     this.motorTempRight +
     rightTorqueDemand * rightTorqueDemand *
     this.motorHeatingCoeff * Math.max(deltaTime, 0.016);

   const thermalOk =
     predictedLeftTemp <= this.motorMaxTemp &&
     predictedRightTemp <= this.motorMaxTemp;

   const rateOk =
     leftRate <= this.maxMotorAngularRate &&
     rightRate <= this.maxMotorAngularRate;

   const torqueOk =
     leftTorqueDemand <= leftCapacity &&
     rightTorqueDemand <= rightCapacity;

   return rateOk && torqueOk && thermalOk;

  }


  private validateMotionPath(
   from: number,
   to: number,
   axis: 'x' | 'y',
  ): number {

   if (from === to) {
     return from;
   }


   const delta =
     to - from;

   const stepSize =
     axis === 'x'
       ? this.maxHorizontalStep
       : this.maxVerticalStep;

   const stepCount =
     Math.max(
       1,
       Math.ceil(
         Math.abs(delta) /
         stepSize,
       ),
     );

   const horizon =
     Math.min(
       stepCount,
       this.motionPredictionHorizon,
     );

   const sampleEvery =
     Math.max(
       1,
       Math.ceil(
         stepCount /
         horizon,
       ),
     );


   for (
     let step = 1;
     step <= stepCount;
     step++
   ) {

     if (
       step !== stepCount &&
       step % sampleEvery !== 0 &&
       step !== 1
     ) {
       continue;
     }


     const candidateValue =
       from +
       delta *
       (step / stepCount);

     const x =
       axis === 'x'
         ? candidateValue
         : this.state.mario.x;

     const y =
       axis === 'y'
         ? candidateValue
         : this.state.mario.y;

     if (!this.isPoseValid(x, y)) {
       return from;
     }
   }


   return to;

  }


  private isPoseValid(
   x: number,
   y: number,
  ): boolean {

   const mario: Character = {
     ...this.state.mario,
     x,
     y,
   };

   if (
     mario.x < 0 ||
     mario.x + mario.width >
     this.state.width
   ) {
     return false;
   }

   if (
     mario.y < 0 ||
     mario.y + mario.height >
     this.state.height
   ) {
     return false;
   }

   for (
     const obstacle of this.obstacles
   ) {

     if (
       this.overlap(
         mario,
         obstacle,
       )
     ) {
       return false;
     }
   }

   return this.calculateMarioMechanismAtPose(
     mario,
   ).valid;

  }


  private calculateMarioMechanismAtPose(
   mario: Character,
  ): FiveBarGeometry {

   return this.marioActuator.calculate({
     x:
       mario.x +
       mario.width / 2,
     y:
       mario.y +
       mario.height / 2,
   });

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

import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
} from '@angular/core';

import {
  CommonModule,
} from '@angular/common';

import {
  GameEngine,
} from './game/game.engine';

import {
  InputState,
  Rect,
  Point,
} from './game/types';

import {
  FiveBarActuator,
} from './game/five-bar-actuator';


@Component({
  selector: 'app-root',

  standalone: true,

  imports: [
    CommonModule,
  ],

  templateUrl: './app.html',

  styleUrl: './app.css',
})
export class App implements OnDestroy {

  readonly engine =
    new GameEngine();


  showMechanisms =
    true;


  /*
   * ============================================================
   * DEBUG RECTANGLES
   * ============================================================
   */

  readonly sceneBounds: Rect = {

    x: 50,

    y: 50,

    width: 400,

    height: 400,
  };


  readonly jointBounds: Rect =
    this.engine.thwompJointBounds;


  /*
   * ============================================================
   * BASE DRAGGING
   * ============================================================
   */

  private draggingBase:
    Point | null = null;

  private draggingBaseElement:
    Element | null = null;


  /*
   * ============================================================
   * THWOMP DRAGGING
   * ============================================================
   */

  private draggingThwomp =
    false;

  private draggingThwompElement:
    Element | null = null;


  /*
   * ============================================================
   * GAME LOOP
   * ============================================================
   */

  private animationFrameId:
    number | null = null;

  private lastTime =
    0;


  private input: InputState = {

    left: false,

    right: false,

    jumpPressed: false,
  };


  constructor(
    private readonly changeDetector:
      ChangeDetectorRef,
  ) {

    window.addEventListener(
      'keydown',
      this.onKeyDown,
    );

    window.addEventListener(
      'keyup',
      this.onKeyUp,
    );

    this.startLoop();
  }


  /*
   * ============================================================
   * BUTTONS
   * ============================================================
   */

  start(): void {

    this.engine.start();
  }


  reset(): void {

    this.engine.reset();
  }


  /*
   * ============================================================
   * DEBUG CONTROLS
   * ============================================================
   */

  updateRect(
    rect: Rect,
    property: keyof Rect,
    event: Event,
  ): void {

    const input =
      event.target as HTMLInputElement;

    const value =
      Number(input.value);

    if (
      Number.isFinite(value)
    ) {

      rect[property] =
        value;
    }
  }


  updateArmLength(
    actuator: FiveBarActuator,
    property:
      'upperArm'
      | 'lowerArm',
    event: Event,
  ): void {

    const input =
      event.target as HTMLInputElement;

    const value =
      Number(input.value);

    if (
      Number.isFinite(value) &&
      value > 0
    ) {

      actuator.params[property] =
        value;
    }
  }


  toggleMechanisms(): void {

    this.showMechanisms =
      !this.showMechanisms;
  }


  toggleThwompAutoplay(): void {

    this.engine.thwompAutoplay =
      !this.engine.thwompAutoplay;
  }


  /*
   * ============================================================
   * BASE MOTOR DRAG
   * ============================================================
   */

  onBasePointerDown(
    event: PointerEvent,
    point: Point,
  ): void {

    event.preventDefault();

    event.stopPropagation();


    this.draggingBase =
      point;

    this.draggingBaseElement =
      event.currentTarget as Element;


    this.draggingBaseElement.setPointerCapture(
      event.pointerId,
    );
  }


  onBasePointerMove(
    event: PointerEvent,
  ): void {

    if (
      this.draggingBase === null
    ) {

      return;
    }


    const element =
      event.currentTarget as SVGGraphicsElement;

    const svg =
      element.ownerSVGElement;

    if (!svg) {

      return;
    }


    const point =
      this.svgPoint(
        svg,
        event.clientX,
        event.clientY,
      );


    this.draggingBase.x =
      point.x;

    this.draggingBase.y =
      point.y;
  }


  onBasePointerUp(
    event: PointerEvent,
  ): void {

    const element =
      this.draggingBaseElement;


    if (
      element !== null &&
      element.hasPointerCapture(
        event.pointerId,
      )
    ) {

      element.releasePointerCapture(
        event.pointerId,
      );
    }


    this.draggingBase =
      null;

    this.draggingBaseElement =
      null;
  }


  /*
   * ============================================================
   * THWOMP DRAG
   * ============================================================
   */

  onThwompPointerDown(
    event: PointerEvent,
  ): void {

    if (
      this.engine.thwompAutoplay
    ) {

      return;
    }


    event.preventDefault();

    event.stopPropagation();


    this.draggingThwomp =
      true;

    this.draggingThwompElement =
      event.currentTarget as Element;


    this.draggingThwompElement.setPointerCapture(
      event.pointerId,
    );
  }


  onThwompPointerMove(
    event: PointerEvent,
  ): void {

    if (
      !this.draggingThwomp ||
      this.engine.thwompAutoplay
    ) {

      return;
    }


    const element =
      event.currentTarget as SVGGraphicsElement;

    const svg =
      element.ownerSVGElement;

    if (!svg) {

      return;
    }


    const point =
      this.svgPoint(
        svg,
        event.clientX,
        event.clientY,
      );


    this.engine.setThwompCenter(
      point.x,
      point.y,
    );
  }


  onThwompPointerUp(
    event: PointerEvent,
  ): void {

    this.draggingThwomp =
      false;


    const element =
      this.draggingThwompElement;


    if (
      element !== null &&
      element.hasPointerCapture(
        event.pointerId,
      )
    ) {

      element.releasePointerCapture(
        event.pointerId,
      );
    }


    this.draggingThwompElement =
      null;
  }


  /*
   * ============================================================
   * SVG COORDINATES
   * ============================================================
   */

  private svgPoint(
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
  ): Point {

    const point =
      svg.createSVGPoint();


    point.x =
      clientX;

    point.y =
      clientY;


    const ctm =
      svg.getScreenCTM();


    if (!ctm) {

      return {

        x: 0,

        y: 0,
      };
    }


    const transformed =
      point.matrixTransform(
        ctm.inverse(),
      );


    return {

      x:
        transformed.x,

      y:
        transformed.y,
    };
  }


  /*
   * ============================================================
   * GAME LOOP
   * ============================================================
   */

  private startLoop(): void {

    if (
      this.animationFrameId !== null
    ) {

      return;
    }


    this.lastTime =
      performance.now();


    const frame = (
      time: number,
    ): void => {

      const deltaTime =
        Math.min(
          (
            time -
            this.lastTime
          ) / 1000,

          0.05,
        );


      this.lastTime =
        time;


      this.engine.update(
        deltaTime,
        this.input,
      );


      this.changeDetector.detectChanges();


      this.animationFrameId =
        requestAnimationFrame(
          frame,
        );
    };


    this.animationFrameId =
      requestAnimationFrame(
        frame,
      );
  }


  /*
   * ============================================================
   * KEYBOARD
   * ============================================================
   */

  private onKeyDown = (
    event: KeyboardEvent,
  ): void => {

    switch (event.code) {

      case 'ArrowLeft':
      case 'KeyA':

        this.input.left =
          true;

        event.preventDefault();

        break;


      case 'ArrowRight':
      case 'KeyD':

        this.input.right =
          true;

        event.preventDefault();

        break;


      case 'Space':

        if (
          !event.repeat
        ) {

          this.input.jumpPressed =
            true;
        }

        event.preventDefault();

        break;


      case 'KeyR':

        this.engine.reset();

        event.preventDefault();

        break;
    }
  };


  private onKeyUp = (
    event: KeyboardEvent,
  ): void => {

    switch (event.code) {

      case 'ArrowLeft':
      case 'KeyA':

        this.input.left =
          false;

        event.preventDefault();

        break;


      case 'ArrowRight':
      case 'KeyD':

        this.input.right =
          false;

        event.preventDefault();

        break;


      case 'Space':

        this.input.jumpPressed =
          false;

        event.preventDefault();

        break;
    }
  };


  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */

  ngOnDestroy(): void {

    if (
      this.animationFrameId !== null
    ) {

      cancelAnimationFrame(
        this.animationFrameId,
      );

      this.animationFrameId =
        null;
    }


    window.removeEventListener(
      'keydown',
      this.onKeyDown,
    );

    window.removeEventListener(
      'keyup',
      this.onKeyUp,
    );
  }
}

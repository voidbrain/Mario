import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngine } from './game/game.engine';
import { InputState, Rect, Point } from './game/types';
import { FiveBarActuator } from './game/five-bar-actuator';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  readonly engine = new GameEngine();

  readonly showMechanisms = signal(true);

  // Debug rectangles.

  readonly sceneBounds: Rect = {
    x: 50,
    y: 50,
    width: 400,
    height: 400,
  };
  readonly jointBounds: Rect = this.engine.thwompJointBounds;

  // Base dragging.

  // Thwomp dragging.

  private draggingThwomp = false;
  private draggingThwompElement: Element | null = null;

  // Game loop.

  private animationFrameId: number | null = null;
  private lastTime = 0;
  private input: InputState = {
    left: false,
    right: false,
    jumpPressed: false,
  };

  private readonly changeDetector = inject(ChangeDetectorRef);

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onFocusLost);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.startLoop();
  }

  // Buttons.

  start(): void {
    this.clearInput();
    this.engine.start();
  }

  reset(): void {
    this.clearInput();
    this.engine.reset();
  }

  // Debug controls.

  updateRect(rect: Rect, property: keyof Rect, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);

    if (this.engine.state.status === 'playing') return;
    if (Number.isFinite(value) && ((property !== 'width' && property !== 'height') || value > 0)) {
      rect[property] = value;
    }
  }

  updateArmLength(
    actuator: FiveBarActuator,
    property: 'upperArm' | 'lowerArm',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;

    const value = Number(input.value);

    if (this.engine.state.status === 'playing') return;
    if (Number.isFinite(value) && value > 0) {
      actuator.params[property] = value;
    }
  }

  toggleMechanisms(): void {
    this.showMechanisms.update(value => !value);
  }

  toggleThwompAutoplay(): void {
    this.engine.thwompAutoplay = !this.engine.thwompAutoplay;
  }

  // Base motor drag.

  onThwompPointerDown(event: PointerEvent): void {
    if (this.engine.thwompAutoplay) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.draggingThwomp = true;
    this.draggingThwompElement = event.currentTarget as Element;
    this.draggingThwompElement.setPointerCapture(event.pointerId);
  }

  onThwompPointerMove(event: PointerEvent): void {
    if (!this.draggingThwomp || this.engine.thwompAutoplay) {
      return;
    }

    const element = event.currentTarget as SVGGraphicsElement;
    const svg = element.ownerSVGElement;

    if (!svg) {
      return;
    }

    const point = this.svgPoint(svg, event.clientX, event.clientY);
    this.engine.setThwompCenter(point.x, point.y);
  }

  onThwompPointerUp(event: PointerEvent): void {
    this.draggingThwomp = false;

    const element = this.draggingThwompElement;
    if (element !== null && element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    this.draggingThwompElement = null;
  }

  // Svg coordinates.

  private svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;

    const ctm = svg.getScreenCTM();

    if (!ctm) {
      return {
        x: 0,
        y: 0,
      };
    }

    const transformed = point.matrixTransform(ctm.inverse());

    return {
      x: transformed.x,
      y: transformed.y,
    };
  }

  // Game loop.

  private startLoop(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    this.lastTime = performance.now();

    const frame = (time: number): void => {
      const deltaTime = (time - this.lastTime) / 1000;

      this.lastTime = time;
      this.engine.update(deltaTime, this.input);
      this.changeDetector.detectChanges();
      this.animationFrameId = requestAnimationFrame(frame);
    };
    this.animationFrameId = requestAnimationFrame(frame);
  }

  // Keyboard.

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.engine.stop();
      this.clearInput();
      event.preventDefault();
      return;
    }
    if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select, button') || event.target.isContentEditable)) return;
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = true;

        event.preventDefault();

        break;

      case 'ArrowRight':
      case 'KeyD':
        this.input.right = true;

        event.preventDefault();

        break;

      case 'Space':
        if (!event.repeat && this.engine.state.status === 'ready') {
          this.start();
        } else if (!event.repeat) {
          this.input.jumpPressed = true;
        }

        event.preventDefault();

        break;

      case 'KeyR':
        this.reset();

        event.preventDefault();

        break;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = false;

        event.preventDefault();

        break;

      case 'ArrowRight':
      case 'KeyD':
        this.input.right = false;

        event.preventDefault();

        break;

      case 'Space':
        this.input.jumpPressed = false;

        event.preventDefault();

        break;
    }
  };

  // Cleanup.

  private clearInput(): void {
    this.input = { left: false, right: false, jumpPressed: false };
    this.draggingThwomp = false;
  }

  private onFocusLost = (): void => {
    this.clearInput();
    if (this.engine.state.status === 'playing') this.engine.stop('Focus lost');
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.onFocusLost();
  };

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onFocusLost);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}

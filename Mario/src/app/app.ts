import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  GameEngine,
} from './game/game.engine';

import {
  InputState,
} from './game/types';


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


  showMechanisms = true;


  private animationFrameId:
    number | null = null;

  private lastTime = 0;


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


  start(): void {

    this.engine.start();
  }


  reset(): void {

    this.engine.reset();
  }


  toggleMechanisms(): void {

    this.showMechanisms =
      !this.showMechanisms;
  }


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
        (time - this.lastTime) / 1000,
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
      requestAnimationFrame(frame);
  };


  this.animationFrameId =
    requestAnimationFrame(frame);
}


  private onKeyDown = (
    event: KeyboardEvent,
  ): void => {

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

        if (!event.repeat) {

          this.input.jumpPressed = true;

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


  ngOnDestroy(): void {

    if (
      this.animationFrameId !== null
    ) {

      cancelAnimationFrame(
        this.animationFrameId,
      );

      this.animationFrameId = null;
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

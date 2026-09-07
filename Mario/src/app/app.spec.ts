import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { GameEngine } from './game/game.engine';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the page title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Mario — 5-Bar Actuator');
  });

  it('should wait for Start before moving the thwomp', () => {
    const engine = new GameEngine();
    const startY = engine.state.thwomp.y;

    engine.update(0.1, {
      left: false,
      right: false,
      jumpPressed: false,
    });

    expect(engine.state.status).toBe('ready');
    expect(engine.state.thwomp.y).toBe(startY);

    engine.start();
    const yAfterStart = engine.state.thwomp.y;

    engine.update(0.1, {
      left: false,
      right: false,
      jumpPressed: false,
    });

    expect(engine.state.status).toBe('playing');
    expect(engine.state.thwomp.y).not.toBe(yAfterStart);
  });
});

import { Character, GameState, InputState, Rect, FiveBarGeometry, Point } from './types';
import { FiveBarActuator } from './five-bar-actuator';
import { overlap } from './geometry';
import { checkMotion, MotorVelocity } from './motion-guard';
import { MOTION } from './motion-profile';

const nodeLimit = () => ({ north: false, south: false, west: false, east: false, motor: false, singularity: false });
const physicalLimit = () => ({ invalid: false, left: nodeLimit(), right: nodeLimit() });
type Actor = 'mario' | 'thwomp';

/** Deterministic simulation only. This class never sends commands to motors. */
export class GameEngine {
  readonly state: GameState = {
    width: 520, height: 600, status: 'ready',
    mario: { id: 'mario', x: 10, y: 380, width: 34, height: 48 },
    thwomp: { id: 'thwomp', x: 380, y: 100, width: 80, height: 80 },
    physicalLimit: { mario: physicalLimit(), thwomp: physicalLimit() },
  };
  readonly obstacles: Rect[] = [
    { x: 170, y: 350, width: 70, height: 30 },
    { x: 300, y: 320, width: 90, height: 52 },
    { x: 410, y: 350, width: 70, height: 30 },
  ];
  readonly characterBounds: Rect = { x: 0, y: 0, width: 520, height: 600 };
  readonly jointBounds: Rect = { x: 0, y: 0, width: 520, height: 428 };
  readonly marioBounds = { ...this.characterBounds };
  readonly thwompBounds = { ...this.characterBounds };
  readonly marioJointBounds = { ...this.jointBounds };
  readonly thwompJointBounds = { ...this.jointBounds };
  // Broad SIMULATION envelopes, radians in screen coordinates (Y down).
  // Replace only after measuring calibrated hardware stops and clearance margins.
  readonly marioActuator = new FiveBarActuator(this.marioBounds, this.marioJointBounds, {
    upperArm: 180, lowerArm: 180, baseLeft: { x: 185, y: 240 }, baseRight: { x: 335, y: 240 },
    motorLimits: { leftMin: 0, leftMax: -0.5, rightMin: -3, rightMax: 3 }, singularityMargin: 0.1,
  });
  readonly thwompActuator = new FiveBarActuator(this.thwompBounds, this.thwompJointBounds, {
    upperArm: 160, lowerArm: 160, baseLeft: { x: 180, y: 220 }, baseRight: { x: 340, y: 220 },
    motorLimits: { leftMin: -1.6, leftMax: Math.PI, rightMin: -Math.PI, rightMax: 1.6 }, singularityMargin: 0.1,
  });
  marioMechanism!: FiveBarGeometry;
  thwompMechanism!: FiveBarGeometry;
  faultReason = '';
  private autoplay = false;
  private accumulator = 0;
  private jumpQueued = false;
  private jumpHeld = false;
  private jumpTarget: number | null = null;
  private thwompDirection = 1;
  private manualTarget: Point | null = null;
  private velocities: Record<Actor, Point> = { mario: { x: 0, y: 0 }, thwomp: { x: 0, y: 0 } };
  private motorVelocities: Record<Actor, MotorVelocity> = { mario: { left: 0, right: 0 }, thwomp: { left: 0, right: 0 } };

  constructor() { this.updateActuators(); }

  get thwompAutoplay(): boolean { return this.autoplay; }
  set thwompAutoplay(enabled: boolean) {
    if (this.state.status !== 'playing') return;
    this.autoplay = enabled;
    this.manualTarget = null;
  }

  start(): void {
    if (this.state.status !== 'ready') return;
    this.updateActuators();
    if (!this.marioMechanism.valid || !this.thwompMechanism.valid ||
      overlap(this.state.mario, this.state.thwomp) ||
      this.obstacles.some(o => overlap(o, this.state.mario) || overlap(o, this.state.thwomp))) {
      this.stop('Invalid starting configuration');
      return;
    }
    this.state.status = 'playing';
    this.autoplay = true;
  }

  /** Recreates virtual poses only. NEVER use this as physical homing. */
  reset(): void {
    this.state.status = 'ready';
    Object.assign(this.state.mario, { x: 10, y: 380 });
    Object.assign(this.state.thwomp, { x: 380, y: 100 });
    this.faultReason = '';
    this.autoplay = false;
    this.manualTarget = null;
    this.accumulator = 0;
    this.jumpTarget = null;
    this.jumpQueued = this.jumpHeld = false;
    this.thwompDirection = 1;
    for (const actor of ['mario', 'thwomp'] as const) {
      this.velocities[actor] = { x: 0, y: 0 };
      this.motorVelocities[actor] = { left: 0, right: 0 };
    }
    this.updateActuators();
  }

  stop(reason = 'Operator stop'): void {
    this.state.status = 'fault';
    this.faultReason = reason;
    this.autoplay = false;
    this.manualTarget = null;
    this.jumpQueued = false;
    this.accumulator = 0;
  }

  /** Queues a target; pointer events cannot teleport the mechanism. */
  setThwompCenter(x: number, y: number): void {
    if (this.autoplay || this.state.status !== 'playing') return;
    if (![x, y].every(Number.isFinite)) { this.stop('Invalid manual target'); return; }
    const target = { x: x - this.state.thwomp.width / 2, y: y - this.state.thwomp.height / 2 };
    if (!this.thwompActuator.calculate({ x, y }).valid ||
      target.x < 0 || target.y < 0 || target.x + 80 > 520 || target.y + 80 > 600 ||
      this.obstacles.some(o => overlap({ ...this.state.thwomp, ...target }, o))) {
      this.stop('Manual target outside safe workspace'); return;
    }
    this.manualTarget = target;
  }

  update(deltaTime: number, input: InputState): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0 || deltaTime > MOTION.watchdogSeconds) {
      if (this.state.status === 'playing') this.stop('Timing watchdog: explicit reset required');
      return;
    }
    if (this.state.status !== 'playing') return;
    this.jumpQueued ||= input.jumpPressed && !this.jumpHeld;
    this.jumpHeld = input.jumpPressed;
    this.accumulator += deltaTime;
    while (this.accumulator + 1e-9 >= MOTION.stepSeconds && this.state.status === 'playing') {
      this.accumulator -= MOTION.stepSeconds;
      this.step(MOTION.stepSeconds, input);
    }
  }

  private step(dt: number, input: InputState): void {
    this.updateActuators();
    if (!this.marioMechanism.valid || !this.thwompMechanism.valid) { this.stop('Configuration or current pose invalid'); return; }
    this.updateMario(dt, input);
    if (this.state.status !== 'playing') return;
    this.updateThwomp(dt);
    this.updateActuators();
    if (this.state.status !== 'playing') return;
    if (overlap(this.state.mario, this.state.thwomp)) {
      this.state.status = 'dead'; this.autoplay = false;
    } else if (this.state.mario.x >= this.state.width - 60) {
      this.state.status = 'won'; this.autoplay = false;
    }
  }

  private updateMario(dt: number, input: InputState): void {
    const m = this.state.mario;
    const supported = Math.abs(m.y + m.height - 428) < 1e-6 || this.obstacles.some(o =>
      Math.abs(m.y + m.height - o.y) < 1e-6 && m.x < o.x + o.width && m.x + m.width > o.x);
    if (this.jumpQueued && supported && this.jumpTarget === null) this.jumpTarget = m.y - MOTION.jumpHeight;
    this.jumpQueued = false;
    const vx = this.ramp(this.velocities.mario.x, (Number(input.right) - Number(input.left)) * MOTION.marioSpeed, dt);
    let vy: number;
    if (this.jumpTarget !== null) {
      const distance = m.y - this.jumpTarget;
      if (distance <= 0.5 && Math.abs(this.velocities.mario.y) < 15) this.jumpTarget = null;
      vy = this.ramp(this.velocities.mario.y, this.jumpTarget === null ? 0 : -Math.min(MOTION.verticalSpeed, Math.sqrt(2 * MOTION.acceleration * Math.max(0, distance))), dt);
    } else {
      let landingY = 380;
      for (const o of this.obstacles) {
        if (m.x < o.x + o.width && m.x + m.width > o.x && m.y + m.height <= o.y + 1e-6)
          landingY = Math.min(landingY, o.y - m.height);
      }
      const distance = Math.max(0, landingY - m.y);
      vy = this.ramp(this.velocities.mario.y, supported ? 0 : Math.min(MOTION.verticalSpeed, Math.sqrt(MOTION.acceleration * distance)), dt);
    }
    let x = Math.max(0, Math.min(520 - m.width, m.x + vx * dt));
    if (this.obstacles.some(o => overlap({ ...m, x }, o))) x = m.x;
    let y = m.y + vy * dt;
    for (const o of [...this.obstacles, { x: 0, y: 428, width: 520, height: 172 }]) {
      if (x >= o.x + o.width || x + m.width <= o.x) continue;
      if (vy >= 0 && m.y + m.height <= o.y + 1e-6 && y + m.height >= o.y) y = Math.min(y, o.y - m.height);
      if (vy < 0 && m.y >= o.y + o.height && y <= o.y + o.height) {
        y = o.y + o.height; this.jumpTarget = null;
      }
    }
    this.move('mario', { x, y }, dt);
  }

  private updateThwomp(dt: number): void {
    const t = this.state.thwomp;
    let target = this.manualTarget;
    if (this.autoplay) {
      let bottom = 300;
      for (const o of this.obstacles) {
        if (t.x < o.x + o.width && t.x + t.width > o.x && o.y >= t.y + t.height - 1e-6) bottom = Math.min(bottom, o.y - t.height - 2);
      }
      const y = this.thwompDirection > 0 ? bottom : 100;
      if (Math.abs(t.y - y) < 0.01 && Math.abs(this.velocities.thwomp.y) < 1) this.thwompDirection *= -1;
      target = { x: t.x, y };
    }
    const velocity = this.velocities.thwomp;
    const next = { x: t.x, y: t.y };
    for (const axis of ['x', 'y'] as const) {
      const distance = target === null ? 0 : target[axis] - t[axis];
      const desired = Math.sign(distance) * Math.min(MOTION.thwompSpeed, Math.sqrt(MOTION.acceleration * Math.abs(distance)));
      const speed = this.ramp(velocity[axis], desired, dt);
      next[axis] += speed * dt;
    }
    this.move('thwomp', next, dt);
  }

  private move(actor: Actor, target: Point, dt: number): void {
    const character = this.state[actor];
    const actuator = actor === 'mario' ? this.marioActuator : this.thwompActuator;
    const check = checkMotion(actuator, character, target, dt, this.motorVelocities[actor], [...this.obstacles, this.state[actor === 'mario' ? 'thwomp' : 'mario']], this.velocities[actor]);
    if (!check.ok) { this.stop(`${actor}: ${check.reason}`); return; }
    this.velocities[actor] = { x: (target.x - character.x) / dt, y: (target.y - character.y) / dt };
    this.motorVelocities[actor] = check.velocity;
    Object.assign(character, target);
  }

  private ramp(current: number, target: number, dt: number): number {
    const change = MOTION.acceleration * dt;
    return current + Math.max(-change, Math.min(change, target - current));
  }

  private updateActuators(): void {
    const center = (c: Character): Point => ({ x: c.x + c.width / 2, y: c.y + c.height / 2 });
    this.marioMechanism = this.marioActuator.calculate(center(this.state.mario));
    this.thwompMechanism = this.thwompActuator.calculate(center(this.state.thwomp));
    this.state.physicalLimit.mario = this.marioActuator.physicalLimits(this.marioMechanism);
    this.state.physicalLimit.thwomp = this.thwompActuator.physicalLimits(this.thwompMechanism);
  }
}

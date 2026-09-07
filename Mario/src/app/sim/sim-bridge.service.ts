/* SimBridge service
 * - Starts the sim worker
 * - Exposes a minimal API: start, stop, createBody, setBodyVelocity, setBodyPosition, setMotor
 * - Allows registration of a state callback
 */

export class SimBridge {
  private worker: Worker | null = null;
  private stateCallback: ((s: any) => void) | null = null;
  private inited = false;
  private running = false;
  private lastState: any = null;
  private initedResolve: (() => void) | null = null;
  private initedReject: ((err?: any) => void) | null = null;
  private errorCallback: ((err: any) => void) | null = null;
  private scale = 100; // pixels per meter by default

  /**
   * Start the worker and return a promise that resolves when the worker posts 'inited'
   */
  start(config?: { scale?: number; timeStep?: number; publishHz?: number; ambientTemp?: number; timeoutMs?: number; }): Promise<void> {
    if (this.worker) {
      return Promise.resolve();
    }

    if (config && typeof config.scale === 'number') this.scale = config.scale;

    // Helper to wire a newly created worker
    const wireWorker = (w: Worker) => {
      this.worker = w;
      this.worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data || {};
        if (!msg || !msg.type) return;
        switch (msg.type) {
          case 'inited':
            this.inited = true;
            if (this.initedResolve) {
              this.initedResolve();
              this.initedResolve = null;
              this.initedReject = null;
            }
            break;
          case 'createdBody':
            // ignore
            break;
          case 'createdJoint':
            // ignore
            break;
          case 'started':
            this.running = true;
            break;
          case 'stopped':
            this.running = false;
            break;
          case 'state':
            this.lastState = msg;
            if (this.stateCallback) this.stateCallback(msg);
            break;
          case 'error':
            // worker-internal error reported
            if (this.errorCallback) this.errorCallback(msg.error);
            break;
          default:
            break;
        }
      };

      this.worker.onerror = (err) => {
        if (this.initedReject) {
          this.initedReject(err);
          this.initedResolve = null;
          this.initedReject = null;
        }
        if (this.errorCallback) this.errorCallback(err);
        // fallback stop
        this.stop();
      };
    };

    // First try the standard module worker (bundler emitted)
    try {
      // @ts-ignore
      const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
      wireWorker(w);
      // send initial init; the worker replies with 'inited' when ready
      this.post({ type: 'init', config: { timeStep: config?.timeStep || 1 / 120, publishHz: config?.publishHz || 60, ambientTemp: config?.ambientTemp || 25 } });
    } catch (e) {
      // If creation failed (likely bundler didn't emit worker), fall back to Blob-based inlined worker
      try {
        const workerSrc = `
          // inlined module worker: simple five-bar emulation
          const FIVE_BARS = {};
          let running = false;
          let lastT = null;
          let stepMs = ${1000 / (config?.timeStep ? 1 / config.timeStep : 120)};
          let publishMs = ${1000 / (config?.publishHz || 60)};
          let publishAccum = 0;
          let ambientTemp = ${config?.ambientTemp || 25};

          function now() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

          function createFiveBarInternal(id, cfg) {
            // cfg: baseLeft{ x,y }, baseRight{ x,y }, effector{x,y}, upperArm, lowerArm
            const fb = {
              id,
              baseLeft: cfg.baseLeft,
              baseRight: cfg.baseRight,
              effector: cfg.effector,
              upperArm: cfg.upperArm,
              lowerArm: cfg.lowerArm,
              payloadSize: cfg.payloadSize || { w: 0.3, h: 0.3 },
              motors: {
                baseLeft: { desiredAngle: 0, speed: 0, maxTorque: (cfg.motor && cfg.motor.maxTorque) || 5, maxSpeed: (cfg.motor && cfg.motor.maxSpeed) || 20, kP: (cfg.motor && cfg.motor.kP) || 80, kD: (cfg.motor && cfg.motor.kD) || 2, temp: (cfg.motor && cfg.motor.initTemp) || ambientTemp, }
                ,
                baseRight: { desiredAngle: 0, speed: 0, maxTorque: (cfg.motor && cfg.motor.maxTorque) || 5, maxSpeed: (cfg.motor && cfg.motor.maxSpeed) || 20, kP: (cfg.motor && cfg.motor.kP) || 80, kD: (cfg.motor && cfg.motor.kD) || 2, temp: (cfg.motor && cfg.motor.initTemp) || ambientTemp, }
              },
              // joint states
              leftAngle: 0,
              rightAngle: 0,
              leftSpeed: 0,
              rightSpeed: 0,
              mass: 1,
              inertia: 0.02,
            };

            // initialize angles to point roughly at effector
            fb.leftAngle = Math.atan2(fb.effector.y - fb.baseLeft.y, fb.effector.x - fb.baseLeft.x);
            fb.rightAngle = Math.atan2(fb.effector.y - fb.baseRight.y, fb.effector.x - fb.baseRight.x);
            FIVE_BARS[id] = fb;
            return fb;
          }

          function forwardKinematics(fb) {
            // compute left end and right end positions
            const lx = fb.baseLeft.x + Math.cos(fb.leftAngle) * fb.upperArm;
            const ly = fb.baseLeft.y + Math.sin(fb.leftAngle) * fb.upperArm;
            const rx = fb.baseRight.x + Math.cos(fb.rightAngle) * fb.upperArm;
            const ry = fb.baseRight.y + Math.sin(fb.rightAngle) * fb.upperArm;
            // payload position as midpoint (approx)
            const px = (lx + rx) / 2;
            const py = (ly + ry) / 2;
            return { x: px, y: py };
          }

          function step(dt) {
            Object.keys(FIVE_BARS).forEach((id) => {
              const fb = FIVE_BARS[id];
              // motors: compute torque via PD
              ['baseLeft','baseRight'].forEach((mKey) => {
                const motor = fb.motors[mKey];
                const curAngle = mKey === 'baseLeft' ? fb.leftAngle : fb.rightAngle;
                const curSpeed = mKey === 'baseLeft' ? fb.leftSpeed : fb.rightSpeed;
                const angleError = motor.desiredAngle - curAngle;
                const speedError = motor.desiredSpeed - curSpeed;
                let torque = motor.kP * angleError + motor.kD * speedError;
                // clamp
                const maxT = motor.maxTorque || 0.001;
                if (torque > maxT) torque = maxT;
                if (torque < -maxT) torque = -maxT;

                // simple angular acceleration: torque / inertia
                const angAcc = torque / fb.inertia;
                if (mKey === 'baseLeft') {
                  fb.leftSpeed += angAcc * dt;
                  fb.leftAngle += fb.leftSpeed * dt;
                } else {
                  fb.rightSpeed += angAcc * dt;
                  fb.rightAngle += fb.rightSpeed * dt;
                }

                // thermal
                const heatingCoeff = 0.01;
                const coolingCoeff = 0.05;
                motor.temp += (torque * torque) * heatingCoeff * dt;
                motor.temp += -coolingCoeff * (motor.temp - ambientTemp) * dt;
                motor.temp = Math.max(ambientTemp, Math.min(200, motor.temp));
              });
            });
          }

          function publish() {
            const bodies = {};
            const motors = {};
            Object.keys(FIVE_BARS).forEach((id) => {
              const fb = FIVE_BARS[id];
              const eff = forwardKinematics(fb);
              bodies[id + '-payload'] = { x: eff.x, y: eff.y, angle: 0, vx: 0, vy: 0, av: 0 };
              motors[id + '-baseLeftJoint'] = { desiredAngle: fb.motors.baseLeft.desiredAngle, desiredSpeed: fb.motors.baseLeft.desiredSpeed, temp: fb.motors.baseLeft.temp, maxTorque: fb.motors.baseLeft.maxTorque };
              motors[id + '-baseRightJoint'] = { desiredAngle: fb.motors.baseRight.desiredAngle, desiredSpeed: fb.motors.baseRight.desiredSpeed, temp: fb.motors.baseRight.temp, maxTorque: fb.motors.baseRight.maxTorque };
            });
            postMessage({ type: 'state', t: now() / 1000, bodies, joints: {}, motors });
          }

          let loopId = null;
          function runLoop() {
            if (!running) return;
            const t = now();
            if (!lastT) lastT = t;
            let dt = Math.min((t - lastT) / 1000, 0.05);
            lastT = t;
            step(dt);
            publishAccum += (dt * 1000);
            if (publishAccum >= publishMs) {
              publish();
              publishAccum = 0;
            }
            loopId = setTimeout(runLoop, 0);
          }

          onmessage = (ev) => {
            const msg = ev.data || {};
            try {
              switch (msg.type) {
                case 'init': {
                  // config: timeStep, publishHz, ambientTemp
                  if (msg.config) {
                    if (msg.config.timeStep) stepMs = 1000 / (1 / msg.config.timeStep);
                    if (msg.config.publishHz) publishMs = 1000 / msg.config.publishHz;
                    if (typeof msg.config.ambientTemp === 'number') ambientTemp = msg.config.ambientTemp;
                  }
                  postMessage({ type: 'inited' });
                  break;
                }
                case 'createFiveBar': {
                  createFiveBarInternal(msg.id, msg.config);
                  postMessage({ type: 'createdFiveBar', id: msg.id });
                  break;
                }
                case 'setMotor': {
                  const { id, motor } = msg;
                  if (!id || !motor) break;
                  // id format: '<prefix>-baseLeftJoint' or '-baseRightJoint'
                  const parts = id.split('-');
                  const prefix = parts[0];
                  const fb = FIVE_BARS[prefix];
                  if (!fb) break;
                  if (id.endsWith('baseLeftJoint')) {
                    Object.assign(fb.motors.baseLeft, motor);
                  } else if (id.endsWith('baseRightJoint')) {
                    Object.assign(fb.motors.baseRight, motor);
                  }
                  break;
                }
                case 'start': {
                  if (!running) {
                    running = true;
                    lastT = now();
                    runLoop();
                    postMessage({ type: 'started' });
                  }
                  break;
                }
                case 'stop': {
                  running = false;
                  if (loopId) clearTimeout(loopId);
                  postMessage({ type: 'stopped' });
                  break;
                }
                case 'stepOnce': {
                  const dt = msg.dt || 1 / 120;
                  step(dt);
                  publish();
                  break;
                }
                default:
                  break;
              }
            } catch (err) {
              postMessage({ type: 'error', error: { message: err && err.message ? err.message : String(err), stack: err && err.stack ? err.stack : null } });
            }
          }`;

        const blob = new Blob([workerSrc], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const w = new Worker(url, { type: 'module' });
        wireWorker(w);
        // send init
        this.post({ type: 'init', config: { timeStep: config?.timeStep || 1 / 120, publishHz: config?.publishHz || 60, ambientTemp: config?.ambientTemp || 25 } });
      } catch (err2) {
        // both approaches failed
        if (this.initedReject) this.initedReject(err2);
        return Promise.reject(err2);
      }
    }

    return new Promise<void>((resolve, reject) => {
      this.initedResolve = resolve;
      this.initedReject = reject;
      const timeout = config?.timeoutMs || 2000;
      setTimeout(() => {
        if (!this.inited) {
          if (this.initedReject) this.initedReject(new Error('SimBridge init timeout'));
          // ensure worker stopped
          this.stop();
        }
      }, timeout);
    });
  }

  stop() {
    if (!this.worker) return;
    this.post({ type: 'stop' });
    try {
      this.worker.terminate();
    } catch (e) {
      // ignore
    }
    this.worker = null;
    this.running = false;
    this.inited = false;
  }

  onState(cb: (s: any) => void) {
    this.stateCallback = cb;
  }

  onError(cb: (err: any) => void) {
    this.errorCallback = cb;
  }

  post(msg: any) {
    if (!this.worker) return;
    this.worker.postMessage(msg);
  }

  createBody(id: string, x: number, y: number, box = { w: 1, h: 1 }, dynamic = true) {
    this.post({ type: 'createBody', id, x, y, box, dynamic });
  }

  setBodyVelocity(id: string, vx: number, vy: number) {
    this.post({ type: 'setBodyVelocity', id, vx, vy });
  }

  setBodyPosition(id: string, x: number, y: number) {
    this.post({ type: 'setBodyPosition', id, x, y });
  }

  setBodyTransform(id: string, x: number, y: number, angle = 0) {
    this.post({ type: 'setBodyTransform', id, x, y, angle });
  }

  setMotor(id: string, motor: any) {
    this.post({ type: 'setMotor', id, motor });
  }

  stepOnce(dt?: number) {
    this.post({ type: 'stepOnce', dt });
  }

  /**
   * Create a simplified five-bar in the worker. Positions and sizes are in meters.
   * idPrefix will be used to name bodies/joints: `${idPrefix}-baseLeft`, `${idPrefix}-leftLink`, `${idPrefix}-payload`, etc.
   */
  createFiveBar(idPrefix: string, config: {
    baseLeft: { x: number; y: number };
    baseRight: { x: number; y: number };
    effector: { x: number; y: number };
    upperArm: number; // meters
    lowerArm: number; // meters
    payloadSize?: { w: number; h: number };
    linkThickness?: number;
    motor?: { maxTorque?: number; maxSpeed?: number; kP?: number; kD?: number; initTemp?: number };
  }) {
    const scale = 1; // already in meters
    const pl = (p: { x: number; y: number }) => ({ x: p.x * scale, y: p.y * scale });
    const leftBase = pl(config.baseLeft);
    const rightBase = pl(config.baseRight);
    const eff = pl(config.effector);
    const upper = config.upperArm;
    const lower = config.lowerArm;
    const thickness = config.linkThickness || 0.05;
    const payload = config.payloadSize || { w: 0.3, h: 0.3 };

    // create anchor static bodies
    this.createBody(`${idPrefix}-baseLeft`, leftBase.x, leftBase.y, { w: 0.05, h: 0.05 }, false);
    this.createBody(`${idPrefix}-baseRight`, rightBase.x, rightBase.y, { w: 0.05, h: 0.05 }, false);

    // compute left link position & angle
    const leftVec = { x: eff.x - leftBase.x, y: eff.y - leftBase.y };
    const leftDist = Math.hypot(leftVec.x, leftVec.y);
    const leftAngle = Math.atan2(leftVec.y, leftVec.x);
    const leftLinkLen = Math.min(upper + lower, Math.max(upper * 0.6, leftDist));
    const leftLinkCenter = { x: leftBase.x + (leftVec.x / leftDist) * (leftLinkLen / 2 || 0), y: leftBase.y + (leftVec.y / leftDist) * (leftLinkLen / 2 || 0) };

    this.createBody(`${idPrefix}-leftLink`, leftLinkCenter.x, leftLinkCenter.y, { w: leftLinkLen, h: thickness }, true);

    // compute right link
    const rightVec = { x: eff.x - rightBase.x, y: eff.y - rightBase.y };
    const rightDist = Math.hypot(rightVec.x, rightVec.y);
    const rightAngle = Math.atan2(rightVec.y, rightVec.x);
    const rightLinkLen = Math.min(upper + lower, Math.max(upper * 0.6, rightDist));
    const rightLinkCenter = { x: rightBase.x + (rightVec.x / rightDist) * (rightLinkLen / 2 || 0), y: rightBase.y + (rightVec.y / rightDist) * (rightLinkLen / 2 || 0) };

    this.createBody(`${idPrefix}-rightLink`, rightLinkCenter.x, rightLinkCenter.y, { w: rightLinkLen, h: thickness }, true);

    // create payload body at effector
    this.createBody(`${idPrefix}-payload`, eff.x, eff.y, { w: payload.w, h: payload.h }, true);

    // set transforms for links to align with angle
    this.setBodyTransform(`${idPrefix}-leftLink`, leftLinkCenter.x, leftLinkCenter.y, leftAngle);
    this.setBodyTransform(`${idPrefix}-rightLink`, rightLinkCenter.x, rightLinkCenter.y, rightAngle);

    // create joints: base->link and link->payload
    const motorConfig = config.motor || {};
    this.post({ type: 'createRevoluteJoint', id: `${idPrefix}-baseLeftJoint`, bodyA: `${idPrefix}-baseLeft`, bodyB: `${idPrefix}-leftLink`, anchorA: { x: leftBase.x, y: leftBase.y }, anchorB: null, motor: { desiredAngle: leftAngle, desiredSpeed: 0, maxTorque: motorConfig.maxTorque || 5, maxSpeed: motorConfig.maxSpeed || 20, kP: motorConfig.kP || 50, kD: motorConfig.kD || 1, initTemp: motorConfig.initTemp || 25 } });
    this.post({ type: 'createRevoluteJoint', id: `${idPrefix}-leftPayloadJoint`, bodyA: `${idPrefix}-leftLink`, bodyB: `${idPrefix}-payload`, anchorA: { x: leftBase.x + (leftVec.x / leftDist) * leftLinkLen, y: leftBase.y + (leftVec.y / leftDist) * leftLinkLen }, anchorB: null });

    this.post({ type: 'createRevoluteJoint', id: `${idPrefix}-baseRightJoint`, bodyA: `${idPrefix}-baseRight`, bodyB: `${idPrefix}-rightLink`, anchorA: { x: rightBase.x, y: rightBase.y }, anchorB: null, motor: { desiredAngle: rightAngle, desiredSpeed: 0, maxTorque: motorConfig.maxTorque || 5, maxSpeed: motorConfig.maxSpeed || 20, kP: motorConfig.kP || 50, kD: motorConfig.kD || 1, initTemp: motorConfig.initTemp || 25 } });
    this.post({ type: 'createRevoluteJoint', id: `${idPrefix}-rightPayloadJoint`, bodyA: `${idPrefix}-rightLink`, bodyB: `${idPrefix}-payload`, anchorA: { x: rightBase.x + (rightVec.x / rightDist) * rightLinkLen, y: rightBase.y + (rightVec.y / rightDist) * rightLinkLen }, anchorB: null });

    // small sleep not necessary; worker will publish joints in state updates
  }

  isRunning(): boolean {
    return this.running;
  }

  getLastState(): any {
    return this.lastState;
  }
}

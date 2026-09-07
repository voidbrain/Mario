/* sim.worker.ts
 * Simple Planck.js-based physics worker for short-horizon joint/motion validation.
 * - Runs a fixed-step physics loop (120 Hz)
 * - Exposes a minimal protocol via postMessage
 * - Maintains simple motor models (torque limit, heating/cooling)
 *
 * Messages accepted:
 * { type: 'init', config } - initialize world and bodies
 * { type: 'command', id, payload } - apply commands (e.g., set desired joint targets)
 * { type: 'stepOnce' } - single step (for deterministic stepping tests)
 * { type: 'stop' } - stop the loop
 *
 * Messages posted:
 * { type: 'state', t, bodies, joints, motors } - periodic telemetry
 */

// Use CommonJS-style require because worker build/tooling may expect it; TypeScript build should handle either.
import * as planck from 'planck-js';

type InitConfig = {
  timeStep?: number; // physics step (s)
  publishHz?: number; // how often to post state
  ambientTemp?: number;
};

let world: planck.World | null = null;
let running = false;
let lastTimestamp = 0;
let accumulator = 0;
let stepMs = 1000 / 120; // default to 120Hz
let publishIntervalMs = 1000 / 60; // post state at 60 Hz
let publishAccumulator = 0;
let ambientTemp = 25;

// Minimal scene containers
const bodies: Record<string, planck.Body> = {};
const joints: Record<string, planck.Joint | null> = {};

// Simple motor state per joint
type MotorState = {
  desiredAngle: number;
  desiredSpeed: number;
  maxTorque: number;
  maxSpeed: number; // rad/s
  kP: number;
  kD: number;
  temp: number; // degC
};
const motors: Record<string, MotorState> = {};

function makeWorld() {
  world = new planck.World(planck.Vec2(0, -9.8));
}

const fiveBars: Record<string, any> = {};

function createFiveBarInternal(idPrefix: string, cfg: any) {
  if (!world) return;

  const payload = cfg.payloadSize || { w: 0.3, h: 0.3 };
  const thickness = cfg.linkThickness || 0.05;
  const baseLeft = { x: cfg.baseLeft.x, y: cfg.baseLeft.y };
  const baseRight = { x: cfg.baseRight.x, y: cfg.baseRight.y };
  const effector = { x: cfg.effector.x, y: cfg.effector.y };
  const upper = cfg.upperArm;
  const lower = cfg.lowerArm;

  const leftVec = { x: effector.x - baseLeft.x, y: effector.y - baseLeft.y };
  const leftDist = Math.hypot(leftVec.x, leftVec.y) || 1;
  const leftAngle = Math.atan2(leftVec.y, leftVec.x);
  const leftLinkLen = Math.min(upper + lower, Math.max(upper * 0.6, leftDist));
  const leftLinkCenter = { x: baseLeft.x + (leftVec.x / leftDist) * (leftLinkLen / 2), y: baseLeft.y + (leftVec.y / leftDist) * (leftLinkLen / 2) };

  const rightVec = { x: effector.x - baseRight.x, y: effector.y - baseRight.y };
  const rightDist = Math.hypot(rightVec.x, rightVec.y) || 1;
  const rightAngle = Math.atan2(rightVec.y, rightVec.x);
  const rightLinkLen = Math.min(upper + lower, Math.max(upper * 0.6, rightDist));
  const rightLinkCenter = { x: baseRight.x + (rightVec.x / rightDist) * (rightLinkLen / 2), y: baseRight.y + (rightVec.y / rightDist) * (rightLinkLen / 2) };

  const leftBaseBody = world.createBody({ type: 'static', position: planck.Vec2(baseLeft.x, baseLeft.y) });
  leftBaseBody.createFixture(planck.Box(0.05 / 2, 0.05 / 2), { density: 0 });
  bodies[`${idPrefix}-baseLeft`] = leftBaseBody;

  const rightBaseBody = world.createBody({ type: 'static', position: planck.Vec2(baseRight.x, baseRight.y) });
  rightBaseBody.createFixture(planck.Box(0.05 / 2, 0.05 / 2), { density: 0 });
  bodies[`${idPrefix}-baseRight`] = rightBaseBody;

  const leftLinkBody = world.createBody({ type: 'dynamic', position: planck.Vec2(leftLinkCenter.x, leftLinkCenter.y) });
  leftLinkBody.createFixture(planck.Box(leftLinkLen / 2, thickness / 2), { density: 1.0, friction: 0.3 });
  bodies[`${idPrefix}-leftLink`] = leftLinkBody;

  const rightLinkBody = world.createBody({ type: 'dynamic', position: planck.Vec2(rightLinkCenter.x, rightLinkCenter.y) });
  rightLinkBody.createFixture(planck.Box(rightLinkLen / 2, thickness / 2), { density: 1.0, friction: 0.3 });
  bodies[`${idPrefix}-rightLink`] = rightLinkBody;

  const payloadBody = world.createBody({ type: 'dynamic', position: planck.Vec2(effector.x, effector.y) });
  payloadBody.createFixture(planck.Box(payload.w / 2, payload.h / 2), { density: 1.0, friction: 0.3 });
  bodies[`${idPrefix}-payload`] = payloadBody;

  const leftAnchorA = planck.Vec2(baseLeft.x, baseLeft.y);
  const leftAnchorB = planck.Vec2(leftLinkCenter.x, leftLinkCenter.y);
  const leftJoint = world.createJoint(
    planck.RevoluteJoint({ enableMotor: false }, leftBaseBody, leftLinkBody, leftAnchorA),
  );
  const leftPayloadJoint = world.createJoint(
    planck.RevoluteJoint({ enableMotor: false }, leftLinkBody, payloadBody, planck.Vec2(leftLinkCenter.x + (leftVec.x / leftDist) * (leftLinkLen / 2), leftLinkCenter.y + (leftVec.y / leftDist) * (leftLinkLen / 2))),
  );
  const rightAnchorA = planck.Vec2(baseRight.x, baseRight.y);
  const rightAnchorB = planck.Vec2(rightLinkCenter.x, rightLinkCenter.y);
  const rightJoint = world.createJoint(
    planck.RevoluteJoint({ enableMotor: false }, rightBaseBody, rightLinkBody, rightAnchorA),
  );
  const rightPayloadJoint = world.createJoint(
    planck.RevoluteJoint({ enableMotor: false }, rightLinkBody, payloadBody, planck.Vec2(rightLinkCenter.x + (rightVec.x / rightDist) * (rightLinkLen / 2), rightLinkCenter.y + (rightVec.y / rightDist) * (rightLinkLen / 2))),
  );

  joints[`${idPrefix}-baseLeftJoint`] = leftJoint;
  joints[`${idPrefix}-leftPayloadJoint`] = leftPayloadJoint;
  joints[`${idPrefix}-baseRightJoint`] = rightJoint;
  joints[`${idPrefix}-rightPayloadJoint`] = rightPayloadJoint;

  const motorCfg = cfg.motor || {};
  const motorState = {
    desiredAngle: leftAngle,
    desiredSpeed: 0,
    maxTorque: motorCfg.maxTorque || 5,
    maxSpeed: motorCfg.maxSpeed || 20,
    kP: motorCfg.kP || 80,
    kD: motorCfg.kD || 2,
    temp: motorCfg.initTemp || ambientTemp,
  };
  motors[`${idPrefix}-baseLeftJoint`] = { ...motorState };
  motors[`${idPrefix}-baseRightJoint`] = { ...motorState, desiredAngle: rightAngle, temp: motorCfg.initTemp || ambientTemp };

  fiveBars[idPrefix] = {
    idPrefix,
    baseLeft,
    baseRight,
    effector,
    upper,
    lower,
    leftAngle,
    rightAngle,
    leftSpeed: 0,
    rightSpeed: 0,
    leftLinkLen,
    rightLinkLen,
    leftLinkCenter,
    rightLinkCenter,
  };

  leftLinkBody.setAngle(leftAngle);
  rightLinkBody.setAngle(rightAngle);
  payloadBody.setTransform(planck.Vec2(effector.x, effector.y), 0);

  return { leftBaseBody, rightBaseBody, leftLinkBody, rightLinkBody, payloadBody };
}

function stepPhysics(dt: number) {
  if (!world) return;
  // apply motor torques as simple PD controllers on revolute joints
  Object.keys(joints).forEach((jid) => {
    const joint = joints[jid];
    // Only process revolute joints with motor states and valid joint object
    const ms = motors[jid];
    if (!ms || !joint) return;
    // @ts-ignore planck typing: revolute joint accessor methods
    const angle = typeof (joint as any).getJointAngle === 'function' ? (joint as any).getJointAngle() : 0;
    // @ts-ignore
    const speed = typeof (joint as any).getJointSpeed === 'function' ? (joint as any).getJointSpeed() : 0;
    const angleError = ms.desiredAngle - angle;
    const speedError = ms.desiredSpeed - speed;
    // PD torque
    let torque = ms.kP * angleError + ms.kD * speedError;
    // clamp by maxTorque and simple speed dependent reduction
    const speedFactor = 1 - Math.min(Math.abs(speed) / (ms.maxSpeed + 1e-6), 1);
    const effectiveMax = ms.maxTorque * Math.max(0.1, speedFactor);
    if (torque > effectiveMax) torque = effectiveMax;
    if (torque < -effectiveMax) torque = -effectiveMax;

    // apply torque onto joint (planck adds torque via bodies)
    const bodyA = joint.getBodyA();
    const bodyB = joint.getBodyB();
    // apply equal and opposite torques around anchor
    // torque applied as angular impulse approximated by applying forces at anchor offset; simpler: applyTorque
    bodyA.applyTorque(-torque, true);
    bodyB.applyTorque(torque, true);

    // Thermal model: heating ∝ torque^2, cooling toward ambient
    const heatingCoeff = 1e-3; // tuneable
    const coolingCoeff = 1e-1;
    const dtSec = dt;
    ms.temp += (torque * torque) * heatingCoeff * dtSec;
    ms.temp += -coolingCoeff * (ms.temp - ambientTemp) * dtSec;
    // clamp temp
    ms.temp = Math.max(ambientTemp, Math.min(200, ms.temp));
  });

  // Step world
  world.step(dt);
}

function publishState(t: number) {
  // gather simple telemetry
  const bodiesState: any = {};
  Object.keys(bodies).forEach((id) => {
    const b = bodies[id];
    const p = b.getPosition();
    const a = b.getAngle();
    const l = b.getLinearVelocity();
    const av = b.getAngularVelocity();
    bodiesState[id] = { x: p.x, y: p.y, angle: a, vx: l.x, vy: l.y, av };
  });

  const jointsState: any = {};
  Object.keys(joints).forEach((id) => {
    const j = joints[id];
    if (!j) {
      jointsState[id] = { angle: null, speed: null };
      return;
    }
    // @ts-ignore
    const angle = typeof (j as any).getJointAngle === 'function' ? (j as any).getJointAngle() : null;
    // @ts-ignore
    const speed = typeof (j as any).getJointSpeed === 'function' ? (j as any).getJointSpeed() : null;
    jointsState[id] = { angle, speed };
  });

  const motorsState: any = {};
  Object.keys(motors).forEach((id) => {
    const m = motors[id];
    motorsState[id] = { desiredAngle: m.desiredAngle, desiredSpeed: m.desiredSpeed, temp: m.temp, maxTorque: m.maxTorque };
  });

  postMessage({ type: 'state', t: t, bodies: bodiesState, joints: jointsState, motors: motorsState });
}

// Worker loop using requestAnimationFrame-like scheduling via setTimeout
function runLoop() {
  if (!running) return;
  const now = performance.now();
  if (!lastTimestamp) lastTimestamp = now;
  let frameMs = now - lastTimestamp;
  lastTimestamp = now;
  // clamp frameMs to avoid spiral
  frameMs = Math.min(frameMs, 250);
  accumulator += frameMs;
  publishAccumulator += frameMs;
  while (accumulator >= stepMs) {
    stepPhysics(stepMs / 1000);
    accumulator -= stepMs;
  }
  if (publishAccumulator >= publishIntervalMs) {
    publishState(now / 1000);
    publishAccumulator = 0;
  }
  setTimeout(runLoop, 0);
}

onmessage = (ev: MessageEvent) => {
  const msg = ev.data || {};
  if (!msg.type) return;
  switch (msg.type) {
    case 'init': {
      const cfg: InitConfig = msg.config || {};
      stepMs = (cfg.timeStep ? cfg.timeStep : 1 / 120) * 1000;
      publishIntervalMs = (1 / (cfg.publishHz || 60)) * 1000;
      ambientTemp = cfg.ambientTemp || 25;
      makeWorld();
      // create a simple ground for bodies to rest on
      if (world) {
        const ground = world.createBody();
        ground.createFixture(planck.Edge(planck.Vec2(-50, 0), planck.Vec2(50, 0)), { density: 0 });
      }
      // create placeholders for a two-joint five-bar if requested
      // user may post further 'command' messages to create specific bodies/joints
      postMessage({ type: 'inited' });
      break;
    }

    case 'createBody': {
      if (!world) break;
      const { id, x = 0, y = 1, dynamic = true, box = { w: 0.5, h: 0.5 } } = msg;
      const body = world.createBody({ type: dynamic ? 'dynamic' : 'static', position: planck.Vec2(x, y) });
      body.createFixture(planck.Box(box.w / 2, box.h / 2), { density: 1.0, friction: 0.3 });
      bodies[id] = body;
      postMessage({ type: 'createdBody', id });
      break;
    }

    case 'createFiveBar': {
      if (!world) break;
      createFiveBarInternal(msg.id, msg.config);
      postMessage({ type: 'createdFiveBar', id: msg.id });
      break;
    }

    case 'setBodyVelocity': {
      const { id, vx = 0, vy = 0 } = msg;
      const b = bodies[id];
      if (b) {
        b.setLinearVelocity(planck.Vec2(vx, vy));
      }
      break;
    }

    case 'setBodyPosition': {
      const { id, x = 0, y = 0 } = msg;
      const b = bodies[id];
      if (b) {
        b.setPosition(planck.Vec2(x, y));
      }
      break;
    }

    case 'setBodyTransform': {
      const { id, x = 0, y = 0, angle = 0 } = msg;
      const b = bodies[id];
      if (b) {
        b.setTransform(planck.Vec2(x, y), angle);
      }
      break;
    }

    case 'setMotor': {
      const { id, motor } = msg;
      if (!motor) break;
      if (!motors[id]) {
        motors[id] = {
          desiredAngle: motor.desiredAngle || 0,
          desiredSpeed: motor.desiredSpeed || 0,
          maxTorque: motor.maxTorque || 5,
          maxSpeed: motor.maxSpeed || 20,
          kP: motor.kP || 50,
          kD: motor.kD || 1,
          temp: motor.initTemp || ambientTemp,
        };
      } else {
        const m = motors[id];
        if (typeof motor.desiredAngle === 'number') m.desiredAngle = motor.desiredAngle;
        if (typeof motor.desiredSpeed === 'number') m.desiredSpeed = motor.desiredSpeed;
        if (typeof motor.maxTorque === 'number') m.maxTorque = motor.maxTorque;
        if (typeof motor.kP === 'number') m.kP = motor.kP;
        if (typeof motor.kD === 'number') m.kD = motor.kD;
      }
      break;
    }

    case 'createRevoluteJoint': {
      if (!world) break;
      const { id, bodyA, bodyB, anchorA = { x: 0, y: 0 }, anchorB = { x: 0, y: 0 }, motor } = msg;
      const j = world.createJoint(planck.RevoluteJoint({ enableMotor: false }, bodies[bodyA], bodies[bodyB], planck.Vec2(anchorA.x, anchorA.y)));
      joints[id] = j;
      if (motor) {
        motors[id] = {
          desiredAngle: motor.desiredAngle || 0,
          desiredSpeed: motor.desiredSpeed || 0,
          maxTorque: motor.maxTorque || 5,
          maxSpeed: motor.maxSpeed || 20,
          kP: motor.kP || 50,
          kD: motor.kD || 1,
          temp: motor.initTemp || ambientTemp,
        };
      }
      postMessage({ type: 'createdJoint', id });
      break;
    }

    case 'command': {
      const { id, payload } = msg;
      // support motor set commands
      if (id && motors[id]) {
        const m = motors[id];
        if (typeof payload.desiredAngle === 'number') m.desiredAngle = payload.desiredAngle;
        if (typeof payload.desiredSpeed === 'number') m.desiredSpeed = payload.desiredSpeed;
        if (typeof payload.maxTorque === 'number') m.maxTorque = payload.maxTorque;
        if (typeof payload.kP === 'number') m.kP = payload.kP;
        if (typeof payload.kD === 'number') m.kD = payload.kD;
      }
      break;
    }

    case 'stepOnce': {
      const dt = msg.dt || stepMs / 1000;
      stepPhysics(dt);
      publishState(performance.now() / 1000);
      break;
    }

    case 'stop': {
      running = false;
      postMessage({ type: 'stopped' });
      break;
    }

    case 'start': {
      if (!world) makeWorld();
      running = true;
      lastTimestamp = performance.now();
      runLoop();
      postMessage({ type: 'started' });
      break;
    }

    default:
      // ignore
      break;
  }
};

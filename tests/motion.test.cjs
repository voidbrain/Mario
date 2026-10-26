const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameEngine } = require('../.test-build/game.engine.js');
const { FiveBarActuator } = require('../.test-build/five-bar-actuator.js');
const { checkMotion } = require('../.test-build/motion-guard.js');
const { angleInsideRange } = require('../.test-build/geometry.js');
const { MOTION } = require('../.test-build/motion-profile.js');
const idle = { left: false, right: false, jumpPressed: false };
const tick = (e, n, input = idle) => { for(let i=0;i<n;i++) e.update(1/120,input); };

test('default poses valid; ready and reset never autoplay', () => {
  const e = new GameEngine();
  assert.ok(e.marioMechanism.valid && e.thwompMechanism.valid);
  const pose = JSON.stringify(e.state);
  tick(e, 120);
  assert.equal(JSON.stringify(e.state), pose);
  e.start(); tick(e, 120); e.reset();
  assert.equal(e.state.status, 'ready'); assert.equal(e.thwompAutoplay, false);
  const reset = JSON.stringify(e.state); tick(e,120); assert.equal(JSON.stringify(e.state),reset);
});

test('ten seconds of default autoplay stays valid', () => {
  const e = new GameEngine(); e.start(); tick(e,1200);
  assert.equal(e.state.status,'playing', e.faultReason);
  assert.ok(e.marioMechanism.valid && e.thwompMechanism.valid);
});

test('horizontal motion approaches a wall without penetration', () => {
  const e = new GameEngine(); e.obstacles.push({x:170,y:380,width:70,height:48});
  e.start(); tick(e,1000,{...idle,right:true});
  assert.ok(e.state.mario.x + e.state.mario.width <= 170 + 1e-6);
  assert.ok(e.marioMechanism.valid);
});

test('jump has no terminal teleport and remains in valid geometry', () => {
  const e = new GameEngine(); e.start();
  let old = {...e.state.mario};
  for(let i=0;i<1000;i++) {
    e.update(1/120,{...idle,jumpPressed:i===0});
    assert.ok(Math.hypot(e.state.mario.x-old.x,e.state.mario.y-old.y) <= MOTION.verticalSpeed/120+1e-6);
    assert.ok(e.marioMechanism.valid); old={...e.state.mario};
  }
  assert.equal(e.state.status,'playing',e.faultReason);
  assert.ok(Math.abs(e.state.mario.y-380)<0.01);
});

test('watchdog and operator stop latch; start cannot clear fault', () => {
  for(const dt of [NaN,Infinity,-1,0.251]) {
    const e = new GameEngine(); e.start(); const before={...e.state.mario};
    e.update(dt,idle); assert.equal(e.state.status,'fault');
    e.start(); tick(e,120); assert.equal(e.state.status,'fault');
    assert.deepEqual(e.state.mario,before);
    e.reset(); e.start(); assert.equal(e.state.status,'playing');
  }
});

test('manual motion is queued, bounded and rejected on invalid input', () => {
  const e=new GameEngine(); e.start(); e.thwompAutoplay=false;
  const y=e.state.thwomp.y; e.setThwompCenter(420,180);
  assert.equal(e.state.thwomp.y,y); tick(e,60);
  assert.equal(e.state.status,'playing',e.faultReason);
  assert.ok(e.state.thwomp.y>y && e.state.thwomp.y-y<40);
  e.setThwompCenter(NaN,200); assert.equal(e.state.status,'fault');
});

test('invalid tuning cannot enable motion', () => {
  const e=new GameEngine(); e.marioActuator.params.upperArm=-1; e.start();
  assert.equal(e.state.status,'fault');
});

test('angle ranges handle wrap, full range and non-finite values', () => {
  assert.ok(angleInsideRange(Math.PI,2.8,-2.8));
  assert.equal(angleInsideRange(0,2.8,-2.8),false);
  assert.ok(angleInsideRange(0,-Math.PI,Math.PI));
  assert.equal(angleInsideRange(NaN,-1,1),false);
});

test('unreachable, non-finite, singular and motor-limited poses fail closed', () => {
  const e=new GameEngine(); const a=e.marioActuator;
  for(const p of [{x:NaN,y:100},{x:10000,y:100},{...a.params.baseLeft}]) assert.equal(a.calculate(p).valid,false);
  const limited=new FiveBarActuator(a.bounds,a.jointBounds,{...a.params,motorLimits:{leftMin:-0.1,leftMax:0.1,rightMin:-0.1,rightMax:0.1}});
  assert.equal(limited.calculate(e.marioMechanism.effector).valid,false);
  assert.equal(a.calculate({x:185+360,y:240}).valid,false);
});

test('shared path gate rejects intermediate obstacle despite clear endpoints', () => {
  const e=new GameEngine();
  const from={...e.state.mario,width:0.05,height:0.05}; const to={x:from.x+1,y:from.y};
  const obstacle={x:from.x+0.49,y:from.y,width:0.02,height:from.height};
  const result=checkMotion(e.marioActuator,from,to,0.1,{left:0,right:0},[obstacle]);
  assert.equal(result.ok,false); assert.match(result.reason,/obstacle/);
});

test('fixed-step results do not depend on rendering at 30 or 120 Hz', () => {
  const a=new GameEngine(), b=new GameEngine(); a.start(); b.start();
  for(let i=0;i<60;i++) a.update(1/30,idle);
  tick(b,240);
  assert.deepEqual(a.state,b.state);
});

test('held jump does not retrigger after landing', () => {
  const e=new GameEngine(); e.start(); tick(e,1400,{...idle,jumpPressed:true});
  assert.equal(e.state.status,'playing',e.faultReason);
  assert.ok(Math.abs(e.state.mario.y-380)<0.01);
});

test('terminal/fault states freeze both actors and discard manual requests', () => {
  const e=new GameEngine();e.start();tick(e,60);e.stop();
  const before=JSON.stringify(e.state);e.thwompAutoplay=true;e.setThwompCenter(420,200);tick(e,120);
  assert.equal(JSON.stringify(e.state),before);
});

test('motion gate rejects excessive Cartesian and joint rates', () => {
  const e=new GameEngine(), c=e.state.mario;
  const fast=checkMotion(e.marioActuator,c,{x:c.x+20,y:c.y},1/120,{left:0,right:0},[]);
  assert.equal(fast.ok,false);assert.match(fast.reason,/speed/);
  const sudden=checkMotion(e.marioActuator,c,{x:c.x+0.1,y:c.y},1/120,{left:0,right:0},[]);
  assert.equal(sudden.ok,false);assert.match(sudden.reason,/acceleration/);
});

test('joint speed and joint acceleration independently constrain Cartesian motion', () => {
  const e=new GameEngine(), c=e.state.mario;
  const speed=checkMotion(e.marioActuator,c,{x:c.x+25,y:c.y},0.25,{left:0,right:0},[],{x:100,y:0});
  assert.equal(speed.ok,false);assert.equal(speed.reason,'Motor speed exceeded');
  const acceleration=checkMotion(e.marioActuator,c,c,1/120,{left:10,right:10},[]);
  assert.equal(acceleration.ok,false);assert.equal(acceleration.reason,'Motor acceleration exceeded');
});

test('parallel singularity with coincident passive joints is excluded', () => {
  const e=new GameEngine();
  const y=240+Math.sqrt(180**2-75**2)-180;
  assert.equal(e.marioActuator.calculate({x:260,y}).valid,false);
});

test('a rejected path cannot resume automatically or leak queued motion after reset', () => {
  const e=new GameEngine();e.start();e.thwompAutoplay=false;
  e.setThwompCenter(10000,10000);
  assert.equal(e.state.status,'fault');
  const stopped=JSON.stringify(e.state);tick(e,300,{...idle,right:true,jumpPressed:true});
  assert.equal(JSON.stringify(e.state),stopped);
  e.reset();tick(e,120);assert.equal(e.state.mario.x,10);assert.equal(e.state.thwomp.y,100);
});

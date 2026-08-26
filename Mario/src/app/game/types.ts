export interface Character {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GameStatus =
  | 'ready'
  | 'playing'
  | 'dead'
  | 'won';

export interface InputState {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
}

export interface GameState {
  width: number;
  height: number;
  status: GameStatus;
  mario: Character;
  thwomp: Character;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FiveBarConfig {
  baseLeft: Point;
  baseRight: Point;
  upperArm: number;
  lowerArm: number;
}

export interface FiveBarGeometry {
  baseLeft: Point;
  baseRight: Point;
  leftJoint: Point;
  rightJoint: Point;
  effector: Point;
  valid: boolean;
}

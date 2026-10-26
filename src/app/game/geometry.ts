import { Point, Rect } from './types';

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Radians in the signed principal interval; wrapped intervals are supported. */
export function angleInsideRange(angle: number, min: number, max: number): boolean {
  if (![angle, min, max].every(Number.isFinite)) return false;
  if (min < -Math.PI || min > Math.PI || max < -Math.PI || max > Math.PI) return false;
  const a = normalizeAngle(angle);
  return min <= max ? a >= min && a <= max : a >= min || a <= max;
}

export function validRect(rect: Rect): boolean {
  return Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0;
}

export function pointInsideRect(point: Point, rect: Rect): boolean {
  return validRect(rect) && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

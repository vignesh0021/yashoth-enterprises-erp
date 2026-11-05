import { describe as d, it as i, test as t } from 'node:test';
import assert from 'node:assert';

export function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined);
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined);
    },
    toBeTruthy() {
      assert.ok(actual);
    },
    toBeFalsy() {
      assert.ok(!actual);
    },
    toBeGreaterThan(expected) {
      assert.ok(actual > expected, `${actual} not > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      assert.ok(actual >= expected, `${actual} not >= ${expected}`);
    },
    toBeLessThan(expected) {
      assert.ok(actual < expected, `${actual} not < ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      assert.ok(actual <= expected, `${actual} not <= ${expected}`);
    },
    toBeCloseTo(expected, numDigits = 2) {
      const diff = Math.abs(actual - expected);
      assert.ok(diff < Math.pow(10, -numDigits) / 2, `${actual} not close to ${expected}`);
    },
    toThrow(expected) {
      if (typeof expected === 'string') {
        assert.throws(actual, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      } else if (expected) {
        assert.throws(actual, expected);
      } else {
        assert.throws(actual);
      }
    },
    toContain(expected) {
      if (typeof actual === 'string' || Array.isArray(actual)) {
        assert.ok(actual.includes(expected), `${JSON.stringify(actual)} does not contain ${expected}`);
      } else {
        assert.fail('toContain target must be string or array');
      }
    },
    toHaveLength(expected) {
      assert.strictEqual(actual.length, expected);
    }
  };
}

export const describe = d;
export const it = i;
export const test = t;
export const beforeAll = () => {};
export const afterAll = () => {};
export const beforeEach = () => {};
export const afterEach = () => {};

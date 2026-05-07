import { describe, it, expect } from 'vitest';
import { sqlIdentifier, isSystemDatabase } from './identifiers';

describe('sqlIdentifier', () => {
  it.each(['users', 'user_table', 'a', 'A1', 'snake_case_long_identifier'])(
    'accepts %s',
    (value) => {
      expect(sqlIdentifier.safeParse(value).success).toBe(true);
    },
  );

  it.each(['', '1users', 'has space', 'with-dash', 'a;b', "a'b", 'a`b', 'a/b', 'a"b'])(
    'rejects %s',
    (value) => {
      expect(sqlIdentifier.safeParse(value).success).toBe(false);
    },
  );

  it('rejects identifiers > 64 chars', () => {
    expect(sqlIdentifier.safeParse('a'.repeat(65)).success).toBe(false);
  });
});

describe('isSystemDatabase', () => {
  it('flags MySQL system schemas', () => {
    expect(isSystemDatabase('information_schema')).toBe(true);
    expect(isSystemDatabase('mysql')).toBe(true);
    expect(isSystemDatabase('performance_schema')).toBe(true);
    expect(isSystemDatabase('sys')).toBe(true);
  });

  it('returns false for user databases', () => {
    expect(isSystemDatabase('my_app')).toBe(false);
  });
});

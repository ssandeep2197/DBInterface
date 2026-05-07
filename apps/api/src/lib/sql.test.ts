import { describe, it, expect } from 'vitest';
import { quoteIdent, quoteRef } from './sql';
import { HttpError } from './http-error';

describe('quoteIdent', () => {
  it('wraps a valid identifier in backticks', () => {
    expect(quoteIdent('users')).toBe('`users`');
  });

  it('allows underscores and digits after the first char', () => {
    expect(quoteIdent('user_2024')).toBe('`user_2024`');
  });

  it('rejects identifiers starting with a digit', () => {
    expect(() => quoteIdent('1table')).toThrow(HttpError);
  });

  it('rejects identifiers containing backticks (defense in depth)', () => {
    expect(() => quoteIdent('a`b')).toThrow(HttpError);
  });

  it('rejects classic SQL injection payloads', () => {
    expect(() => quoteIdent('users; DROP TABLE x')).toThrow(HttpError);
    expect(() => quoteIdent("users' OR 1=1 --")).toThrow(HttpError);
  });

  it('rejects empty input', () => {
    expect(() => quoteIdent('')).toThrow(HttpError);
  });

  it('rejects identifiers longer than 64 chars', () => {
    expect(() => quoteIdent('a'.repeat(65))).toThrow(HttpError);
  });
});

describe('quoteRef', () => {
  it('produces a fully-qualified reference', () => {
    expect(quoteRef('mydb', 'users')).toBe('`mydb`.`users`');
  });

  it('rejects bad database names', () => {
    expect(() => quoteRef('bad name', 'users')).toThrow(HttpError);
  });
});

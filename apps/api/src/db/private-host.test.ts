import { describe, it, expect } from 'vitest';
import { isPrivateOrLoopback } from './private-host';

describe('isPrivateOrLoopback', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.255',
    '10.0.0.1',
    '10.255.0.1',
    '192.168.1.1',
    '169.254.1.1',
    '172.16.0.1',
    '172.31.255.255',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12::1',
  ])('flags %s as private/loopback', (ip) => {
    expect(isPrivateOrLoopback(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.0.1', // 172.15 — outside 172.16-31
    '172.32.0.1',
    '193.168.1.1',
    '170.254.1.1',
    '2606:4700:4700::1111',
  ])('allows public address %s', (ip) => {
    expect(isPrivateOrLoopback(ip)).toBe(false);
  });
});

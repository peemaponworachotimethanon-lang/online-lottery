import { describe, expect, it } from 'vitest';
import { can, canAll, isStaff, permissionsFor } from '@/lib/permissions';

describe('permissions', () => {
  it('grants nothing to a plain user', () => {
    expect(permissionsFor(['user']).size).toBe(0);
    expect(can({ id: 'u1', roles: ['user'] }, 'wallet.adjust')).toBe(false);
    expect(isStaff({ id: 'u1', roles: ['user'] })).toBe(false);
  });

  it('gives support read access but no money powers', () => {
    const support = { id: 'u2', roles: ['support'] as const };
    expect(can(support, 'user.view')).toBe(true);
    expect(can(support, 'wallet.view')).toBe(true);
    expect(can(support, 'wallet.adjust')).toBe(false);
    expect(can(support, 'withdrawal.approve')).toBe(false);
  });

  it('gives finance money powers but not catalogue management', () => {
    const finance = { id: 'u3', roles: ['finance'] as const };
    expect(canAll(finance, ['wallet.adjust', 'deposit.approve', 'withdrawal.approve'])).toBe(true);
    expect(can(finance, 'lottery.manage')).toBe(false);
    expect(can(finance, 'settings.manage')).toBe(false);
  });

  it('reserves settings.manage for superadmin', () => {
    expect(can({ id: 'u4', roles: ['admin'] }, 'settings.manage')).toBe(false);
    expect(can({ id: 'u5', roles: ['superadmin'] }, 'settings.manage')).toBe(true);
  });

  it('unions permissions across roles', () => {
    const both = { id: 'u6', roles: ['support', 'finance'] as const };
    expect(can(both, 'wallet.adjust')).toBe(true);
  });

  it('denies everything for an anonymous principal', () => {
    expect(can(null, 'user.view')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});

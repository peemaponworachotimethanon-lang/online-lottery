import { nowIso } from '@/lib/datetime';
import { conflict, forbidden, unauthenticated, validation } from '@/lib/errors';
import { id } from '@/lib/ids';
import { hashPassword, verifyPassword } from '@/lib/password';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '@/schemas/auth';
import type { PublicUser, User } from '@/types/domain';
import { AUDIT_ACTIONS, type AuditContext, type AuditService } from './audit-service';
import type { NotificationService } from './notification-service';
import type { WalletService } from './wallet-service';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    status: user.status,
    roles: user.roles,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    bankAccountName: user.bankAccountName,
    bankAccountNumber: user.bankAccountNumber,
    bankName: user.bankName,
    favoriteLotteryIds: user.favoriteLotteryIds,
    twoFactorEnabled: user.twoFactorEnabled,
    marketingOptIn: user.marketingOptIn,
  };
}

export class AuthService {
  constructor(
    private readonly repos: RepositoryBundle,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput, context: AuditContext): Promise<PublicUser> {
    // Uniqueness is checked here AND enforced by unique indexes in the schema;
    // the check produces a friendly message, the index is what guarantees it.
    if (await this.repos.users.findByEmail(input.email)) {
      throw validation('อีเมลนี้ถูกใช้งานแล้ว', { email: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }
    if (await this.repos.users.findByUsername(input.username)) {
      throw validation('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว', { username: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
    }
    if (await this.repos.users.findByPhone(input.phone)) {
      throw validation('เบอร์โทรนี้ถูกใช้งานแล้ว', { phone: 'เบอร์โทรนี้ถูกใช้งานแล้ว' });
    }

    const at = nowIso();
    const user = await this.repos.users.create({
      id: id('usr'),
      username: input.username,
      email: input.email,
      phone: input.phone,
      displayName: input.username,
      passwordHash: hashPassword(input.password),
      status: 'active',
      roles: ['user'],
      lastLoginAt: null,
      bankName: null,
      bankAccountName: null,
      bankAccountNumber: null,
      favoriteLotteryIds: [],
      twoFactorEnabled: false,
      marketingOptIn: false,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });

    await this.wallet.createWallet(user.id);
    await this.notifications.push({
      userId: user.id,
      type: 'system',
      title: 'ยินดีต้อนรับ',
      body: 'บัญชีของคุณพร้อมใช้งานแล้ว ระบบนี้เป็นโหมดสาธิต ไม่มีการใช้เงินจริง',
      href: '/dashboard',
    });
    await this.audit.record(
      { ...context, actorId: user.id, actorRole: 'user' },
      { action: AUDIT_ACTIONS.USER_REGISTER, resource: 'user', resourceId: user.id },
    );

    return toPublicUser(user);
  }

  async login(input: LoginInput, context: AuditContext): Promise<PublicUser> {
    const user = await this.repos.users.findByEmail(input.email);

    // Same generic message and comparable work for both branches so the response
    // does not reveal whether an account exists.
    if (!user) {
      await this.repos.loginEvents.record({
        id: id('lge'),
        userId: 'unknown',
        ip: context.ip,
        userAgent: context.userAgent,
        success: false,
        createdAt: nowIso(),
      });
      throw unauthenticated('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const valid = verifyPassword(input.password, user.passwordHash);
    await this.repos.loginEvents.record({
      id: id('lge'),
      userId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      success: valid,
      createdAt: nowIso(),
    });

    if (!valid) {
      await this.audit.record(
        { ...context, actorId: user.id, actorRole: 'user' },
        { action: AUDIT_ACTIONS.USER_LOGIN_FAILED, resource: 'user', resourceId: user.id },
      );
      throw unauthenticated('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    if (user.status === 'suspended') throw forbidden('บัญชีนี้ถูกระงับการใช้งาน');
    if (user.status === 'closed') throw forbidden('บัญชีนี้ถูกปิดแล้ว');

    const updated = await this.repos.users.update(user.id, { lastLoginAt: nowIso() });
    await this.audit.record(
      { ...context, actorId: user.id, actorRole: user.roles[0] ?? 'user' },
      { action: AUDIT_ACTIONS.USER_LOGIN, resource: 'user', resourceId: user.id },
    );

    return toPublicUser(updated);
  }

  async changePassword(userId: string, input: ChangePasswordInput, context: AuditContext): Promise<void> {
    const user = await this.repos.users.findById(userId);
    if (!user) throw unauthenticated();
    if (!verifyPassword(input.currentPassword, user.passwordHash)) {
      throw validation('รหัสผ่านปัจจุบันไม่ถูกต้อง', { currentPassword: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    if (verifyPassword(input.newPassword, user.passwordHash)) {
      throw conflict('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    }
    await this.repos.users.update(userId, { passwordHash: hashPassword(input.newPassword) });
    await this.audit.record(context, {
      action: AUDIT_ACTIONS.USER_CHANGE_PASSWORD,
      resource: 'user',
      resourceId: userId,
    });
  }

  /**
   * Mock password reset.
   * Always reports success so the endpoint cannot be used to enumerate accounts.
   */
  async requestPasswordReset(email: string): Promise<{ delivered: boolean }> {
    const user = await this.repos.users.findByEmail(email);
    if (user) {
      await this.notifications.push({
        userId: user.id,
        type: 'system',
        title: 'คำขอรีเซ็ตรหัสผ่าน',
        body: 'โหมดสาธิต: ระบบไม่ได้ส่งอีเมลจริง กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน',
      });
    }
    return { delivered: true };
  }

  async getPublicUser(userId: string): Promise<PublicUser | null> {
    const user = await this.repos.users.findById(userId);
    return user ? toPublicUser(user) : null;
  }
}

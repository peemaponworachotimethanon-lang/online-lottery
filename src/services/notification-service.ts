import { nowIso } from '@/lib/datetime';
import { id } from '@/lib/ids';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { Notification, NotificationType } from '@/types/domain';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
}

export class NotificationService {
  constructor(private readonly repos: RepositoryBundle) {}

  private build(input: CreateNotificationInput): Notification {
    const at = nowIso();
    return {
      id: id('ntf'),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      readAt: null,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
  }

  async push(input: CreateNotificationInput): Promise<Notification> {
    return this.repos.notifications.create(this.build(input));
  }

  /** Bulk fan-out. In production this runs on the queue, never inline. */
  async pushMany(inputs: readonly CreateNotificationInput[]): Promise<number> {
    const rows = inputs.map((input) => this.build(input));
    await this.repos.notifications.createMany(rows);
    return rows.length;
  }

  async list(userId: string, limit = 30): Promise<Notification[]> {
    return this.repos.notifications.listByUser(userId, { limit });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repos.notifications.countUnread(userId);
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.repos.notifications.markRead(notificationId, userId);
  }

  async markAllRead(userId: string): Promise<number> {
    return this.repos.notifications.markAllRead(userId);
  }
}

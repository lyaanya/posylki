import { Inject, Injectable } from "@nestjs/common";
import { ADMIN_USER_REPOSITORY, type IAdminUserRepository } from "../admin/admin-user.repository.js";
import type { AuthUser } from "../auth/users.repository.js";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import { ACTIVE_LISTING_STATUSES } from "../listings/listings.types.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "../listings/listings.repository.js";
import { TERMINAL_DEAL_STATUSES } from "../deals/deals.types.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "../deals/deals.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { CreateSupportTicketDto } from "./dto/create-support-ticket.dto.js";
import {
  SUPPORT_TICKETS_REPOSITORY,
  type ISupportTicketsRepository,
} from "./support-tickets.repository.js";
import { SUPPORT_ACCOUNT_ID, type SupportTicket, type SupportTicketContext } from "./support.types.js";
import type { Message } from "../chat/chat.types.js";

/**
 * ТЗ E15 — обращения в поддержку поверх чата E09 (15.1-15.6, 15.15-15.20).
 * Ассистент (15.7-15.14) отложен как nice-to-have (15.14) — все сообщения
 * пользователя сразу видит только модератор; этот сервис не пытается
 * ответить сам. См. отчёт эпика для того, что нужно добавить, когда
 * сценарий 4 (E13) будет подключён: вызов AiService между notifyModerators
 * и обычным ответом, плюс правила эскалации (15.10-15.11).
 */
@Injectable()
export class SupportService {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(SUPPORT_TICKETS_REPOSITORY) private readonly tickets: ISupportTicketsRepository,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: IAdminUserRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /** ТЗ п.15.3/15.19 — одно активное обращение; закрытое переоткрывается тем же тикетом и чатом. */
  async getOrCreateTicket(user: AuthUser, dto: CreateSupportTicketDto): Promise<SupportTicket> {
    const active = await this.tickets.findActiveForUser(user.id);
    if (active) return active;

    const freshContext = await this.collectContext(user);
    const fullContext: SupportTicketContext = {
      ...freshContext,
      platform: dto.platform ?? null,
      appVersion: dto.appVersion ?? null,
      lastError: dto.lastError ?? null,
    };
    const linkedObjectType = dto.linkedObjectType ?? null;
    const linkedObjectId = dto.linkedObjectId ?? null;

    const latest = await this.tickets.findLatestForUser(user.id);
    if (latest) {
      const reopened = await this.tickets.reopen(latest.id, { linkedObjectType, linkedObjectId, context: fullContext });
      if (reopened) {
        await this.notifyModerators(false);
        return reopened;
      }
    }

    const chat = await this.chats.findOrCreateSupportChat(user.id, SUPPORT_ACCOUNT_ID);
    let created: SupportTicket;
    try {
      created = await this.tickets.create({
        userId: user.id,
        chatId: chat.id,
        linkedObjectType,
        linkedObjectId,
        context: fullContext,
      });
    } catch (error) {
      // ТЗ п.15.3 — гонка двух одновременных первых обращений (например,
      // двойной клик или повторный вызов эффекта в React) бьётся об
      // support_tickets_one_active_per_user; тогда просто отдаём уже
      // созданную параллельно строку вместо 500.
      const concurrent = await this.tickets.findActiveForUser(user.id);
      if (!concurrent) throw error;
      created = concurrent;
    }
    await this.notifyModerators(true);
    return created;
  }

  async findMine(userId: string): Promise<SupportTicket | null> {
    return this.tickets.findLatestForUser(userId);
  }

  /** ТЗ п.15.4 — контекст виден только модератору, собирается автоматически. */
  private async collectContext(
    user: AuthUser,
  ): Promise<Pick<SupportTicketContext, "verificationStatus" | "totalDealsCount" | "activeDealIds" | "activeListingIds">> {
    const [dealsList, listingsList] = await Promise.all([
      this.deals.findForUser(user.id),
      this.listings.findByOwner(user.id),
    ]);
    return {
      verificationStatus: user.verificationStatus,
      totalDealsCount: dealsList.length,
      activeDealIds: dealsList.filter((d) => !TERMINAL_DEAL_STATUSES.includes(d.status)).map((d) => d.id),
      activeListingIds: listingsList.filter((l) => ACTIVE_LISTING_STATUSES.includes(l.status)).map((l) => l.id),
    };
  }

  /**
   * Сообщение внутри обращения — как от пользователя, так и от поддержки
   * (тогда senderId === SUPPORT_ACCOUNT_ID, см. AdminSupportController).
   * Переоткрывает закрытый тикет новым сообщением пользователя (15.19).
   */
  async postMessage(
    ticket: SupportTicket,
    senderId: string,
    body: string | null,
    attachmentStoragePaths: string[],
  ): Promise<Message> {
    const message = await this.chats.createMessage({
      chatId: ticket.chatId,
      senderId,
      kind: attachmentStoragePaths.length > 0 ? "photo" : "text",
      body,
      attachmentStoragePaths,
    });

    if (senderId === SUPPORT_ACCOUNT_ID) {
      if (ticket.status !== "in_progress") {
        await this.tickets.setStatus(ticket.id, "in_progress");
      }
      await this.notifications.notify({
        userId: ticket.userId,
        event: "support_reply",
        copy: notificationCopy.supportReply(),
      });
      return message;
    }

    // Сообщение от пользователя.
    if (ticket.status === "closed") {
      await this.tickets.reopen(ticket.id);
    }
    await this.notifyModerators(false);
    return message;
  }

  async closeTicket(ticketId: string): Promise<SupportTicket | null> {
    const closed = await this.tickets.setStatus(ticketId, "closed");
    if (closed) {
      await this.chats.createSystemMessage(closed.chatId, "Обращение закрыто поддержкой");
    }
    return closed;
  }

  async claimTicket(ticketId: string, adminId: string): Promise<SupportTicket | null> {
    return this.tickets.claim(ticketId, adminId);
  }

  /** ТЗ п.15.17 — новое обращение/сообщение уведомляет всех дежурных модераторов. */
  private async notifyModerators(isNewTicket: boolean): Promise<void> {
    const admins = await this.adminUsers.findAllActive();
    const copy = notificationCopy.supportTicketAlert(isNewTicket);
    await Promise.all(
      admins.map((admin) => this.notifications.notify({ userId: admin.id, event: "support_ticket_alert", copy })),
    );
  }
}

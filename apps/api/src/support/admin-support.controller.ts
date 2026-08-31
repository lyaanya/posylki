import { Body, Controller, Get, NotFoundException, Param, Post, Patch, Inject, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../admin/admin.guard.js";
import { CurrentAdmin } from "../admin/current-admin.decorator.js";
import type { AdminUser } from "../admin/admin-user.repository.js";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import type { Message } from "../chat/chat.types.js";
import { SendMessageDto } from "../chat/dto/send-message.dto.js";
import { CreateSupportFaqDto, UpdateSupportFaqDto } from "./dto/upsert-support-faq.dto.js";
import { SUPPORT_FAQ_REPOSITORY, type ISupportFaqRepository } from "./support-faq.repository.js";
import {
  SUPPORT_TICKETS_REPOSITORY,
  type ISupportTicketsRepository,
} from "./support-tickets.repository.js";
import { SupportService } from "./support.service.js";
import { SUPPORT_ACCOUNT_ID, type SupportFaqEntry, type SupportTicket } from "./support.types.js";

/**
 * ТЗ E15 пп.15.15-15.20 — очередь и работа модератора. Настоящего
 * интерфейса админ-панели (E16) нет — это только backend, как и все
 * admin-*.controller.ts в этой кодовой базе до сих пор (см.
 * admin-moderation.controller.ts).
 */
@ApiTags("admin/support")
@UseGuards(AdminGuard)
@Controller("admin/support")
export class AdminSupportController {
  constructor(
    @Inject(SUPPORT_TICKETS_REPOSITORY) private readonly tickets: ISupportTicketsRepository,
    @Inject(SUPPORT_FAQ_REPOSITORY) private readonly faq: ISupportFaqRepository,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(SupportService) private readonly support: SupportService,
  ) {}

  @Get("tickets")
  async queue(): Promise<SupportTicket[]> {
    return this.tickets.findQueue();
  }

  @Get("tickets/:id")
  async detail(@Param("id") id: string): Promise<SupportTicket> {
    return this.requireTicket(id);
  }

  @Get("tickets/:id/messages")
  async listMessages(@Param("id") id: string) {
    const ticket = await this.requireTicket(id);
    return this.chats.listMessages(ticket.chatId, { limit: 100 });
  }

  /** ТЗ п.15.16 — ответ модератора уходит от общего аккаунта "Поддержка", не от личного профиля сотрудника. */
  @Post("tickets/:id/messages")
  async reply(@Param("id") id: string, @Body() dto: SendMessageDto): Promise<Message> {
    const ticket = await this.requireTicket(id);
    const body = dto.body?.trim() || null;
    const attachmentPaths = dto.attachmentPaths ?? [];
    return this.support.postMessage(ticket, SUPPORT_ACCOUNT_ID, body, attachmentPaths);
  }

  /** ТЗ п.15.20 — модератор может инициировать переход "в работе" сам, без ответа. */
  @Post("tickets/:id/claim")
  async claim(@Param("id") id: string, @CurrentAdmin() admin: AdminUser): Promise<SupportTicket> {
    await this.requireTicket(id);
    const claimed = await this.support.claimTicket(id, admin.id);
    if (!claimed) throw new NotFoundException("Обращение не найдено");
    return claimed;
  }

  @Post("tickets/:id/close")
  async close(@Param("id") id: string): Promise<SupportTicket> {
    await this.requireTicket(id);
    const closed = await this.support.closeTicket(id);
    if (!closed) throw new NotFoundException("Обращение не найдено");
    return closed;
  }

  @Get("faq")
  async listFaq(): Promise<SupportFaqEntry[]> {
    return this.faq.findAll();
  }

  @Post("faq")
  async createFaq(@Body() dto: CreateSupportFaqDto): Promise<SupportFaqEntry> {
    return this.faq.create(dto);
  }

  @Patch("faq/:id")
  async updateFaq(@Param("id") id: string, @Body() dto: UpdateSupportFaqDto): Promise<SupportFaqEntry> {
    const updated = await this.faq.update(id, dto);
    if (!updated) throw new NotFoundException("Запись не найдена");
    return updated;
  }

  private async requireTicket(id: string): Promise<SupportTicket> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new NotFoundException("Обращение не найдено");
    return ticket;
  }
}

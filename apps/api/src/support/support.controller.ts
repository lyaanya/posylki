import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AllowWhenBlocked } from "../auth/allow-when-blocked.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { AppException } from "../common/app-exception.js";
import { decodeCursor, InvalidCursorError, type PaginatedResponse } from "../common/pagination.js";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import type { Message } from "../chat/chat.types.js";
import { SendMessageDto } from "../chat/dto/send-message.dto.js";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto.js";
import { SUPPORT_FAQ_REPOSITORY, type ISupportFaqRepository } from "./support-faq.repository.js";
import { SupportService } from "./support.service.js";
import type { SupportFaqEntry, SupportTicket } from "./support.types.js";

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

/**
 * ТЗ E15 пп.15.1-15.6 — обращение в поддержку поверх чата E09. Все
 * маршруты доступны заблокированному пользователю (@AllowWhenBlocked,
 * ТЗ п.15.6) — отдельно от обычных /chats/*, чтобы это исключение не
 * задело общий чат по объявлениям.
 */
@ApiTags("support")
@Controller("support")
export class SupportController {
  constructor(
    @Inject(SupportService) private readonly support: SupportService,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(SUPPORT_FAQ_REPOSITORY) private readonly faq: ISupportFaqRepository,
  ) {}

  @AllowWhenBlocked()
  @Post("tickets")
  async createTicket(@Body() dto: CreateSupportTicketDto, @CurrentUser() user?: AuthUser): Promise<SupportTicket> {
    if (!user) throw authRequired();
    return this.support.getOrCreateTicket(user, dto);
  }

  @AllowWhenBlocked()
  @Get("tickets/mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<SupportTicket | null> {
    if (!user) throw authRequired();
    return this.support.findMine(user.id);
  }

  @AllowWhenBlocked()
  @Get("tickets/:id/messages")
  async listMessages(
    @Param("id") id: string,
    @Query("cursor") cursorParam: string | undefined,
    @Query("limit") limitParam: string | undefined,
    @CurrentUser() user?: AuthUser,
  ): Promise<PaginatedResponse<Message>> {
    if (!user) throw authRequired();
    const ticket = await this.requireOwnTicket(id, user.id);

    let cursor: { sortValue: string; id: string } | undefined;
    if (cursorParam) {
      try {
        const decoded = decodeCursor<{ sortValue?: unknown; id?: unknown }>(cursorParam);
        if (typeof decoded.sortValue !== "string" || typeof decoded.id !== "string") {
          throw new InvalidCursorError();
        }
        cursor = { sortValue: decoded.sortValue, id: decoded.id };
      } catch {
        throw new AppException({
          code: "INVALID_CURSOR",
          message: "Некорректный курсор пагинации",
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 20, 1), 100) : 20;
    return this.chats.listMessages(ticket.chatId, { limit, cursor });
  }

  @AllowWhenBlocked()
  @Post("tickets/:id/messages")
  async sendMessage(
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Message> {
    if (!user) throw authRequired();
    const ticket = await this.requireOwnTicket(id, user.id);

    const body = dto.body?.trim() || null;
    const attachmentPaths = dto.attachmentPaths ?? [];
    if (!body && attachmentPaths.length === 0) {
      throw new AppException({
        code: "EMPTY_MESSAGE",
        message: "Сообщение не может быть пустым",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return this.support.postMessage(ticket, user.id, body, attachmentPaths);
  }

  @AllowWhenBlocked()
  @Get("faq")
  async listFaq(): Promise<SupportFaqEntry[]> {
    return this.faq.findAllActive();
  }

  private async requireOwnTicket(id: string, userId: string) {
    const ticket = await this.support.findMine(userId);
    if (!ticket || ticket.id !== id) {
      throw new NotFoundException("Обращение не найдено");
    }
    return ticket;
  }
}

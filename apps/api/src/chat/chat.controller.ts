import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import sharp from "sharp";
import { AppException } from "../common/app-exception.js";
import { decodeCursor, InvalidCursorError, type PaginatedResponse } from "../common/pagination.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "../listings/listings.repository.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { CHAT_ATTACHMENT_STORAGE, type IChatAttachmentStorage } from "./chat-attachment-storage.js";
import { SendMessageDto } from "./dto/send-message.dto.js";
import { CHAT_REPOSITORY, type ChatRef, type IChatRepository } from "./chat.repository.js";
import type { ChatSummary, Message } from "./chat.types.js";

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Разумный максимум стороны фото в чате — не квадратная обрезка, контент важнее рамки. */
const ATTACHMENT_MAX_DIMENSION_PX = 1600;

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

/**
 * ИИ-предупреждения о мошеннических схемах в переписке — сознательно
 * отложены в BACKLOG.md (раздел 10.1): цена приватности, анализ личной
 * переписки. Контакты в чате не вырезаются (ТЗ п.9.14) — в отличие от
 * листингов, здесь такого фильтра нет вообще, и это осознанно.
 *
 * Настоящий Supabase Realtime и системные сообщения по сделкам — см.
 * комментарий в миграции 20260830160000_chat.sql.
 */
@ApiTags("chat")
@Controller()
export class ChatController {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(CHAT_ATTACHMENT_STORAGE) private readonly attachmentStorage: IChatAttachmentStorage,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Post("chats/attachments")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES } }))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ path: string }> {
    if (!user) throw authRequired();
    if (!file) {
      throw new AppException({
        code: "FILE_REQUIRED",
        message: "Нужно приложить файл фотографии",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.mimetype)) {
      throw new AppException({
        code: "INVALID_FILE_TYPE",
        message: "Поддерживаются только JPEG, PNG и WebP",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    let processed: Buffer;
    try {
      processed = await sharp(file.buffer)
        .rotate()
        .resize(ATTACHMENT_MAX_DIMENSION_PX, ATTACHMENT_MAX_DIMENSION_PX, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppException({
        code: "INVALID_IMAGE",
        message: "Не получилось обработать изображение — попробуйте другой файл",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const path = await this.attachmentStorage.upload(user.id, processed, "image/jpeg");
    return { path };
  }

  @Get("chats/mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<ChatSummary[]> {
    if (!user) throw authRequired();
    return this.chats.listChatsForUser(user.id);
  }

  @Get("chats/unread-count")
  async unreadCount(@CurrentUser() user?: AuthUser): Promise<{ count: number }> {
    if (!user) throw authRequired();
    const count = await this.chats.totalUnreadForUser(user.id);
    return { count };
  }

  @Get("chats/:chatId/messages")
  async listMessages(
    @Param("chatId") chatId: string,
    @Query("cursor") cursorParam: string | undefined,
    @Query("limit") limitParam: string | undefined,
    @CurrentUser() user?: AuthUser,
  ): Promise<PaginatedResponse<Message>> {
    if (!user) throw authRequired();
    await this.assertParticipant(chatId, user.id);

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
    return this.chats.listMessages(chatId, { limit, cursor });
  }

  @Post("chats/:chatId/messages")
  async sendToChat(
    @Param("chatId") chatId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Message> {
    if (!user) throw authRequired();
    const chat = await this.assertParticipant(chatId, user.id);
    return this.sendMessage(chat, user, dto);
  }

  /**
   * Первое сообщение по объявлению — создаёт чат неявно (ТЗ п.9.4), без
   * отдельного действия "начать чат". Повторное обращение к тому же
   * объявлению продолжает тот же чат (findOrCreateChatByListing).
   */
  @Post("listings/:listingId/messages")
  async sendByListing(
    @Param("listingId") listingId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Message> {
    if (!user) throw authRequired();

    const listing = await this.listings.findById(listingId);
    if (!listing) {
      throw new NotFoundException("Объявление не найдено");
    }
    if (listing.courier.id === user.id) {
      throw new AppException({
        code: "CANNOT_MESSAGE_SELF",
        message: "Нельзя написать себе по своему объявлению",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const chat = await this.chats.findOrCreateChatByListing(listingId, listing.courier.id, user.id);
    return this.sendMessage(chat, user, dto);
  }

  @Post("chats/:chatId/read")
  async markRead(@Param("chatId") chatId: string, @CurrentUser() user?: AuthUser): Promise<{ ok: true }> {
    if (!user) throw authRequired();
    await this.assertParticipant(chatId, user.id);
    await this.chats.markRead(chatId, user.id);
    return { ok: true };
  }

  /** ТЗ п.9.20 — личная блокировка собеседника, не влияет на доступ к сервису в целом. */
  @Post("chats/:chatId/block")
  async blockCounterpart(
    @Param("chatId") chatId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ ok: true }> {
    if (!user) throw authRequired();
    const chat = await this.assertParticipant(chatId, user.id);
    const counterpartId = chat.ownerId === user.id ? chat.otherUserId : chat.ownerId;
    await this.chats.blockUser(user.id, counterpartId);
    return { ok: true };
  }

  @Post("chats/:chatId/unblock")
  async unblockCounterpart(
    @Param("chatId") chatId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ ok: true }> {
    if (!user) throw authRequired();
    const chat = await this.assertParticipant(chatId, user.id);
    const counterpartId = chat.ownerId === user.id ? chat.otherUserId : chat.ownerId;
    await this.chats.unblockUser(user.id, counterpartId);
    return { ok: true };
  }

  private async sendMessage(chat: ChatRef, user: AuthUser, dto: SendMessageDto): Promise<Message> {
    // ТЗ п.9.17 — верификация для переписки не нужна, но почта должна быть
    // подтверждена. Заблокированного сервисом сюда не пускает уже
    // AuthGuard (isBlocked проверяется на каждом запросе, до контроллера).
    if (!user.emailConfirmed) {
      throw new AppException({
        code: "EMAIL_NOT_CONFIRMED",
        message: "Подтвердите почту, чтобы писать сообщения",
        status: HttpStatus.FORBIDDEN,
      });
    }

    const body = dto.body?.trim() || null;
    const attachmentPaths = dto.attachmentPaths ?? [];
    if (!body && attachmentPaths.length === 0) {
      throw new AppException({
        code: "EMPTY_MESSAGE",
        message: "Сообщение не может быть пустым",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const recipientId = chat.ownerId === user.id ? chat.otherUserId : chat.ownerId;

    // ТЗ п.9.20 — заблокировавший перестаёт получать сообщения от того,
    // кого заблокировал; п.9.19 (сервисная блокировка) уже отсекается
    // AuthGuard раньше, до этого метода.
    if (await this.chats.isBlocked(recipientId, user.id)) {
      throw new AppException({
        code: "BLOCKED_BY_RECIPIENT",
        message: "Этот пользователь ограничил переписку с вами",
        status: HttpStatus.FORBIDDEN,
      });
    }

    const message = await this.chats.createMessage({
      chatId: chat.id,
      senderId: user.id,
      kind: attachmentPaths.length > 0 ? "photo" : "text",
      body,
      attachmentStoragePaths: attachmentPaths,
    });

    // ТЗ E14 п.14.16 — не уведомляем, если получатель недавно отмечал чат
    // прочитанным (приближение "чат открыт на активном устройстве" —
    // настоящего presence-сигнала без веб-сокетов в проекте нет).
    const recipientLastReadAt = await this.chats.getLastReadAt(chat.id, recipientId);
    const recentlyRead = recipientLastReadAt && Date.now() - recipientLastReadAt.getTime() < 60_000;
    if (!recentlyRead) {
      await this.notifications.notify({
        userId: recipientId,
        event: "chat_message",
        payload: { chatId: chat.id, senderName: user.email.split("@")[0] },
      });
    }

    return message;
  }

  private async assertParticipant(chatId: string, userId: string): Promise<ChatRef> {
    const chat = await this.chats.findChatById(chatId);
    if (!chat || (chat.ownerId !== userId && chat.otherUserId !== userId)) {
      throw new ForbiddenException("Это не ваш чат");
    }
    return chat;
  }
}

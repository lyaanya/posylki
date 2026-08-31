import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import sharp from "sharp";
import { InventoryModerationScenario } from "../ai/scenarios/inventory-moderation.scenario.js";
import { AppException } from "../common/app-exception.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { VerifiedGuard } from "../auth/verified.guard.js";
import type { AuthUser } from "../auth/users.repository.js";
import { USERS_REPOSITORY, type IUsersRepository } from "../auth/users.repository.js";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import { CITIES_REPOSITORY, type ICitiesRepository } from "../directories/cities.repository.js";
import { CURRENCIES_REPOSITORY, type ICurrenciesRepository } from "../directories/currencies.repository.js";
import {
  STOP_LIST_ITEMS_REPOSITORY,
  type IStopListItemsRepository,
} from "../directories/stop-list-items.repository.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "../listings/listings.repository.js";
import type { Listing } from "../listings/listings.types.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DEAL_PHOTO_STORAGE, type IDealPhotoStorage } from "./deal-photo-storage.js";
import { DealsTransitionsService } from "./deals-transitions.service.js";
import { AddDealItemDto } from "./dto/add-deal-item.dto.js";
import { CancelDealDto } from "./dto/cancel-deal.dto.js";
import { CreateDealDto } from "./dto/create-deal.dto.js";
import { HandoverDealDto } from "./dto/handover-deal.dto.js";
import { RecordConsentDto } from "./dto/record-consent.dto.js";
import { RequestStorageExtensionDto } from "./dto/request-storage-extension.dto.js";
import { SetDealContactDto } from "./dto/set-deal-contact.dto.js";
import { SetDealTermsDto } from "./dto/set-deal-terms.dto.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "./deals.repository.js";
import type { Deal, DealItem, DealStatus } from "./deals.types.js";

const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Доказательный материал (10.28) — важно содержимое, не рамка, поэтому не квадратная обрезка. */
const PHOTO_MAX_DIMENSION_PX = 1920;

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

function weightToGrams(weightKg: number): number {
  return Math.round(weightKg * 1000);
}

function assertWeightRounded(grams: number): void {
  if (grams % 500 !== 0) {
    throw new AppException({
      code: "WEIGHT_NOT_ROUNDED",
      message: "Вес должен быть кратен 500 г",
      status: HttpStatus.BAD_REQUEST,
    });
  }
}

/**
 * Опись, вес, контакты, фото передачи, продление хранения — самый крупный
 * эпик MVP (ТЗ E10). Верификация обеих сторон (10.9) частично условна:
 * E04 (подача и проверка документа) не реализован, поэтому approved
 * сейчас выставляется только вручную (модератором/SQL) — сам гейт
 * (VerifiedGuard) настоящий и работает на любом источнике approved.
 *
 * Настоящий разбор по часовым поясам городов в автопереходах — как и в
 * архивации объявлений (E07) — упрощён до сравнения по UTC-дате
 * (см. deals-cron.service.ts).
 */
@ApiTags("deals")
@Controller("deals")
export class DealsController {
  constructor(
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
    @Inject(CURRENCIES_REPOSITORY) private readonly currencies: ICurrenciesRepository,
    @Inject(STOP_LIST_ITEMS_REPOSITORY) private readonly stopListItems: IStopListItemsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
    @Inject(DEAL_PHOTO_STORAGE) private readonly photoStorage: IDealPhotoStorage,
    @Inject(InventoryModerationScenario) private readonly inventoryModeration: InventoryModerationScenario,
    @Inject(DealsTransitionsService) private readonly transitions: DealsTransitionsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Get("mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<Deal[]> {
    if (!user) throw authRequired();
    return this.deals.findForUser(user.id);
  }

  /** Сделки конкретного чата (ТЗ п.10.43 — их может быть несколько) — для входа со стороны переписки (E09). */
  @Get("by-chat/:chatId")
  async findByChat(@Param("chatId") chatId: string, @CurrentUser() user?: AuthUser): Promise<Deal[]> {
    if (!user) throw authRequired();
    const chat = await this.chats.findChatById(chatId);
    if (!chat) throw new NotFoundException("Чат не найден");
    if (chat.ownerId !== user.id && chat.otherUserId !== user.id) {
      throw new ForbiddenException("Это не ваш чат");
    }
    return this.deals.findByChatId(chatId);
  }

  @Get(":id")
  async findById(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, user.id);
    return deal;
  }

  /**
   * ТЗ п.10.1 — сделку начинает откликнувшийся участник чата (заказчик на
   * рейс или курьер на заявку), не владелец объявления. Обе стороны
   * должны быть верифицированы (10.9) — текущий пользователь проверен
   * VerifiedGuard'ом, вторую сторону проверяем здесь явно.
   */
  @Post()
  @UseGuards(VerifiedGuard)
  async create(@Body() dto: CreateDealDto, @CurrentUser() user?: AuthUser): Promise<Deal> {
    if (!user) throw authRequired();

    const chat = await this.chats.findChatById(dto.chatId);
    if (!chat) throw new NotFoundException("Чат не найден");
    if (chat.ownerId !== user.id && chat.otherUserId !== user.id) {
      throw new ForbiddenException("Это не ваш чат");
    }
    if (user.id !== chat.otherUserId) {
      throw new AppException({
        code: "ONLY_RESPONDER_CAN_START_DEAL",
        message: "Сделку может начать только откликнувшийся на объявление",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // Чат поддержки (E15) не привязан к объявлению — сделка из него невозможна структурно.
    if (!chat.listingId) throw new NotFoundException("Объявление не найдено");
    const listing = await this.listings.findById(chat.listingId);
    if (!listing) throw new NotFoundException("Объявление не найдено");

    const courierId = listing.type === "trip" ? chat.ownerId : chat.otherUserId;
    const customerId = listing.type === "trip" ? chat.otherUserId : chat.ownerId;
    const counterpartId = user.id === courierId ? customerId : courierId;

    const counterpart = await this.users.findById(counterpartId);
    if (!counterpart || counterpart.verificationStatus !== "approved") {
      throw new AppException({
        code: "COUNTERPART_NOT_VERIFIED",
        message: "Вторая сторона ещё не прошла верификацию",
        status: HttpStatus.FORBIDDEN,
      });
    }

    const currency = await this.currencies.findByCode(listing.currencyCode);
    if (!currency) throw new Error("Валюта объявления не найдена в справочнике");

    const created = await this.deals.create({
      chatId: dto.chatId,
      listingId: listing.id,
      customerId,
      courierId,
      currencyId: currency.id,
      createdBy: user.id,
    });

    await this.chats.createSystemMessage(
      chat.id,
      `Оформлена сделка по маршруту ${listing.fromCity} → ${listing.toCity}`,
    );

    // ТЗ E14 п.14.5 — "Сделка создана", всегда срочно; уведомляем того, кто
    // не откликался (владельца объявления), а не создателя сделки.
    await this.notifications.notify({
      userId: counterpartId,
      event: "deal_created",
      copy: notificationCopy.dealCreated(user.email.split("@")[0]!, created.id),
      payload: { dealId: created.id },
    });

    return created;
  }

  /** ТЗ п.10.10-10.11 — опись редактируется только до согласования условий. */
  @Post(":id/items")
  @UseGuards(VerifiedGuard)
  async addItem(
    @Param("id") id: string,
    @Body() dto: AddDealItemDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<DealItem> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, user.id);
    if (deal.status !== "responded") {
      throw new AppException({
        code: "ITEMS_LOCKED",
        message: "Опись можно менять только до согласования условий",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const toCity = await this.cities.findById(deal.toCityId);
    const destinationCountryCode = toCity?.countryCode ?? "";

    const name = dto.name.trim();
    const nameLower = name.toLowerCase();
    const stopList = await this.stopListItems.findAllActive(destinationCountryCode);
    const hardMatch = stopList.find(
      (entry) =>
        nameLower.includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(nameLower),
    );
    if (hardMatch) {
      throw new AppException({
        code: "ITEM_ON_STOP_LIST",
        message: `«${name}» нельзя внести в опись: ${hardMatch.explanation ?? hardMatch.name}`,
        status: HttpStatus.BAD_REQUEST,
        details: { stopListItemId: hardMatch.id },
      });
    }

    let warningText: string | null = null;
    let aiCheckFailed = false;
    const aiResult = await this.inventoryModeration.run({
      itemName: name,
      destinationCountryCode,
      dealId: id,
      actorId: user.id,
    });
    if (aiResult.ok) {
      warningText = aiResult.data.warning;
    } else {
      // 13.20 — сбой ИИ не блокирует опись, но помечает сделку для ручного просмотра.
      aiCheckFailed = true;
      await this.deals.setNeedsReview(id, true);
    }

    return this.deals.addItem(id, {
      name,
      quantity: dto.quantity ?? 1,
      weightGrams: dto.weightKg !== undefined ? weightToGrams(dto.weightKg) : null,
      warningText,
      aiCheckFailed,
    });
  }

  /** ТЗ п.10.6 — вес и цена торгуемы, но только до первого согласования (потом вес уже зарезервирован). */
  @Patch(":id/terms")
  @UseGuards(VerifiedGuard)
  async setTerms(
    @Param("id") id: string,
    @Body() dto: SetDealTermsDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, user.id);
    if (deal.status !== "responded") {
      throw new AppException({
        code: "DEAL_TERMS_LOCKED",
        message: "Условия можно менять только до согласования сделки",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const currency = await this.currencies.findByCode(deal.currencyCode);
    if (!currency) throw new Error("Валюта сделки не найдена в справочнике");

    const update: { declaredWeightGrams?: number; priceMinor?: number } = {};
    if (dto.declaredWeightKg !== undefined) {
      const grams = weightToGrams(dto.declaredWeightKg);
      assertWeightRounded(grams);
      update.declaredWeightGrams = grams;
    }
    if (dto.price !== undefined) {
      update.priceMinor = Math.round(dto.price * 10 ** currency.decimalPlaces);
    }

    if (Object.keys(update).length > 0) {
      await this.deals.setTerms(id, update);
      await this.deals.resetAgreement(id);
    }

    return this.requireDeal(id);
  }

  /** ТЗ п.10.13 / 13.19 — согласие со стоп-листом и/или ознакомление с предупреждением. */
  @Post(":id/consents")
  @UseGuards(VerifiedGuard)
  async recordConsent(
    @Param("id") id: string,
    @Body() dto: RecordConsentDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, user.id);

    let stopListVersion: Date | null = null;
    if (dto.type === "stop_list") {
      const items = await this.stopListItems.findAllActive();
      const timestamps = items.map((i) => i.updatedAt.getTime());
      stopListVersion = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date(0);
    }

    await this.deals.recordConsent(id, user.id, dto.type, stopListVersion);
    return this.requireDeal(id);
  }

  /**
   * ТЗ п.10.5 — переход в agreed требует описи, заявленного веса, цены,
   * согласия обеих сторон со стоп-листом (и с предупреждениями, если они
   * есть) и подтверждения обеих сторон. Резервирование веса (10.8)
   * происходит транзакционно в момент, когда второе подтверждение приходит.
   */
  @Post(":id/confirm-terms")
  @UseGuards(VerifiedGuard)
  async confirmTerms(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    const role = this.assertParticipant(deal, user.id);

    // ТЗ п.10.17 — после перевеса сделка остаётся в статусе agreed (см.
    // handover ниже), но оба согласия сброшены в null: это тоже "требует
    // подтверждения", просто без повторной проверки описи/согласий со
    // стоп-листом (они уже пройдены) и без повторного резерва веса (он
    // уже удержан) — только выставляем свежий флаг согласия текущей стороны.
    const isReconfirmationAfterOverweight =
      deal.status === "agreed" && (!deal.customerAgreedAt || !deal.courierAgreedAt);

    if (deal.status !== "responded" && !isReconfirmationAfterOverweight) {
      throw new AppException({
        code: "INVALID_DEAL_TRANSITION",
        message: "Подтверждать условия можно только пока сделка на этапе обсуждения",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (isReconfirmationAfterOverweight) {
      await this.deals.markAgreed(id, role);
      return this.requireDeal(id);
    }

    if (deal.items.length === 0) {
      throw new AppException({
        code: "ITEMS_REQUIRED",
        message: "Добавьте опись содержимого перед подтверждением",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (deal.declaredWeightGrams === null || deal.priceMinor === null) {
      throw new AppException({
        code: "TERMS_REQUIRED",
        message: "Укажите заявленный вес и цену перед подтверждением",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const [customerStopListConsent, courierStopListConsent] = await Promise.all([
      this.deals.hasConsent(id, deal.customer.id, "stop_list"),
      this.deals.hasConsent(id, deal.courier.id, "stop_list"),
    ]);
    if (!customerStopListConsent || !courierStopListConsent) {
      throw new AppException({
        code: "STOP_LIST_CONSENT_REQUIRED",
        message: "Обе стороны должны подтвердить согласие со стоп-листом",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (deal.items.some((item) => item.warningText)) {
      const [customerWarningConsent, courierWarningConsent] = await Promise.all([
        this.deals.hasConsent(id, deal.customer.id, "item_warning"),
        this.deals.hasConsent(id, deal.courier.id, "item_warning"),
      ]);
      if (!customerWarningConsent || !courierWarningConsent) {
        throw new AppException({
          code: "ITEM_WARNING_CONSENT_REQUIRED",
          message: "Обе стороны должны подтвердить ознакомление с предупреждением по описи",
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    await this.deals.markAgreed(id, role);
    const refreshed = await this.requireDeal(id);

    if (refreshed.customerAgreedAt && refreshed.courierAgreedAt) {
      const result = await this.transitions.tryEnterAgreed(refreshed, user.id);
      if (!result.ok) {
        throw new AppException({
          code: result.code,
          message: "На рейсе не осталось столько свободного веса — уменьшите вес или отмените сделку",
          status: HttpStatus.CONFLICT,
        });
      }
    }

    return this.requireDeal(id);
  }

  @Patch(":id/contacts")
  @UseGuards(VerifiedGuard)
  async setContact(
    @Param("id") id: string,
    @Body() dto: SetDealContactDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, user.id);
    await this.deals.upsertContact(id, dto);
    return this.requireDeal(id);
  }

  @Post(":id/photos")
  @UseGuards(VerifiedGuard)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_SIZE_BYTES } }))
  async uploadPhoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ path: string }> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    // ТЗ п.10.27 — снимает и передаёт файл любой участник сделки.
    this.assertParticipant(deal, user.id);

    if (!file) {
      throw new AppException({
        code: "FILE_REQUIRED",
        message: "Нужно приложить файл фотографии",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!ALLOWED_PHOTO_TYPES.has(file.mimetype)) {
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
        .resize(PHOTO_MAX_DIMENSION_PX, PHOTO_MAX_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch {
      throw new AppException({
        code: "INVALID_IMAGE",
        message: "Не получилось обработать изображение — попробуйте другой файл",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const path = await this.photoStorage.upload(id, user.id, processed, "image/jpeg");
    return { path };
  }

  /** ТЗ п.10.26 — курьер отмечает передачу; без фото и без заявленного веса невозможно. */
  @Post(":id/handover")
  @UseGuards(VerifiedGuard)
  async handover(
    @Param("id") id: string,
    @Body() dto: HandoverDealDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    const role = this.assertParticipant(deal, user.id);
    if (role !== "courier") {
      throw new ForbiddenException("Отметить передачу может только курьер");
    }
    if (deal.status !== "agreed") {
      throw new AppException({
        code: "INVALID_DEAL_TRANSITION",
        message: "Передача возможна только после согласования условий",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!deal.courierAgreedAt || !deal.customerAgreedAt) {
      throw new AppException({
        code: "NEEDS_RECONFIRMATION",
        message: "Условия сделки изменились и требуют подтверждения обеих сторон заново",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    for (const path of dto.photoStoragePaths) {
      await this.deals.addPhoto(id, path, user.id);
    }
    const totalPhotos = await this.deals.countPhotos(id);
    if (totalPhotos === 0) {
      throw new AppException({
        code: "PHOTO_REQUIRED",
        message: "Нужна хотя бы одна фотография посылки",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (dto.actualWeightKg !== undefined) {
      const actualGrams = weightToGrams(dto.actualWeightKg);
      assertWeightRounded(actualGrams);
      await this.deals.setActualWeight(id, actualGrams);

      const declared = deal.declaredWeightGrams!;
      if (actualGrams > declared) {
        // ТЗ п.10.17 — перевес требует переподтверждения по новой цене;
        // статус остаётся agreed (см. deal-state-machine.ts), просто не
        // продвигается, пока обе стороны не подтвердят заново.
        const listing = await this.listings.findById(deal.listingId);
        const newPriceMinor = await this.computeTariffPriceMinor(listing!, actualGrams);
        if (newPriceMinor !== null) {
          await this.deals.setTerms(id, { priceMinor: newPriceMinor });
        }
        await this.deals.resetAgreement(id);
        await this.chats.createSystemMessage(
          deal.chatId,
          "Фактический вес больше заявленного — цена пересчитана, нужно подтвердить условия заново",
        );
        // ТЗ E14 пп.14.5/14.12 — всегда срочно: человек стоит на встрече и ждёт.
        await this.notifications.notify({
          userId: deal.customer.id,
          event: "deal_overweight_reconfirm",
          copy: notificationCopy.dealOverweightReconfirm(deal.id),
          payload: { dealId: deal.id },
        });
        return this.requireDeal(id);
      }

      if (actualGrams < declared) {
        // ТЗ п.10.18 — освободившийся вес возвращается в рейс, оплата не уменьшается.
        const delta = declared - actualGrams;
        await this.listings.releaseWeight(deal.listingId, delta);
        await this.deals.setReservedWeight(id, actualGrams);
      }
    }

    await this.deals.markCourierHandedOver(id);
    return this.requireDeal(id);
  }

  @Post(":id/confirm-handover")
  @UseGuards(VerifiedGuard)
  async confirmHandover(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    const role = this.assertParticipant(deal, user.id);
    if (role !== "customer") {
      throw new ForbiddenException("Подтвердить передачу может только заказчик");
    }
    if (deal.status !== "agreed") {
      throw new AppException({
        code: "INVALID_DEAL_TRANSITION",
        message: "Подтверждение передачи доступно только после согласования условий",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!deal.courierHandedOverAt) {
      throw new AppException({
        code: "COURIER_HAS_NOT_MARKED_HANDOVER",
        message: "Курьер ещё не отметил передачу",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!deal.courierAgreedAt || !deal.customerAgreedAt) {
      throw new AppException({
        code: "NEEDS_RECONFIRMATION",
        message: "Условия сделки изменились и требуют подтверждения обеих сторон заново",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.deals.markCustomerHandedOverConfirmed(id);
    await this.transitions.transition(deal, "handed_over", user.id);
    return this.requireDeal(id);
  }

  @Post(":id/depart")
  @UseGuards(VerifiedGuard)
  async depart(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Deal> {
    return this.courierManualTransition(id, user, "handed_over", "in_transit");
  }

  @Post(":id/arrive")
  @UseGuards(VerifiedGuard)
  async arrive(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Deal> {
    return this.courierManualTransition(id, user, "in_transit", "awaiting_pickup");
  }

  @Post(":id/deliver")
  @UseGuards(VerifiedGuard)
  async deliver(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Deal> {
    return this.courierManualTransition(id, user, "awaiting_pickup", "delivered");
  }

  /** ТЗ п.10.35-10.37 — заказчик подтверждает получение, счётчики сделок растут. */
  @Post(":id/complete")
  @UseGuards(VerifiedGuard)
  async complete(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    const role = this.assertParticipant(deal, user.id);
    if (role !== "customer") {
      throw new ForbiddenException("Завершить сделку может только заказчик");
    }
    if (deal.status !== "delivered") {
      throw new AppException({
        code: "INVALID_DEAL_TRANSITION",
        message: "Завершить можно только выданную сделку",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    await this.transitions.complete(deal, user.id);
    return this.requireDeal(id);
  }

  /** ТЗ п.10.38-10.39 — до handed_over без последствий, после — запрещена. */
  @Post(":id/cancel")
  @UseGuards(VerifiedGuard)
  async cancel(
    @Param("id") id: string,
    @Body() dto: CancelDealDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, user.id);
    if (deal.status !== "responded" && deal.status !== "agreed") {
      throw new AppException({
        code: "CANCEL_NOT_ALLOWED",
        message: "После передачи посылки отмена невозможна — обратитесь через жалобу",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    await this.transitions.cancel(deal, dto.reason, dto.comment ?? null, user.id);
    return this.requireDeal(id);
  }

  /** ТЗ п.10.32 — запрашивает заказчик. */
  @Post(":id/storage-extension")
  @UseGuards(VerifiedGuard)
  async requestStorageExtension(
    @Param("id") id: string,
    @Body() dto: RequestStorageExtensionDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    const role = this.assertParticipant(deal, user.id);
    if (role !== "customer") {
      throw new ForbiddenException("Продление хранения запрашивает заказчик");
    }
    await this.deals.createStorageExtensionRequest({
      dealId: id,
      requestedBy: user.id,
      requestedUntilDate: dto.requestedUntilDate,
    });
    await this.chats.createSystemMessage(
      deal.chatId,
      `Заказчик запросил продление хранения до ${dto.requestedUntilDate}`,
    );
    await this.notifications.notify({
      userId: deal.courier.id,
      event: "storage_extension_requested",
      copy: notificationCopy.storageExtensionRequested(deal.id),
      payload: { dealId: deal.id },
    });
    return this.requireDeal(id);
  }

  /** ТЗ п.10.32 — решает курьер, автопродления нет никогда. */
  @Post(":id/storage-extension/:requestId/approve")
  @UseGuards(VerifiedGuard)
  async approveStorageExtension(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    return this.decideStorageExtension(id, requestId, "approved", user);
  }

  @Post(":id/storage-extension/:requestId/reject")
  @UseGuards(VerifiedGuard)
  async rejectStorageExtension(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<Deal> {
    return this.decideStorageExtension(id, requestId, "rejected", user);
  }

  private async decideStorageExtension(
    dealId: string,
    requestId: string,
    decision: "approved" | "rejected",
    user: AuthUser | undefined,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(dealId);
    const role = this.assertParticipant(deal, user.id);
    if (role !== "courier") {
      throw new ForbiddenException("Продление хранения решает курьер");
    }
    const request = await this.deals.findStorageExtensionRequest(requestId);
    if (!request || request.status !== "pending") {
      throw new NotFoundException("Запрос на продление не найден или уже решён");
    }
    const decided = await this.deals.decideStorageExtensionRequest(requestId, decision, user.id);
    if (decision === "approved" && decided) {
      await this.deals.setStorageUntilDate(dealId, decided.requestedUntilDate);
    }
    await this.chats.createSystemMessage(
      deal.chatId,
      decision === "approved" ? "Курьер одобрил продление хранения" : "Курьер отклонил продление хранения",
    );
    await this.notifications.notify({
      userId: deal.customer.id,
      event: "storage_extension_decided",
      copy: notificationCopy.storageExtensionDecided(decision === "approved", deal.id),
      payload: { dealId: deal.id },
    });
    return this.requireDeal(dealId);
  }

  private async courierManualTransition(
    id: string,
    user: AuthUser | undefined,
    from: DealStatus,
    to: DealStatus,
  ): Promise<Deal> {
    if (!user) throw authRequired();
    const deal = await this.requireDeal(id);
    const role = this.assertParticipant(deal, user.id);
    if (role !== "courier") {
      throw new ForbiddenException("Этот шаг отмечает курьер");
    }
    if (deal.status !== from) {
      throw new AppException({
        code: "INVALID_DEAL_TRANSITION",
        message: `Сделка должна быть в статусе "${from}"`,
        status: HttpStatus.BAD_REQUEST,
      });
    }
    await this.transitions.transition(deal, to, user.id);
    return this.requireDeal(id);
  }

  private async computeTariffPriceMinor(listing: Listing, weightGrams: number): Promise<number | null> {
    if (listing.pricePerKg === null) return null;
    const currency = await this.currencies.findByCode(listing.currencyCode);
    if (!currency) return null;
    const weightKg = weightGrams / 1000;
    const totalMajor = Math.max(weightKg * listing.pricePerKg, listing.minPrice ?? 0);
    return Math.round(totalMajor * 10 ** currency.decimalPlaces);
  }

  private async requireDeal(id: string): Promise<Deal> {
    const deal = await this.deals.findById(id);
    if (!deal) throw new NotFoundException("Сделка не найдена");
    return deal;
  }

  private assertParticipant(deal: Deal, userId: string): "customer" | "courier" {
    if (deal.customer.id === userId) return "customer";
    if (deal.courier.id === userId) return "courier";
    throw new ForbiddenException("Это не ваша сделка");
  }
}

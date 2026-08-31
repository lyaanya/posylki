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
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppException } from "../common/app-exception.js";
import { decodeCursor, InvalidCursorError, type PaginatedResponse } from "../common/pagination.js";
import { Public } from "../auth/public.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { VerifiedGuard } from "../auth/verified.guard.js";
import type { AuthUser } from "../auth/users.repository.js";
import { ListingModerationScenario } from "../ai/scenarios/listing-moderation.scenario.js";
import {
  MODERATION_RESULTS_REPOSITORY,
  type IModerationResultsRepository,
} from "../ai/moderation-results.repository.js";
import { CITIES_REPOSITORY, type ICitiesRepository } from "../directories/cities.repository.js";
import { CURRENCIES_REPOSITORY, type ICurrenciesRepository } from "../directories/currencies.repository.js";
import { SUBSCRIPTIONS_REPOSITORY, type ISubscriptionsRepository } from "../subscriptions/subscriptions.repository.js";
import { CreateListingDto } from "./dto/create-listing.dto.js";
import { UpdateListingDto } from "./dto/update-listing.dto.js";
import { SearchListingsQueryDto } from "./dto/search-listings.query.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "./listings.repository.js";
import { MAX_ACTIVE_LISTINGS_PER_TYPE } from "./listings.types.js";
import type { Listing, ListingKind, UpdateListing } from "./listings.types.js";

/** Шаблоны сообщений при отклонении (E13 п. 13.12) — категория + пояснение модели вставляются в фиксированный текст, не отдаются свободной строкой. */
const REJECT_CATEGORY_LABEL: Record<string, string> = {
  prohibited_item: "Похоже, в тексте упомянут запрещённый к перевозке товар",
  fraud_signs: "Текст похож на мошенническую схему",
  insults: "В тексте есть оскорбления",
};

function rejectMessage(category: string, explanation: string | null): string {
  const label = REJECT_CATEGORY_LABEL[category] ?? "Текст не прошёл проверку";
  return explanation ? `${label}: ${explanation}` : `${label}.`;
}

/** Дословно вырезает найденные контакты (E13 п. 13.5, 13.10) — только в переданных полях, не трогая остальной текст. */
function redactContacts(text: string | null, contacts: string[]): string | null {
  if (!text || contacts.length === 0) return text;
  let result = text;
  for (const contact of contacts) {
    if (contact.trim().length === 0) continue;
    result = result.split(contact).join("[скрыто]");
  }
  return result;
}

@ApiTags("listings")
@Controller("listings")
export class ListingsController {
  constructor(
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
    @Inject(CURRENCIES_REPOSITORY) private readonly currencies: ICurrenciesRepository,
    @Inject(SUBSCRIPTIONS_REPOSITORY) private readonly subscriptions: ISubscriptionsRepository,
    @Inject(ListingModerationScenario) private readonly listingModeration: ListingModerationScenario,
    @Inject(MODERATION_RESULTS_REPOSITORY) private readonly moderationResults: IModerationResultsRepository,
  ) {}

  @Public()
  @Get()
  async findAll(@Query() query: SearchListingsQueryDto): Promise<PaginatedResponse<Listing>> {
    const verifiedOnly = query.verifiedOnly === "true";

    // Сравнивать "цена ≤ X" или сортировать по цене между разными валютами
    // бессмысленно (ТЗ п.8.7) — оба требуют явно выбранной одной валюты.
    if (query.priceMaxPerKg !== undefined && !query.currencyCode) {
      throw new AppException({
        code: "CURRENCY_REQUIRED_FOR_PRICE_FILTER",
        message: "Фильтр по цене работает только вместе с выбранной валютой",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (query.sortBy === "price" && !query.currencyCode) {
      throw new AppException({
        code: "CURRENCY_REQUIRED_FOR_PRICE_SORT",
        message: "Сортировка по цене доступна только при выбранной одной валюте",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    let priceMaxPerKgMinor: number | undefined;
    if (query.priceMaxPerKg !== undefined && query.currencyCode) {
      const currency = await this.currencies.findByCode(query.currencyCode);
      if (!currency) {
        throw new AppException({
          code: "CURRENCY_NOT_FOUND",
          message: "Валюта из справочника не найдена",
          status: HttpStatus.BAD_REQUEST,
        });
      }
      priceMaxPerKgMinor = toMinorUnits(query.priceMaxPerKg, currency.decimalPlaces);
    }

    let cursor: { sortValue: string; id: string } | undefined;
    if (query.cursor) {
      try {
        const decoded = decodeCursor<{ sortValue?: unknown; id?: unknown }>(query.cursor);
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

    return this.listings.findAll({
      type: query.type,
      fromCityId: query.fromCityId,
      toCityId: query.toCityId,
      ownerId: query.ownerId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      weightMinGrams: query.weightMinKg !== undefined ? weightToGrams(query.weightMinKg) : undefined,
      priceMaxPerKgMinor,
      currencyCode: query.currencyCode,
      verifiedOnly,
      sortBy: query.sortBy,
      cursor,
      limit: query.limit,
    });
  }

  @Get("mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<Listing[]> {
    if (!user) {
      throw authRequired();
    }
    return this.listings.findByOwner(user.id);
  }

  /** ТЗ п.8.15.1 — счётчик спроса на маршруте в пустой выдаче. */
  @Public()
  @Get("demand-count")
  async demandCount(
    @Query("fromCityId") fromCityId: string,
    @Query("toCityId") toCityId: string,
  ): Promise<{ count: number }> {
    if (!fromCityId || !toCityId) {
      throw new AppException({
        code: "BAD_REQUEST",
        message: "Нужно указать fromCityId и toCityId",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    const count = await this.listings.countActiveRequestsOnRoute(fromCityId, toCityId);
    return { count };
  }

  /** ТЗ п.8.15.2 — соседние даты ±7 дней в пустой выдаче. */
  @Public()
  @Get("nearby-dates")
  async nearbyDates(
    @Query("type") type: ListingKind,
    @Query("fromCityId") fromCityId: string,
    @Query("toCityId") toCityId: string,
    @Query("date") date: string,
  ): Promise<{ dates: string[] }> {
    if (!fromCityId || !toCityId || !date || (type !== "trip" && type !== "request")) {
      throw new AppException({
        code: "BAD_REQUEST",
        message: "Нужно указать type, fromCityId, toCityId и date",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    const dates = await this.listings.findNearbyDates({ type, fromCityId, toCityId, aroundDate: date });
    return { dates };
  }

  @Public()
  @Get(":id")
  async findById(@Param("id") id: string): Promise<Listing> {
    const listing = await this.listings.findById(id);
    if (!listing) {
      throw new NotFoundException("Объявление не найдено");
    }
    return listing;
  }

  /**
   * ТЗ E07 п. 7.15 — публикация объявления доступна только верифицированным
   * пользователям (VerifiedGuard, тот же уровень доступа, что и вход в сделку
   * в E10). AuthGuard применяется глобально (APP_GUARD), здесь достаточно
   * VerifiedGuard поверх него.
   */
  @UseGuards(VerifiedGuard)
  @Post()
  async create(@Body() dto: CreateListingDto, @CurrentUser() user?: AuthUser): Promise<Listing> {
    if (!user) {
      throw authRequired();
    }

    const [fromCity, toCity, currency] = await Promise.all([
      this.cities.findById(dto.fromCityId),
      this.cities.findById(dto.toCityId),
      this.currencies.findById(dto.currencyId),
    ]);

    if (!fromCity || !toCity) {
      throw new AppException({
        code: "CITY_NOT_FOUND",
        message: "Город из справочника не найден",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (dto.fromCityId === dto.toCityId) {
      throw new AppException({
        code: "SAME_CITY",
        message: "Город назначения должен отличаться от города отправления",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!currency) {
      throw new AppException({
        code: "CURRENCY_NOT_FOUND",
        message: "Валюта из справочника не найдена",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (dto.dateTo < dto.dateFrom) {
      throw new AppException({
        code: "INVALID_DATE_RANGE",
        message:
          dto.type === "trip"
            ? "Дата прилёта не может быть раньше даты вылета"
            : "Конец диапазона дат не может быть раньше начала",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (dto.type === "request" && dto.pricePerKg !== undefined && dto.priceTotal !== undefined) {
      throw new AppException({
        code: "PRICE_CONFLICT",
        message: "Укажите цену либо за килограмм, либо общей суммой — не оба варианта сразу",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const weightGrams = weightToGrams(dto.weightKg);
    if (weightGrams % 500 !== 0) {
      throw new AppException({
        code: "WEIGHT_NOT_ROUNDED",
        message: "Вес должен быть кратен 500 г",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const activeCount = await this.listings.countActiveByOwnerAndType(user.id, dto.type);
    if (activeCount >= MAX_ACTIVE_LISTINGS_PER_TYPE) {
      throw new AppException({
        code: "TOO_MANY_ACTIVE_LISTINGS",
        message: `Не более ${MAX_ACTIVE_LISTINGS_PER_TYPE} активных объявлений этого типа одновременно`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const decimals = currency.decimalPlaces;

    let pickupInstructions = dto.pickupInstructions ?? null;
    let dropoffInstructions = dto.dropoffInstructions ?? null;
    let itemDescription = dto.itemDescription ?? null;
    let comment = dto.comment ?? null;

    // ТЗ E13 пп.13.9-13.14 — синхронная модерация текста при публикации.
    // Сущности ещё нет (как и у сценария 3 — см. комментарий в миграции
    // ai_requests), поэтому вызываем до создания строки: reject не должен
    // приводить к созданию-и-немедленному-удалению объявления.
    let pendingReview: { verdict: "flag"; category: string | null; explanation: string | null } | null = null;
    const moderationText = [pickupInstructions, dropoffInstructions, itemDescription, comment]
      .filter((v): v is string => Boolean(v && v.trim().length > 0))
      .join("\n");

    if (moderationText.length > 0) {
      const moderation = await this.listingModeration.run({
        text: moderationText,
        fromCity: fromCity.nameRu,
        toCity: toCity.nameRu,
        listingType: dto.type,
        actorId: user.id,
      });

      if (moderation.ok && moderation.data.verdict === "reject") {
        throw new AppException({
          code: "LISTING_REJECTED_BY_MODERATION",
          message: rejectMessage(moderation.data.category ?? "other", moderation.data.explanation),
          status: HttpStatus.BAD_REQUEST,
          details: { category: moderation.data.category },
        });
      }

      if (moderation.ok && moderation.data.verdict === "flag") {
        pickupInstructions = redactContacts(pickupInstructions, moderation.data.contactsFound);
        dropoffInstructions = redactContacts(dropoffInstructions, moderation.data.contactsFound);
        itemDescription = redactContacts(itemDescription, moderation.data.contactsFound);
        comment = redactContacts(comment, moderation.data.contactsFound);
        pendingReview = {
          verdict: "flag",
          category: moderation.data.category,
          explanation: moderation.data.explanation,
        };
      } else if (!moderation.ok) {
        // ТЗ п.13.14 — сбой сценария не блокирует публикацию, объявление
        // уходит в очередь ручного просмотра с вердиктом flag.
        pendingReview = { verdict: "flag", category: null, explanation: "Проверка не выполнена (сбой ИИ-сервиса)" };
      }
    }

    const created = await this.listings.create({
      ownerId: user.id,
      type: dto.type,
      fromCityId: dto.fromCityId,
      toCityId: dto.toCityId,
      currencyId: dto.currencyId,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      weightGrams,
      pricePerKgMinor: dto.pricePerKg !== undefined ? toMinorUnits(dto.pricePerKg, decimals) : null,
      minPriceMinor: dto.minPrice !== undefined ? toMinorUnits(dto.minPrice, decimals) : null,
      priceTotalMinor: dto.priceTotal !== undefined ? toMinorUnits(dto.priceTotal, decimals) : null,
      pickupInstructions,
      dropoffInstructions,
      storageUntilDate:
        dto.type === "trip" ? (dto.storageUntilDate ?? addDays(dto.dateTo, 7)) : null,
      departureAirport: dto.departureAirport ?? null,
      arrivalAirport: dto.arrivalAirport ?? null,
      flightNumber: dto.flightNumber ?? null,
      itemDescription,
      comment,
    });

    if (pendingReview) {
      await this.moderationResults.create({
        scenario: "listing_moderation",
        entityType: "listing",
        entityId: created.id,
        verdict: pendingReview.verdict,
        category: pendingReview.category,
        explanation: pendingReview.explanation,
        contactsFound: [],
      });
    }

    // Совпадения с подписками (E08 п.8.4, п.8.11) — только доставка уведомления
    // об этом не входит сюда, она ждёт E14 (см. subscriptions.controller.ts).
    await this.subscriptions.recordMatches({
      id: created.id,
      type: created.type,
      fromCityId: created.fromCityId,
      toCityId: created.toCityId,
      dateFrom: created.dateFrom,
      dateTo: created.dateTo,
    });

    return created;
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<Listing> {
    if (!user) {
      throw authRequired();
    }
    const existing = await this.assertOwnedByUser(id, user.id);

    if (dto.fromCityId || dto.toCityId) {
      const fromCityId = dto.fromCityId ?? existing.fromCityId;
      const toCityId = dto.toCityId ?? existing.toCityId;
      if (dto.fromCityId) {
        const city = await this.cities.findById(dto.fromCityId);
        if (!city) {
          throw new AppException({
            code: "CITY_NOT_FOUND",
            message: "Город из справочника не найден",
            status: HttpStatus.BAD_REQUEST,
          });
        }
      }
      if (dto.toCityId) {
        const city = await this.cities.findById(dto.toCityId);
        if (!city) {
          throw new AppException({
            code: "CITY_NOT_FOUND",
            message: "Город из справочника не найден",
            status: HttpStatus.BAD_REQUEST,
          });
        }
      }
      if (fromCityId === toCityId) {
        throw new AppException({
          code: "SAME_CITY",
          message: "Город назначения должен отличаться от города отправления",
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    const dateFrom = dto.dateFrom ?? existing.dateFrom;
    const dateTo = dto.dateTo ?? existing.dateTo;
    if (dateTo < dateFrom) {
      throw new AppException({
        code: "INVALID_DATE_RANGE",
        message: "Дата окончания не может быть раньше даты начала",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    let weightGrams: number | undefined;
    if (dto.weightKg !== undefined) {
      weightGrams = weightToGrams(dto.weightKg);
      if (weightGrams % 500 !== 0) {
        throw new AppException({
          code: "WEIGHT_NOT_ROUNDED",
          message: "Вес должен быть кратен 500 г",
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    let decimals: number | undefined;
    if (dto.pricePerKg !== undefined || dto.minPrice !== undefined || dto.priceTotal !== undefined) {
      const currency = dto.currencyId
        ? await this.currencies.findById(dto.currencyId)
        : await this.currencies.findByCode(existing.currencyCode);
      if (!currency) {
        throw new AppException({
          code: "CURRENCY_NOT_FOUND",
          message: "Валюта из справочника не найдена",
          status: HttpStatus.BAD_REQUEST,
        });
      }
      decimals = currency.decimalPlaces;
    } else if (dto.currencyId) {
      const currency = await this.currencies.findById(dto.currencyId);
      if (!currency) {
        throw new AppException({
          code: "CURRENCY_NOT_FOUND",
          message: "Валюта из справочника не найдена",
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    const update: UpdateListing = {};
    if (dto.fromCityId !== undefined) update.fromCityId = dto.fromCityId;
    if (dto.toCityId !== undefined) update.toCityId = dto.toCityId;
    if (dto.currencyId !== undefined) update.currencyId = dto.currencyId;
    if (dto.dateFrom !== undefined) update.dateFrom = dto.dateFrom;
    if (dto.dateTo !== undefined) update.dateTo = dto.dateTo;
    if (weightGrams !== undefined) update.weightGrams = weightGrams;
    if (dto.pricePerKg !== undefined && decimals !== undefined) {
      update.pricePerKgMinor = toMinorUnits(dto.pricePerKg, decimals);
    }
    if (dto.minPrice !== undefined && decimals !== undefined) {
      update.minPriceMinor = toMinorUnits(dto.minPrice, decimals);
    }
    if (dto.priceTotal !== undefined && decimals !== undefined) {
      update.priceTotalMinor = toMinorUnits(dto.priceTotal, decimals);
    }
    if (dto.pickupInstructions !== undefined) update.pickupInstructions = dto.pickupInstructions;
    if (dto.dropoffInstructions !== undefined) update.dropoffInstructions = dto.dropoffInstructions;
    if (dto.storageUntilDate !== undefined) update.storageUntilDate = dto.storageUntilDate;
    if (dto.departureAirport !== undefined) update.departureAirport = dto.departureAirport;
    if (dto.arrivalAirport !== undefined) update.arrivalAirport = dto.arrivalAirport;
    if (dto.flightNumber !== undefined) update.flightNumber = dto.flightNumber;
    if (dto.itemDescription !== undefined) update.itemDescription = dto.itemDescription;
    if (dto.comment !== undefined) update.comment = dto.comment;

    return this.listings.update(id, update);
  }

  /** ТЗ п.7.18 — автор скрывает объявление в любой момент, оно пропадает из ленты и поиска. */
  @Post(":id/hide")
  async hide(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Listing> {
    if (!user) {
      throw authRequired();
    }
    const existing = await this.assertOwnedByUser(id, user.id);
    if (existing.status !== "published") {
      throw new AppException({
        code: "INVALID_STATUS_TRANSITION",
        message: "Скрыть можно только опубликованное объявление",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    return this.listings.setStatus(id, "hidden_by_author");
  }

  @Post(":id/unhide")
  async unhide(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Listing> {
    if (!user) {
      throw authRequired();
    }
    const existing = await this.assertOwnedByUser(id, user.id);
    if (existing.status !== "hidden_by_author") {
      throw new AppException({
        code: "INVALID_STATUS_TRANSITION",
        message: "Вернуть в ленту можно только скрытое автором объявление",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    return this.listings.setStatus(id, "published");
  }

  private async assertOwnedByUser(id: string, userId: string): Promise<Listing> {
    const listing = await this.listings.findById(id);
    if (!listing) {
      throw new NotFoundException("Объявление не найдено");
    }
    if (listing.courier.id !== userId) {
      throw new ForbiddenException("Это объявление принадлежит другому пользователю");
    }
    return listing;
  }
}

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

function toMinorUnits(major: number, decimalPlaces: number): number {
  return Math.round(major * 10 ** decimalPlaces);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

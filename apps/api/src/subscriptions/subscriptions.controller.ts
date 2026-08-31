import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppException } from "../common/app-exception.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { CITIES_REPOSITORY, type ICitiesRepository } from "../directories/cities.repository.js";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto.js";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto.js";
import { SUBSCRIPTIONS_REPOSITORY, type ISubscriptionsRepository } from "./subscriptions.repository.js";
import { MAX_SUBSCRIPTIONS_PER_USER } from "./subscriptions.types.js";
import type { RouteSubscription } from "./subscriptions.types.js";

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

/**
 * Доставка уведомлений по подпискам (E14) сюда не входит — см. комментарий
 * в миграции 20260830150000_route_subscriptions.sql. Подписки создаются,
 * управляются и накапливают совпадения (subscription_matches) уже сейчас.
 */
@ApiTags("subscriptions")
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY) private readonly subscriptions: ISubscriptionsRepository,
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
  ) {}

  @Get("mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<RouteSubscription[]> {
    if (!user) {
      throw authRequired();
    }
    return this.subscriptions.findByUser(user.id);
  }

  @Post()
  async create(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<RouteSubscription> {
    if (!user) {
      throw authRequired();
    }

    const [fromCity, toCity] = await Promise.all([
      this.cities.findById(dto.fromCityId),
      this.cities.findById(dto.toCityId),
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

    const count = await this.subscriptions.countByUser(user.id);
    if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
      throw new AppException({
        code: "TOO_MANY_SUBSCRIPTIONS",
        message: `Не более ${MAX_SUBSCRIPTIONS_PER_USER} подписок одновременно`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return this.subscriptions.create({
      userId: user.id,
      fromCityId: dto.fromCityId,
      toCityId: dto.toCityId,
      dateFrom: dto.dateFrom ?? null,
      dateTo: dto.dateTo ?? null,
      listingType: dto.listingType ?? null,
    });
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<RouteSubscription> {
    if (!user) {
      throw authRequired();
    }
    await this.assertOwned(id, user.id);
    return this.subscriptions.setActive(id, dto.isActive);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<{ ok: true }> {
    if (!user) {
      throw authRequired();
    }
    await this.assertOwned(id, user.id);
    await this.subscriptions.delete(id);
    return { ok: true };
  }

  private async assertOwned(id: string, userId: string): Promise<RouteSubscription> {
    const subscription = await this.subscriptions.findOwned(id, userId);
    if (!subscription) {
      // Не раскрываем, существует ли чужая подписка с этим id — тот же
      // код и для "нет вообще", и для "есть, но чужая".
      throw new NotFoundException("Подписка не найдена");
    }
    return subscription;
  }
}

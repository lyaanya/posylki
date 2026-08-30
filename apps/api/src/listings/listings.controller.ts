import { Body, Controller, Get, HttpStatus, Inject, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppException } from "../common/app-exception.js";
import { Public } from "../auth/public.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { CITIES_REPOSITORY, type ICitiesRepository } from "../directories/cities.repository.js";
import { CreateListingDto } from "./dto/create-listing.dto.js";
import { SearchListingsQueryDto } from "./dto/search-listings.query.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "./listings.repository.js";
import type { Listing } from "./listings.types.js";

/**
 * Демо-срез E07: сохранение и чтение объявлений без модерации ИИ (13.9-13.20),
 * без верификации при публикации (E04 не реализован) и без стоп-листа —
 * поэтому создание доступно любому вошедшему пользователю, не только
 * верифицированному (ТЗ §3.3 временно ослаблено осознанно, до E04).
 */
@ApiTags("listings")
@Controller("listings")
export class ListingsController {
  constructor(
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
  ) {}

  @Public()
  @Get()
  async findAll(@Query() query: SearchListingsQueryDto): Promise<Listing[]> {
    return this.listings.findAll({
      type: query.type,
      fromCityId: query.fromCityId,
      toCityId: query.toCityId,
    });
  }

  @Get("mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<Listing[]> {
    if (!user) {
      throw new AppException({
        code: "AUTH_REQUIRED",
        message: "Нужно войти в аккаунт",
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    return this.listings.findByOwner(user.id);
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

  @Post()
  async create(@Body() dto: CreateListingDto, @CurrentUser() user?: AuthUser): Promise<Listing> {
    if (!user) {
      throw new AppException({
        code: "AUTH_REQUIRED",
        message: "Нужно войти в аккаунт",
        status: HttpStatus.UNAUTHORIZED,
      });
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

    return this.listings.create({
      ownerId: user.id,
      type: dto.type,
      fromCityId: dto.fromCityId,
      toCityId: dto.toCityId,
      date: dto.date,
      freeWeightKg: dto.freeWeightKg,
      pricePerKg: dto.pricePerKg,
      minPrice: dto.minPrice,
      description: dto.description,
    });
  }
}

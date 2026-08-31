import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { AdminGuard } from "../admin/admin.guard.js";
import { AdminRoleGuard } from "../admin/admin-role.guard.js";
import { CurrentAdmin } from "../admin/current-admin.decorator.js";
import { RequireAdminRole } from "../admin/require-admin-role.decorator.js";
import type { AdminUser } from "../admin/admin-user.repository.js";
import { CITIES_REPOSITORY, type ICitiesRepository } from "./cities.repository.js";
import { CURRENCIES_REPOSITORY, type ICurrenciesRepository } from "./currencies.repository.js";
import { DOCUMENT_TYPES_REPOSITORY, type IDocumentTypesRepository } from "./document-types.repository.js";
import { STOP_LIST_ITEMS_REPOSITORY, type IStopListItemsRepository } from "./stop-list-items.repository.js";
import {
  WEIGHT_REFERENCES_REPOSITORY,
  type IWeightReferencesRepository,
} from "./weight-references.repository.js";
import { CreateCityDto, UpdateCityDto } from "./dto/city.dto.js";
import { CreateCurrencyDto, UpdateCurrencyDto } from "./dto/currency.dto.js";
import { CreateWeightReferenceDto, UpdateWeightReferenceDto } from "./dto/weight-reference.dto.js";
import { CreateStopListItemDto, UpdateStopListItemDto } from "./dto/stop-list-item.dto.js";
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from "./dto/document-type.dto.js";

/**
 * CRUD справочников для админ-панели (E05 п. 5.6). Только сотрудники
 * (AdminGuard поверх глобального AuthGuard). Удаления нет ни для одной
 * сущности — только create/update/деактивация (5.20: физическое удаление
 * записи, на которую есть ссылки, запрещено; поскольку ссылающиеся эпики
 * (E07, E04...) ещё не реализованы, проверить "используется ли запись"
 * сейчас невозможно честно — поэтому удаление не открывается вовсе, только
 * отключение, которое безопасно всегда).
 */
@ApiTags("admin/directories")
@UseGuards(AdminGuard, AdminRoleGuard)
@RequireAdminRole("admin")
@Controller("admin/directories")
export class AdminDirectoriesController {
  constructor(
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
    @Inject(CURRENCIES_REPOSITORY) private readonly currencies: ICurrenciesRepository,
    @Inject(WEIGHT_REFERENCES_REPOSITORY) private readonly weightReferences: IWeightReferencesRepository,
    @Inject(STOP_LIST_ITEMS_REPOSITORY) private readonly stopListItems: IStopListItemsRepository,
    @Inject(DOCUMENT_TYPES_REPOSITORY) private readonly documentTypes: IDocumentTypesRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
  ) {}

  // === cities ===============================================================

  @Get("cities")
  async listCities() {
    return this.cities.findAll();
  }

  @Post("cities")
  async createCity(@Body() dto: CreateCityDto, @CurrentAdmin() admin: AdminUser) {
    const city = await this.cities.create(dto);
    await this.logChange(admin, "city.create", "city", city.id, null, city);
    return city;
  }

  @Patch("cities/:id")
  async updateCity(
    @Param("id") id: string,
    @Body() dto: UpdateCityDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.cities.findById(id);
    if (!before) throw new NotFoundException("Город не найден");

    const after = await this.cities.update(id, dto);
    await this.logChange(admin, "city.update", "city", id, before, after);
    return after;
  }

  @Patch("cities/:id/active")
  async setCityActive(
    @Param("id") id: string,
    @Body("isActive") isActive: boolean,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.cities.findById(id);
    if (!before) throw new NotFoundException("Город не найден");

    const after = await this.cities.setActive(id, isActive);
    await this.logChange(admin, isActive ? "city.activate" : "city.deactivate", "city", id, before, after);
    return after;
  }

  // === currencies ============================================================

  @Get("currencies")
  async listCurrencies() {
    return this.currencies.findAll();
  }

  @Post("currencies")
  async createCurrency(@Body() dto: CreateCurrencyDto, @CurrentAdmin() admin: AdminUser) {
    const currency = await this.currencies.create(dto);
    await this.logChange(admin, "currency.create", "currency", currency.id, null, currency);
    return currency;
  }

  @Patch("currencies/:id")
  async updateCurrency(
    @Param("id") id: string,
    @Body() dto: UpdateCurrencyDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findCurrencyOrThrow(id);
    const after = await this.currencies.update(id, dto);
    await this.logChange(admin, "currency.update", "currency", id, before, after);
    return after;
  }

  @Patch("currencies/:id/active")
  async setCurrencyActive(
    @Param("id") id: string,
    @Body("isActive") isActive: boolean,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findCurrencyOrThrow(id);
    const after = await this.currencies.setActive(id, isActive);
    await this.logChange(
      admin,
      isActive ? "currency.activate" : "currency.deactivate",
      "currency",
      id,
      before,
      after,
    );
    return after;
  }

  // === weight references =====================================================

  @Get("weight-references")
  async listWeightReferences() {
    return this.weightReferences.findAll();
  }

  @Post("weight-references")
  async createWeightReference(
    @Body() dto: CreateWeightReferenceDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const item = await this.weightReferences.create(dto);
    await this.logChange(admin, "weight_reference.create", "weight_reference", item.id, null, item);
    return item;
  }

  @Patch("weight-references/:id")
  async updateWeightReference(
    @Param("id") id: string,
    @Body() dto: UpdateWeightReferenceDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findWeightReferenceOrThrow(id);
    const after = await this.weightReferences.update(id, dto);
    await this.logChange(admin, "weight_reference.update", "weight_reference", id, before, after);
    return after;
  }

  @Patch("weight-references/:id/active")
  async setWeightReferenceActive(
    @Param("id") id: string,
    @Body("isActive") isActive: boolean,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findWeightReferenceOrThrow(id);
    const after = await this.weightReferences.setActive(id, isActive);
    await this.logChange(
      admin,
      isActive ? "weight_reference.activate" : "weight_reference.deactivate",
      "weight_reference",
      id,
      before,
      after,
    );
    return after;
  }

  // === stop list ==============================================================

  @Get("stop-list")
  async listStopListItems() {
    return this.stopListItems.findAll();
  }

  @Post("stop-list")
  async createStopListItem(@Body() dto: CreateStopListItemDto, @CurrentAdmin() admin: AdminUser) {
    const item = await this.stopListItems.create(dto);
    await this.logChange(admin, "stop_list_item.create", "stop_list_item", item.id, null, item);
    return item;
  }

  @Patch("stop-list/:id")
  async updateStopListItem(
    @Param("id") id: string,
    @Body() dto: UpdateStopListItemDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findStopListItemOrThrow(id);
    const after = await this.stopListItems.update(id, dto);
    await this.logChange(admin, "stop_list_item.update", "stop_list_item", id, before, after);
    return after;
  }

  @Patch("stop-list/:id/active")
  async setStopListItemActive(
    @Param("id") id: string,
    @Body("isActive") isActive: boolean,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findStopListItemOrThrow(id);
    const after = await this.stopListItems.setActive(id, isActive);
    await this.logChange(
      admin,
      isActive ? "stop_list_item.activate" : "stop_list_item.deactivate",
      "stop_list_item",
      id,
      before,
      after,
    );
    return after;
  }

  // === document types =========================================================

  @Get("document-types")
  async listDocumentTypes() {
    return this.documentTypes.findAll();
  }

  @Post("document-types")
  async createDocumentType(@Body() dto: CreateDocumentTypeDto, @CurrentAdmin() admin: AdminUser) {
    const item = await this.documentTypes.create(dto);
    await this.logChange(admin, "document_type.create", "document_type", item.id, null, item);
    return item;
  }

  @Patch("document-types/:id")
  async updateDocumentType(
    @Param("id") id: string,
    @Body() dto: UpdateDocumentTypeDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findDocumentTypeOrThrow(id);
    const after = await this.documentTypes.update(id, dto);
    await this.logChange(admin, "document_type.update", "document_type", id, before, after);
    return after;
  }

  @Patch("document-types/:id/active")
  async setDocumentTypeActive(
    @Param("id") id: string,
    @Body("isActive") isActive: boolean,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const before = await this.findDocumentTypeOrThrow(id);
    const after = await this.documentTypes.setActive(id, isActive);
    await this.logChange(
      admin,
      isActive ? "document_type.activate" : "document_type.deactivate",
      "document_type",
      id,
      before,
      after,
    );
    return after;
  }

  // === вспомогательное =========================================================

  private async findCurrencyOrThrow(id: string) {
    const found = await this.currencies.findById(id);
    if (!found) throw new NotFoundException("Валюта не найдена");
    return found;
  }

  private async findWeightReferenceOrThrow(id: string) {
    const found = await this.weightReferences.findById(id);
    if (!found) throw new NotFoundException("Справочная позиция веса не найдена");
    return found;
  }

  private async findStopListItemOrThrow(id: string) {
    const found = await this.stopListItems.findById(id);
    if (!found) throw new NotFoundException("Позиция стоп-листа не найдена");
    return found;
  }

  private async findDocumentTypeOrThrow(id: string) {
    const found = await this.documentTypes.findById(id);
    if (!found) throw new NotFoundException("Тип документа не найден");
    return found;
  }

  private async logChange(
    admin: AdminUser,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown | null,
    after: unknown | null,
  ): Promise<void> {
    await this.auditLog.create({ actorId: admin.id, action, entityType, entityId, before, after });
  }
}

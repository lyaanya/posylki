import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator.js";
import { CITIES_REPOSITORY, type ICitiesRepository } from "./cities.repository.js";
import { CURRENCIES_REPOSITORY, type ICurrenciesRepository } from "./currencies.repository.js";
import { DOCUMENT_TYPES_REPOSITORY, type IDocumentTypesRepository } from "./document-types.repository.js";
import { STOP_LIST_ITEMS_REPOSITORY, type IStopListItemsRepository } from "./stop-list-items.repository.js";
import {
  WEIGHT_REFERENCES_REPOSITORY,
  type IWeightReferencesRepository,
} from "./weight-references.repository.js";
import { SearchCitiesQueryDto } from "./dto/search-cities.query.js";
import type { City, Currency, DocumentType, StopListItem, WeightReference } from "./directories.types.js";

/**
 * Справочники читаются гостем без входа (E05 — нужны на экране выбора
 * города до регистрации) и полагаются на встроенный ETag/304 Express'а:
 * содержимое ответа не меняется, пока не изменится справочник, поэтому
 * повторный запрос с тем же содержимым получает 304 без выгрузки тела
 * (E05 п. 5.22 — отдельная метка версии не нужна).
 */
@ApiTags("directories")
@Controller("directories")
export class DirectoriesController {
  constructor(
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
    @Inject(CURRENCIES_REPOSITORY) private readonly currencies: ICurrenciesRepository,
    @Inject(WEIGHT_REFERENCES_REPOSITORY) private readonly weightReferences: IWeightReferencesRepository,
    @Inject(STOP_LIST_ITEMS_REPOSITORY) private readonly stopListItems: IStopListItemsRepository,
    @Inject(DOCUMENT_TYPES_REPOSITORY) private readonly documentTypes: IDocumentTypesRepository,
  ) {}

  @Public()
  @Get("cities")
  async getCities(@Query() query: SearchCitiesQueryDto): Promise<City[]> {
    return query.q ? this.cities.search(query.q) : this.cities.findAllActive();
  }

  @Public()
  @Get("currencies")
  async getCurrencies(): Promise<Currency[]> {
    return this.currencies.findAllActive();
  }

  @Public()
  @Get("weight-references")
  async getWeightReferences(): Promise<WeightReference[]> {
    return this.weightReferences.findAllActive();
  }

  @Public()
  @Get("stop-list")
  async getStopList(@Query("country") country?: string): Promise<StopListItem[]> {
    return this.stopListItems.findAllActive(country);
  }

  @Public()
  @Get("document-types")
  async getDocumentTypes(@Query("country") country?: string): Promise<DocumentType[]> {
    return this.documentTypes.findAllActive(country);
  }
}

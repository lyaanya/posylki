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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import sharp from "sharp";
import { AppException } from "../common/app-exception.js";
import { Public } from "../auth/public.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { USERS_REPOSITORY, type IUsersRepository } from "../auth/users.repository.js";
import type { AuthUser } from "../auth/users.repository.js";
import { CITIES_REPOSITORY, type ICitiesRepository } from "../directories/cities.repository.js";
import { AVATAR_STORAGE, type IAvatarStorage } from "./avatar-storage.js";
import { SetReferrerDto } from "./dto/set-referrer.dto.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { PROFILE_REPOSITORY, type IProfileRepository } from "./profile.repository.js";
import type { OwnProfile, PublicProfileView } from "./profile.types.js";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Разумный размер для аватара — E06 п. 6.12: обрезан до квадрата, уменьшен. */
const AVATAR_SIZE_PX = 512;

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

@ApiTags("profile")
@Controller("profile")
export class ProfileController {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: IProfileRepository,
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
    @Inject(AVATAR_STORAGE) private readonly avatarStorage: IAvatarStorage,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
  ) {}

  // "me" зарегистрирован раньше ":id" — иначе Nest примет "me" за id
  // (тот же порядок, что в listings.controller.ts: /mine перед /:id).
  @Get("me")
  async me(@CurrentUser() user?: AuthUser): Promise<OwnProfile> {
    if (!user) {
      throw authRequired();
    }
    const profile = await this.profiles.findOwnProfile(user.id);
    if (!profile) {
      throw new NotFoundException("Профиль не найден");
    }
    return profile;
  }

  @Patch("me")
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<OwnProfile> {
    if (!user) {
      throw authRequired();
    }

    if (dto.cityId) {
      const city = await this.cities.findById(dto.cityId);
      if (!city) {
        throw new AppException({
          code: "CITY_NOT_FOUND",
          message: "Город из справочника не найден",
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    return this.profiles.updateOwnProfile(user.id, dto);
  }

  /**
   * ТЗ E08 п.8.17 — переход по реферальной ссылке запоминает, кто кого
   * привёл. Идемпотентно: если у пользователя уже есть реферер, повторный
   * вызов ничего не меняет (см. profile.repository.supabase.ts, setReferrer).
   */
  @Post("me/referral")
  async setReferral(
    @Body() dto: SetReferrerDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<OwnProfile> {
    if (!user) {
      throw authRequired();
    }
    if (dto.referrerId === user.id) {
      throw new AppException({
        code: "CANNOT_REFER_SELF",
        message: "Нельзя указать себя в качестве пригласившего",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    const referrer = await this.profiles.findPublicProfile(dto.referrerId);
    if (!referrer) {
      throw new AppException({
        code: "REFERRER_NOT_FOUND",
        message: "Пригласивший пользователь не найден",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    return this.profiles.setReferrer(user.id, dto.referrerId);
  }

  /**
   * E06 п. 6.12: обрезка до квадрата и уменьшение — центр-кроп через
   * sharp.resize(..., { fit: "cover" }), без отдельного шага выбора рамки
   * пользователем (в макете E02 такого экрана нет). Веб загружает файлом,
   * камера — задача мобильного приложения (React Native), которого пока нет.
   */
  @Post("me/avatar")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_AVATAR_SIZE_BYTES } }))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user?: AuthUser,
  ): Promise<OwnProfile> {
    if (!user) {
      throw authRequired();
    }
    if (!file) {
      throw new AppException({
        code: "FILE_REQUIRED",
        message: "Нужно приложить файл фотографии",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
      throw new AppException({
        code: "INVALID_FILE_TYPE",
        message: "Поддерживаются только JPEG, PNG и WebP",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    let processed: Buffer;
    try {
      processed = await sharp(file.buffer)
        .rotate() // учитывает EXIF-ориентацию камеры, до обрезки в квадрат
        .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover" })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppException({
        code: "INVALID_IMAGE",
        message: "Не получилось обработать изображение — попробуйте другой файл",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const avatarUrl = await this.avatarStorage.upload(user.id, processed, "image/jpeg");
    return this.profiles.updateOwnProfile(user.id, { avatarUrl });
  }

  /**
   * ТЗ E03 п.22 / E12 п.12.17 — soft-delete, до этого эндпоинта нигде не
   * существовавший (см. отчёт по эпику): обезличивает профиль, но
   * document_number_hash сознательно не трогает, иначе заблокированный
   * удалил бы аккаунт и зарегистрировался заново на тот же документ.
   */
  @Delete("me")
  async deleteMe(@CurrentUser() user?: AuthUser): Promise<{ ok: true }> {
    if (!user) {
      throw authRequired();
    }
    await this.users.softDelete(user.id);
    return { ok: true };
  }

  @Public()
  @Get(":id")
  async publicProfile(@Param("id") id: string): Promise<PublicProfileView> {
    const view = await this.profiles.findPublicProfile(id);
    if (!view) {
      throw new NotFoundException("Профиль не найден");
    }
    return view;
  }
}

import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import sharp from "sharp";
import { AppException } from "../common/app-exception.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { COMPLAINT_PHOTO_STORAGE, type IComplaintPhotoStorage } from "./complaint-photo-storage.js";
import { COMPLAINTS_REPOSITORY, type IComplaintsRepository } from "./complaints.repository.js";
import { WARNINGS_REPOSITORY, type IWarningsRepository } from "./warnings.repository.js";
import { CreateComplaintDto } from "./dto/create-complaint.dto.js";
import type { Complaint, UserWarning } from "./moderation.types.js";

const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_MAX_DIMENSION_PX = 1600;

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

/**
 * Подача жалобы и предупреждения (ТЗ E12 пп.12.1-12.7, 12.12). Обработка
 * решений модератора — отдельный контроллер admin-moderation.controller.ts,
 * только для сотрудников.
 */
@ApiTags("moderation")
@Controller()
export class ModerationController {
  constructor(
    @Inject(COMPLAINTS_REPOSITORY) private readonly complaints: IComplaintsRepository,
    @Inject(WARNINGS_REPOSITORY) private readonly warnings: IWarningsRepository,
    @Inject(COMPLAINT_PHOTO_STORAGE) private readonly photoStorage: IComplaintPhotoStorage,
  ) {}

  @Post("complaints/photos")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_SIZE_BYTES } }))
  async uploadPhoto(
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
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppException({
        code: "INVALID_IMAGE",
        message: "Не получилось обработать изображение — попробуйте другой файл",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const path = await this.photoStorage.upload(user.id, processed, "image/jpeg");
    return { path };
  }

  /** ТЗ п.12.1-12.5. */
  @Post("complaints")
  async create(@Body() dto: CreateComplaintDto, @CurrentUser() user?: AuthUser): Promise<Complaint> {
    if (!user) throw authRequired();

    const existing = await this.complaints.findActive(user.id, dto.targetType, dto.targetId);
    if (existing) {
      throw new AppException({
        code: "COMPLAINT_ALREADY_ACTIVE",
        message: "У вас уже есть активная жалоба на этот объект",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return this.complaints.create({
      authorId: user.id,
      targetType: dto.targetType,
      targetId: dto.targetId,
      category: dto.category,
      comment: dto.comment ?? null,
      photoPaths: dto.photoPaths ?? [],
    });
  }

  /** ТЗ п.12.6 — автор видит статус своих жалоб. */
  @Get("complaints/mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<Complaint[]> {
    if (!user) throw authRequired();
    return this.complaints.findByAuthor(user.id);
  }

  /** ТЗ п.12.12 — самое старое непрочитанное предупреждение, показывается при следующем входе. */
  @Get("warnings/pending")
  async pendingWarning(@CurrentUser() user?: AuthUser): Promise<UserWarning | null> {
    if (!user) throw authRequired();
    return this.warnings.findOldestUnacknowledged(user.id);
  }

  @Post("warnings/:id/acknowledge")
  async acknowledge(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<UserWarning> {
    if (!user) throw authRequired();
    const acknowledged = await this.warnings.acknowledge(id, user.id);
    if (!acknowledged) {
      throw new AppException({
        code: "WARNING_NOT_FOUND",
        message: "Предупреждение не найдено или уже подтверждено",
        status: HttpStatus.NOT_FOUND,
      });
    }
    return acknowledged;
  }
}

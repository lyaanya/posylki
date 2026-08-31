import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
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
import { DOCUMENT_TYPES_REPOSITORY, type IDocumentTypesRepository } from "../directories/document-types.repository.js";
import { hashDocumentNumber } from "./document-hash.js";
import { SubmitVerificationDto } from "./dto/submit-verification.dto.js";
import {
  VERIFICATION_PHOTO_STORAGE,
  type IVerificationPhotoStorage,
} from "./verification-photo-storage.js";
import {
  VERIFICATION_REQUESTS_REPOSITORY,
  type IVerificationRequestsRepository,
} from "./verification-requests.repository.js";
import type { OwnVerificationStatus, VerificationRequest } from "./verification.types.js";

const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Выше, чем у обычных фото в сервисе — текст документа должен оставаться читаемым. */
const PHOTO_MAX_DIMENSION_PX = 2000;

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

/**
 * ТЗ E04 (минимальная реализация вместе с E16 — см. отчёт эпика 16):
 * подача заявки на верификацию. Очередь и решения — в
 * admin-verification.controller.ts.
 */
@ApiTags("verification")
@Controller("verification")
export class VerificationController {
  constructor(
    @Inject(VERIFICATION_REQUESTS_REPOSITORY) private readonly requests: IVerificationRequestsRepository,
    @Inject(VERIFICATION_PHOTO_STORAGE) private readonly photoStorage: IVerificationPhotoStorage,
    @Inject(DOCUMENT_TYPES_REPOSITORY) private readonly documentTypes: IDocumentTypesRepository,
  ) {}

  @Post("photos")
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
        .jpeg({ quality: 90 })
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

  /** ТЗ E04 — одна активная заявка одновременно, повторная подача при pending отклоняется. */
  @Post()
  async submit(@Body() dto: SubmitVerificationDto, @CurrentUser() user?: AuthUser): Promise<VerificationRequest> {
    if (!user) throw authRequired();

    const existing = await this.requests.findActiveForUser(user.id);
    if (existing) {
      throw new AppException({
        code: "VERIFICATION_ALREADY_PENDING",
        message: "У вас уже есть заявка на рассмотрении",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const documentType = await this.documentTypes.findAllActive().then((types) =>
      types.find((t) => t.id === dto.documentType),
    );
    if (!documentType) {
      throw new AppException({
        code: "DOCUMENT_TYPE_NOT_FOUND",
        message: "Тип документа из справочника не найден",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return this.requests.create({
      userId: user.id,
      documentType: dto.documentType,
      submittedFirstName: dto.firstName,
      submittedLastName: dto.lastName,
      submittedDateOfBirth: dto.dateOfBirth,
      documentNumberHash: hashDocumentNumber(dto.documentNumber),
      documentPhotoPath: dto.documentPhotoPath,
      selfiePhotoPath: dto.selfiePhotoPath,
    });
  }

  @Get("mine")
  async findMine(@CurrentUser() user?: AuthUser): Promise<OwnVerificationStatus> {
    if (!user) throw authRequired();
    const latest = await this.requests.findLatestForUser(user.id);
    return {
      status: user.verificationStatus,
      latestRequest: latest
        ? {
            status: latest.status,
            rejectionReasonCode: latest.rejectionReasonCode,
            rejectionComment: latest.rejectionComment,
            createdAt: latest.createdAt,
          }
        : null,
    };
  }
}

import type { Executor } from "../database/database.js";
import type { VerificationStatus } from "./auth.types.js";

export interface AuthUser {
  id: string;
  email: string;
  verificationStatus: VerificationStatus;
  isBlocked: boolean;
  /** ТЗ E12 п.12.15 — заблокированный должен видеть причину, не только факт блокировки. */
  blockedReason: string | null;
  deletedAt: Date | null;
  /** ТЗ E09 п.9.17 — писать в чат можно только с подтверждённым email. */
  emailConfirmed: boolean;
}

export interface IUsersRepository {
  findById(id: string, executor?: Executor): Promise<AuthUser | null>;
  /** ТЗ E12 п.12.15/12.19 — денормализованный флаг блокировки, источник истины — user_bans. */
  setBlocked(id: string, isBlocked: boolean, reason: string | null, executor?: Executor): Promise<void>;
  /** ТЗ E12 п.12.17/E03 п.22 — soft-delete, хэш документа не трогается. */
  softDelete(id: string, executor?: Executor): Promise<void>;
  /**
   * ТЗ E04 п.4.5 / E12 п.12.16 — id пользователя, за которым уже числится
   * этот хэш документа (независимо от того, активен он, заблокирован или
   * удалён — хэш переживает удаление, см. softDelete), либо null. Хэш
   * записывается только при одобрении заявки, так что совпадение всегда
   * означает "этот же физический документ уже подтверждён на другом
   * аккаунте".
   */
  findIdByDocumentHash(documentNumberHash: string, executor?: Executor): Promise<string | null>;
  /**
   * ТЗ E04/E06 п.6.9 — при одобрении имя и дата рождения приходят из
   * проверенного документа, а не остаются тем, что пользователь вписал
   * сам; при отклонении меняется только статус. Хэш номера документа
   * записывается только при одобрении (E12 п.12.16 сравнивает по нему
   * только подтверждённые документы).
   */
  approveVerification(
    id: string,
    input: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      documentType: string;
      documentNumberHash: string;
      adminId: string;
    },
    executor?: Executor,
  ): Promise<void>;
  rejectVerification(id: string, executor?: Executor): Promise<void>;
}

export const USERS_REPOSITORY = Symbol("USERS_REPOSITORY");

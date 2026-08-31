import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { USERS_REPOSITORY, type IUsersRepository } from "../auth/users.repository.js";
import { BANS_REPOSITORY, type IBansRepository } from "./bans.repository.js";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";

/** ТЗ п.12.14 — временная блокировка снимается автоматически по истечении срока. */
@Injectable()
export class ModerationCronService {
  private readonly logger = new Logger(ModerationCronService.name);

  constructor(
    @Inject(BANS_REPOSITORY) private readonly bans: IBansRepository,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const expired = await this.bans.findExpiredActive(new Date());
    for (const ban of expired) {
      await this.bans.unban(ban.id, null, "Истёк срок временной блокировки");
      await this.users.setBlocked(ban.userId, false, null);
      // audit_log.actor_id — not null без FK на admin_users; для автоматического
      // события пишем id самого пользователя (действие "auto_unban" в имени
      // само говорит, что это не решение модератора).
      await this.auditLog.create({
        actorId: ban.userId,
        action: "moderation.auto_unban",
        entityType: "user",
        entityId: ban.userId,
        reason: "Истёк срок временной блокировки",
      });
    }
    if (expired.length > 0) {
      this.logger.log(`Автоматически сняты временные блокировки: ${expired.length}`);
    }
  }
}

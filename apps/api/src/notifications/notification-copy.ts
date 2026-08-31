import type { NotificationEvent } from "./notifications.types.js";

export interface NotificationCopy {
  title: string;
  body: string;
  deepLink: string;
}

/**
 * ТЗ п.14.24 — тексты уведомлений централизованы в одном файле, а не
 * разбросаны по контроллерам/сервисам. Полноценной системы локализации
 * (E02) в проекте нет — продукт на данном этапе одноязычный (см. весь
 * apps/web/src/lib/dictionary.ts тем же способом), поэтому это один
 * русскоязычный модуль, а не набор файлов по языкам; переход на несколько
 * языков не потребует трогать вызывающий код — только этот файл.
 *
 * ТЗ п.14.22 — текст сообщения никогда не попадает сюда: только имя
 * отправителя и факт события.
 */
export const notificationCopy = {
  chatMessage(senderName: string, chatId: string, groupedCount: number): NotificationCopy {
    return {
      title: "Новое сообщение",
      body:
        groupedCount > 1
          ? `${senderName}: ${groupedCount} новых сообщений`
          : `${senderName} написал(а) вам`,
      deepLink: `/chat/${chatId}`,
    };
  },
  dealCreated(counterpartName: string, dealId: string): NotificationCopy {
    return {
      title: "Новая сделка",
      body: `${counterpartName} — сделка оформлена`,
      deepLink: `/deals/${dealId}`,
    };
  },
  dealStatusChanged(statusLabel: string, dealId: string): NotificationCopy {
    return {
      title: "Статус сделки изменился",
      body: statusLabel,
      deepLink: `/deals/${dealId}`,
    };
  },
  dealOverweightReconfirm(dealId: string): NotificationCopy {
    return {
      title: "Нужно подтвердить условия заново",
      body: "Фактический вес больше заявленного — цена пересчитана",
      deepLink: `/deals/${dealId}`,
    };
  },
  storageExtensionRequested(dealId: string): NotificationCopy {
    return {
      title: "Запрос на продление хранения",
      body: "Партнёр по сделке просит продлить срок хранения посылки",
      deepLink: `/deals/${dealId}`,
    };
  },
  storageExtensionDecided(approved: boolean, dealId: string): NotificationCopy {
    return {
      title: "Ответ на запрос о продлении",
      body: approved ? "Продление срока хранения одобрено" : "В продлении срока хранения отказано",
      deepLink: `/deals/${dealId}`,
    };
  },
  storageReminder(kind: "3d" | "1d" | "expiry", dealId: string): NotificationCopy {
    const body =
      kind === "expiry"
        ? "Сегодня истекает срок хранения посылки"
        : `До истечения срока хранения посылки осталось ${kind === "3d" ? "3 дня" : "1 день"}`;
    return { title: "Напоминание о сроке хранения", body, deepLink: `/deals/${dealId}` };
  },
  reviewPublished(dealId: string): NotificationCopy {
    return {
      title: "Опубликован отзыв о вас",
      body: "По завершённой сделке появился новый отзыв",
      deepLink: `/deals/${dealId}`,
    };
  },
  reviewReminder(dealId: string): NotificationCopy {
    return {
      title: "Не забудьте оставить отзыв",
      body: "Это помогает другим пользователям сервиса",
      deepLink: `/deals/${dealId}`,
    };
  },
  complaintDecided(): NotificationCopy {
    return {
      title: "Решение по жалобе",
      body: "По вашей жалобе принято решение",
      deepLink: "/complaints",
    };
  },
  moderatorWarning(): NotificationCopy {
    return {
      title: "Предупреждение от администрации",
      body: "Ознакомьтесь с предупреждением в приложении",
      deepLink: "/profile",
    };
  },
  supportReply(): NotificationCopy {
    return {
      title: "Ответ поддержки",
      body: "В вашем обращении новое сообщение",
      deepLink: "/support",
    };
  },
  /** ТЗ п.15.17 — модератору, без содержимого сообщения пользователя. */
  supportTicketAlert(isNewTicket: boolean): NotificationCopy {
    return {
      title: isNewTicket ? "Новое обращение в поддержку" : "Новое сообщение в обращении",
      body: "Требуется ответ модератора",
      deepLink: "/admin",
    };
  },
  verificationResult(approved: boolean): NotificationCopy {
    return {
      title: "Результат верификации",
      body: approved ? "Верификация пройдена" : "Заявка отклонена — подробности в профиле",
      deepLink: "/profile",
    };
  },
} satisfies Record<string, (...args: never[]) => NotificationCopy>;

/** Название события для служебных нужд (лог, дебаг) — не показывается пользователю. */
export const EVENT_DEBUG_LABEL: Record<NotificationEvent, string> = {
  chat_message: "Новое сообщение в чате",
  deal_created: "Сделка создана",
  deal_status_changed: "Смена статуса сделки",
  deal_overweight_reconfirm: "Требуется переподтверждение при перевесе",
  storage_extension_requested: "Запрос на продление хранения",
  storage_extension_decided: "Ответ на продление хранения",
  storage_reminder: "Напоминание о сроке хранения",
  review_published: "Опубликован отзыв о вас",
  review_reminder: "Напоминание оставить отзыв",
  complaint_decided: "Решение по жалобе",
  moderator_warning: "Предупреждение от модератора",
  support_reply: "Ответ поддержки",
  support_ticket_alert: "Уведомление модератору об обращении",
  verification_result: "Результат верификации",
};

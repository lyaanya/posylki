-- ТЗ E15 пп.15.16-15.17 — ответ поддержки пользователю и уведомление
-- модераторам о новом обращении/сообщении.
alter table notifications drop constraint notifications_event_check;
alter table notifications add constraint notifications_event_check check (
  event in (
    'chat_message',
    'deal_created',
    'deal_status_changed',
    'deal_overweight_reconfirm',
    'storage_extension_requested',
    'storage_extension_decided',
    'storage_reminder',
    'review_published',
    'review_reminder',
    'complaint_decided',
    'moderator_warning',
    'support_reply',
    'support_ticket_alert'
  )
);

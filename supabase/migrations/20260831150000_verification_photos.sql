-- E04 (верификация) — минимальная реальная реализация вместе с E16
-- (очередь верификации бессмысленна без реальных заявок). Пути к фото
-- существуют только до решения модератора: после approve/reject оба поля
-- обнуляются, а сами объекты удаляются из бакета немедленно и
-- безвозвратно (ТЗ п.16.10/E04.15) — сама заявка (даты, тип документа,
-- хэш номера, статус) остаётся в истории.
alter table verification_requests
  add column document_photo_path text,
  add column selfie_photo_path text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('verification-photos', 'verification-photos', false, 8388608)
on conflict (id) do nothing;

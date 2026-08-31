-- Приватный бакет для фотографий-доказательств к жалобе (ТЗ п.12.3).
insert into storage.buckets (id, name, public, file_size_limit)
values ('complaint-photos', 'complaint-photos', false, 8388608)
on conflict (id) do nothing;

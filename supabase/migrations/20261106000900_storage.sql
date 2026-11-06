-- =====================================================================
-- ZAWELI · Migration 0900 — Buckets Supabase Storage
--
-- Aucune politique n'est créée sur storage.objects pour anon/authenticated :
--  * l'envoi se fait par URL d'envoi signée émise par l'API ;
--  * la lecture privée se fait par URL signée émise par l'API ;
--  * seuls « published » et « music » sont lisibles publiquement
--    (chemins aléatoires, architecture A11).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Fichiers bruts envoyés par l'expéditeur (avant contrôle).
  ('uploads',   'uploads',   false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  -- Variantes traitées des brouillons (privées).
  ('media',     'media',     false, 10485760, array['image/webp']),
  -- Variantes des expériences publiées (lecture publique, chemins UUID).
  ('published', 'published', true,  10485760, array['image/webp']),
  -- Bibliothèque musicale sous licence.
  ('music',     'music',     true,  15728640, array['audio/mpeg', 'audio/aac', 'audio/mp4', 'audio/ogg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

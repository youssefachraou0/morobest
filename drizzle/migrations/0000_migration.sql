
-- ===== ENUMS =====
create type public.title_kind as enum ('movie','series','anime','manga');
create type public.app_role as enum ('admin','editor','user');

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ===== REFERENCE =====
create table public.countries (
  code text primary key, slug text not null unique,
  name_en text not null, name_fr text not null, name_ar text not null,
  is_arab boolean not null default false, region text
);
create table public.genres (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name_en text not null, name_fr text not null, name_ar text not null
);
create table public.languages (code text primary key, name_en text not null, name_fr text not null, name_ar text not null);
create table public.studios (id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, kind text not null default 'studio');
create table public.people (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  name_ar text, photo_url text, bio text, created_at timestamptz not null default now()
);

-- ===== TITLES =====
create table public.titles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind public.title_kind not null,
  original_title text not null,
  year int, release_date date, runtime_min int,
  age_rating int not null default 0,
  status text not null default 'released', -- released, airing, completed, upcoming
  rating numeric(3,1), popularity int not null default 0,
  poster_url text, backdrop_url text, trailer_url text,
  is_kids boolean not null default false,
  is_classic boolean not null default false,
  format text, -- anime: tv, movie, ova, ona, special ; manga: manga, manhwa, manhua
  studio_id uuid references public.studios(id) on delete set null,
  published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index titles_kind_idx on public.titles(kind);
create index titles_pop_idx on public.titles(popularity desc);
create index titles_year_idx on public.titles(year);
create trigger titles_touch before update on public.titles for each row execute function public.touch_updated_at();

create table public.title_translations (
  title_id uuid not null references public.titles(id) on delete cascade,
  locale text not null, title text not null, tagline text, synopsis text,
  primary key (title_id, locale)
);
create table public.title_genres (title_id uuid references public.titles(id) on delete cascade, genre_id uuid references public.genres(id) on delete cascade, primary key(title_id, genre_id));
create index title_genres_genre_idx on public.title_genres(genre_id);
create table public.title_countries (title_id uuid references public.titles(id) on delete cascade, country_code text references public.countries(code) on delete cascade, primary key(title_id, country_code));
create index title_countries_c_idx on public.title_countries(country_code);
create table public.title_languages (title_id uuid references public.titles(id) on delete cascade, language_code text references public.languages(code) on delete cascade, kind text not null default 'original', primary key(title_id, language_code, kind));
create table public.credits (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role text not null, character_name text, ord int not null default 0
);
create index credits_title_idx on public.credits(title_id);
create table public.title_relations (
  from_id uuid references public.titles(id) on delete cascade,
  to_id uuid references public.titles(id) on delete cascade,
  relation text not null, primary key(from_id, to_id, relation)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  number int not null, name text, year int, unique(title_id, number)
);
create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  number int not null, title text not null, synopsis text, runtime_min int,
  air_date date, thumbnail_url text, unique(season_id, number)
);
create table public.manga_volumes (id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete cascade, number int not null, release_date date, cover_url text, unique(title_id, number));
create table public.manga_chapters (id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete cascade, volume_id uuid references public.manga_volumes(id) on delete set null, number numeric not null, title text, release_date date, readable boolean not null default false, official_url text, unique(title_id, number));

create table public.ramadan_seasons (id uuid primary key default gen_random_uuid(), year int not null unique, starts_on date not null, ends_on date not null, is_current boolean not null default false);
create table public.ramadan_entries (
  season_id uuid references public.ramadan_seasons(id) on delete cascade,
  title_id uuid references public.titles(id) on delete cascade,
  air_time text, status text not null default 'airing', primary key(season_id, title_id)
);

create table public.collections (id uuid primary key default gen_random_uuid(), slug text not null unique, name_en text not null, name_fr text not null, name_ar text not null, description_en text, cover_url text, ord int not null default 0);
create table public.collection_items (collection_id uuid references public.collections(id) on delete cascade, title_id uuid references public.titles(id) on delete cascade, ord int not null default 0, primary key(collection_id, title_id));

-- Video sources: never readable directly; served via function
create table public.video_sources (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  kind text not null default 'hls', url text not null, provider text,
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.subtitle_tracks (id uuid primary key default gen_random_uuid(), video_source_id uuid not null references public.video_sources(id) on delete cascade, lang text not null, label text not null, url text not null);

-- ===== ROLES =====
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role public.app_role not null, unique(user_id, role));
create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ===== USER DATA =====
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  display_name text not null, avatar text not null default 'star',
  is_kids boolean not null default false, max_age int not null default 18,
  locale text not null default 'en', subtitle_lang text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index profiles_user_idx on public.profiles(user_id);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.owns_profile(_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = _profile and user_id = auth.uid())
$$;

create table public.watchlist (profile_id uuid references public.profiles(id) on delete cascade, title_id uuid references public.titles(id) on delete cascade, created_at timestamptz not null default now(), primary key(profile_id, title_id));
create table public.favorites (profile_id uuid references public.profiles(id) on delete cascade, title_id uuid references public.titles(id) on delete cascade, created_at timestamptz not null default now(), primary key(profile_id, title_id));
create table public.ratings (profile_id uuid references public.profiles(id) on delete cascade, title_id uuid references public.titles(id) on delete cascade, score int not null check (score between 1 and 10), created_at timestamptz not null default now(), primary key(profile_id, title_id));
create table public.playback_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  position_s int not null default 0, duration_s int not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index playback_unique on public.playback_progress(profile_id, title_id, coalesce(episode_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index playback_recent on public.playback_progress(profile_id, updated_at desc);

-- ===== GRANTS =====
grant select on public.countries, public.genres, public.languages, public.studios, public.people, public.titles,
  public.title_translations, public.title_genres, public.title_countries, public.title_languages, public.credits,
  public.title_relations, public.seasons, public.episodes, public.manga_volumes, public.manga_chapters,
  public.ramadan_seasons, public.ramadan_entries, public.collections, public.collection_items to anon, authenticated;
grant insert, update, delete on public.countries, public.genres, public.languages, public.studios, public.people, public.titles,
  public.title_translations, public.title_genres, public.title_countries, public.title_languages, public.credits,
  public.title_relations, public.seasons, public.episodes, public.manga_volumes, public.manga_chapters,
  public.ramadan_seasons, public.ramadan_entries, public.collections, public.collection_items,
  public.video_sources, public.subtitle_tracks to authenticated;
grant select on public.video_sources, public.subtitle_tracks to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.profiles, public.watchlist, public.favorites, public.ratings, public.playback_progress to authenticated;
grant all on all tables in schema public to service_role;

-- ===== RLS =====
do $$ declare t text; begin
  foreach t in array array['countries','genres','languages','studios','people','titles','title_translations','title_genres','title_countries','title_languages','credits','title_relations','seasons','episodes','manga_volumes','manga_chapters','ramadan_seasons','ramadan_entries','collections','collection_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.has_role(auth.uid(), ''admin'') or public.has_role(auth.uid(), ''editor'')) with check (public.has_role(auth.uid(), ''admin'') or public.has_role(auth.uid(), ''editor''))', t);
  end loop;
end $$;

alter table public.video_sources enable row level security;
create policy "admin manage sources" on public.video_sources for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
alter table public.subtitle_tracks enable row level security;
create policy "admin manage subs" on public.subtitle_tracks for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

alter table public.profiles enable row level security;
create policy "own profiles" on public.profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['watchlist','favorites','ratings','playback_progress'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own %1$s" on public.%1$I for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id))', t);
  end loop;
end $$;

-- Playback source resolver (sources never directly readable)
create or replace function public.get_playback_source(_title uuid, _episode uuid default null)
returns table(kind text, url text, subtitles jsonb)
language sql stable security definer set search_path = public as $$
  select vs.kind, vs.url,
    coalesce((select jsonb_agg(jsonb_build_object('lang', st.lang, 'label', st.label, 'url', st.url)) from public.subtitle_tracks st where st.video_source_id = vs.id), '[]'::jsonb)
  from public.video_sources vs
  where vs.title_id = _title and vs.is_active
    and (vs.episode_id = _episode or vs.episode_id is null)
  order by (vs.episode_id is null) asc
  limit 1
$$;
grant execute on function public.get_playback_source(uuid, uuid) to anon, authenticated;

-- ===== SEED: reference =====
insert into public.countries (code, slug, name_en, name_fr, name_ar, is_arab, region) values
('MA','morocco','Morocco','Maroc','المغرب',true,'maghreb'),
('DZ','algeria','Algeria','Algérie','الجزائر',true,'maghreb'),
('TN','tunisia','Tunisia','Tunisie','تونس',true,'maghreb'),
('LY','libya','Libya','Libye','ليبيا',true,'maghreb'),
('EG','egypt','Egypt','Égypte','مصر',true,'egypt'),
('SA','saudi-arabia','Saudi Arabia','Arabie saoudite','السعودية',true,'gulf'),
('AE','uae','United Arab Emirates','Émirats arabes unis','الإمارات',true,'gulf'),
('KW','kuwait','Kuwait','Koweït','الكويت',true,'gulf'),
('QA','qatar','Qatar','Qatar','قطر',true,'gulf'),
('BH','bahrain','Bahrain','Bahreïn','البحرين',true,'gulf'),
('OM','oman','Oman','Oman','عمان',true,'gulf'),
('IQ','iraq','Iraq','Irak','العراق',true,'levant'),
('SY','syria','Syria','Syrie','سوريا',true,'levant'),
('LB','lebanon','Lebanon','Liban','لبنان',true,'levant'),
('JO','jordan','Jordan','Jordanie','الأردن',true,'levant'),
('PS','palestine','Palestine','Palestine','فلسطين',true,'levant'),
('YE','yemen','Yemen','Yémen','اليمن',true,'gulf'),
('SD','sudan','Sudan','Soudan','السودان',true,'africa'),
('US','united-states','United States','États-Unis','الولايات المتحدة',false,null),
('FR','france','France','France','فرنسا',false,null),
('ES','spain','Spain','Espagne','إسبانيا',false,null),
('JP','japan','Japan','Japon','اليابان',false,null),
('KR','south-korea','South Korea','Corée du Sud','كوريا الجنوبية',false,null),
('CN','china','China','Chine','الصين',false,null),
('GB','united-kingdom','United Kingdom','Royaume-Uni','المملكة المتحدة',false,null);

insert into public.languages values ('ar','Arabic','Arabe','العربية'),('fr','French','Français','الفرنسية'),('en','English','Anglais','الإنجليزية'),('ja','Japanese','Japonais','اليابانية'),('ko','Korean','Coréen','الكورية'),('es','Spanish','Espagnol','الإسبانية'),('zgh','Amazigh','Amazighe','الأمازيغية');

insert into public.genres (slug, name_en, name_fr, name_ar) values
('drama','Drama','Drame','دراما'),('comedy','Comedy','Comédie','كوميديا'),('action','Action','Action','أكشن'),
('thriller','Thriller','Thriller','إثارة'),('crime','Crime','Policier','جريمة'),('sci-fi','Sci-Fi','Science-fiction','خيال علمي'),
('fantasy','Fantasy','Fantastique','فانتازيا'),('romance','Romance','Romance','رومانسية'),('history','History','Histoire','تاريخ'),
('mystery','Mystery','Mystère','غموض'),('family','Family','Famille','عائلي'),('adventure','Adventure','Aventure','مغامرة'),
('animation','Animation','Animation','رسوم متحركة'),('documentary','Documentary','Documentaire','وثائقي'),('horror','Horror','Horreur','رعب');

insert into public.studios (slug, name) values ('atlas-studios','Atlas Studios'),('kumo-animation','Kumo Animation'),('nile-pictures','Nile Pictures'),('lantern-kids','Lantern Kids');

insert into public.people (slug, name, name_ar) values
('yasmine-alaoui','Yasmine Alaoui','ياسمين العلوي'),('karim-bennani','Karim Bennani','كريم بناني'),('omar-said','Omar Saïd','عمر سعيد'),
('leila-haddad','Leila Haddad','ليلى حداد'),('nadia-farouk','Nadia Farouk','نادية فاروق'),('hiro-tanaka','Hiro Tanaka',null),
('claire-moreau','Claire Moreau',null),('james-holt','James Holt',null),('amine-chraibi','Amine Chraïbi','أمين الشرايبي'),('sara-mansour','Sara Mansour','سارة منصور');

-- ===== SEED: titles =====
insert into public.titles (id, slug, kind, original_title, year, release_date, runtime_min, age_rating, status, rating, popularity, poster_url, backdrop_url, is_kids, is_classic, format, studio_id) values
('00000000-0000-0000-0000-000000000001','the-last-caravan','movie','The Last Caravan',2025,'2025-11-14',128,13,'released',8.4,980,'/images/posters/p1.jpg','/images/backdrops/b1.jpg',false,false,null,(select id from public.studios where slug='atlas-studios')),
('00000000-0000-0000-0000-000000000002','atlas-noir','movie','Atlas Noir',2026,'2026-03-02',114,16,'released',7.9,940,'/images/posters/p2.jpg','/images/backdrops/b2.jpg',false,false,null,(select id from public.studios where slug='atlas-studios')),
('00000000-0000-0000-0000-000000000003','nile-of-ashes','movie','Nile of Ashes',2024,'2024-09-20',122,16,'released',7.6,720,'/images/posters/p3.jpg','/images/backdrops/b3.jpg',false,false,null,(select id from public.studios where slug='nile-pictures')),
('00000000-0000-0000-0000-000000000004','orbit-of-silence','movie','Orbit of Silence',2026,'2026-05-10',136,13,'released',8.1,960,'/images/posters/p4.jpg','/images/backdrops/b4.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000005','the-glass-harbor','series','Le Port de Verre',2025,'2025-02-01',48,16,'completed',8.2,810,'/images/posters/p5.jpg','/images/backdrops/b3.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000006','dar-el-bacha','series','Dar El Bacha',2026,'2026-02-18',35,0,'completed',8.0,990,'/images/posters/p6.jpg','/images/backdrops/b1.jpg',false,false,null,(select id from public.studios where slug='atlas-studios')),
('00000000-0000-0000-0000-000000000007','old-quarter','series','Al Hara Al Qadima',2025,'2025-03-01',45,13,'completed',7.8,700,'/images/posters/p7.jpg','/images/backdrops/b2.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000008','cairo-midnight','series','Cairo Midnight',2026,'2026-02-18',42,16,'completed',8.3,970,'/images/posters/p3.jpg','/images/backdrops/b3.jpg',false,false,null,(select id from public.studios where slug='nile-pictures')),
('00000000-0000-0000-0000-000000000009','dunes-of-oran','series','Dunes of Oran',2026,'2026-02-18',40,13,'completed',7.5,640,'/images/posters/p1.jpg','/images/backdrops/b1.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000010','tunis-blue','series','Tunis Blue',2025,'2025-10-05',44,13,'airing',7.7,610,'/images/posters/p5.jpg','/images/backdrops/b2.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000011','gulf-tides','series','Gulf Tides',2026,'2026-02-18',45,13,'completed',7.4,680,'/images/posters/p2.jpg','/images/backdrops/b4.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000012','ronin-of-the-moon','anime','Tsuki no Rōnin',2024,'2024-04-06',24,13,'airing',8.7,950,'/images/posters/p8.jpg','/images/backdrops/b4.jpg',false,false,'tv',(select id from public.studios where slug='kumo-animation')),
('00000000-0000-0000-0000-000000000013','starfall-academy','anime','Hoshifuri Gakuen',2026,'2026-07-04',24,13,'airing',8.0,880,'/images/posters/p9.jpg','/images/backdrops/b4.jpg',false,false,'tv',(select id from public.studios where slug='kumo-animation')),
('00000000-0000-0000-0000-000000000014','ronin-of-the-moon-crimson-tide','anime','Tsuki no Rōnin: Crimson Tide',2025,'2025-12-12',108,13,'released',8.5,820,'/images/posters/p8.jpg','/images/backdrops/b2.jpg',false,false,'movie',(select id from public.studios where slug='kumo-animation')),
('00000000-0000-0000-0000-000000000015','ink-dragon','manga','Sumi no Ryū',2021,'2021-01-10',null,13,'airing',8.6,860,'/images/posters/p9.jpg','/images/backdrops/b4.jpg',false,false,'manga',null),
('00000000-0000-0000-0000-000000000016','seoul-cipher','manga','Seoul Cipher',2023,'2023-05-01',null,13,'completed',8.1,700,'/images/posters/p4.jpg','/images/backdrops/b3.jpg',false,false,'manhwa',null),
('00000000-0000-0000-0000-000000000017','little-lantern','movie','Little Lantern',2025,'2025-07-01',92,0,'released',8.2,780,'/images/posters/p10.jpg','/images/backdrops/b1.jpg',true,false,null,(select id from public.studios where slug='lantern-kids')),
('00000000-0000-0000-0000-000000000018','zellij-explorers','series','Zellij Explorers',2024,'2024-09-01',12,0,'airing',8.0,650,'/images/posters/p10.jpg','/images/backdrops/b1.jpg',true,false,null,(select id from public.studios where slug='lantern-kids')),
('00000000-0000-0000-0000-000000000019','casablanca-1958','movie','Casablanca 1958',1958,'1958-05-01',101,0,'released',8.3,500,'/images/posters/p7.jpg','/images/backdrops/b2.jpg',false,true,null,null),
('00000000-0000-0000-0000-000000000020','the-andalusian-letters','movie','Cartas de Al-Andalus',1972,'1972-10-01',118,0,'released',8.0,420,'/images/posters/p6.jpg','/images/backdrops/b1.jpg',false,true,null,null),
('00000000-0000-0000-0000-000000000021','desert-falcon','movie','Desert Falcon',2025,'2025-06-20',124,16,'released',7.3,900,'/images/posters/p2.jpg','/images/backdrops/b4.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000022','midnight-in-fez','movie','Minuit à Fès',2023,'2023-02-14',106,13,'released',7.9,600,'/images/posters/p6.jpg','/images/backdrops/b1.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000023','kingdom-of-sand','series','Kingdom of Sand',2024,'2024-03-01',55,16,'completed',8.4,840,'/images/posters/p7.jpg','/images/backdrops/b2.jpg',false,false,null,null),
('00000000-0000-0000-0000-000000000024','moon-garden','manga','Yuè Huāyuán',2022,'2022-08-01',null,0,'airing',7.8,520,'/images/posters/p10.jpg','/images/backdrops/b1.jpg',true,false,'manhua',null);

insert into public.title_translations (title_id, locale, title, tagline, synopsis) values
('00000000-0000-0000-0000-000000000001','en','The Last Caravan','Every road ends in a story.','A salt trader leads one final caravan across the Sahara as a modern border closes behind him.'),
('00000000-0000-0000-0000-000000000001','fr','La Dernière Caravane','Chaque route finit en histoire.','Un marchand de sel mène une dernière caravane à travers le Sahara alors qu''une frontière moderne se referme.'),
('00000000-0000-0000-0000-000000000001','ar','القافلة الأخيرة','كل طريق ينتهي بحكاية.','تاجر ملح يقود قافلته الأخيرة عبر الصحراء بينما تُغلق حدود حديثة خلفه.'),
('00000000-0000-0000-0000-000000000002','en','Atlas Noir','The mountain keeps its secrets.','A Marrakech detective follows a vanished heiress into the High Atlas.'),
('00000000-0000-0000-0000-000000000002','fr','Atlas Noir','La montagne garde ses secrets.','Une détective de Marrakech suit une héritière disparue dans le Haut Atlas.'),
('00000000-0000-0000-0000-000000000002','ar','أطلس الأسود','الجبل يحفظ أسراره.','محققة من مراكش تتعقب وريثة مختفية في جبال الأطلس الكبير.'),
('00000000-0000-0000-0000-000000000003','en','Nile of Ashes',null,'A Cairo journalist uncovers a smuggling ring along the river.'),
('00000000-0000-0000-0000-000000000003','fr','Le Nil de cendres',null,'Un journaliste cairote découvre un réseau de contrebande sur le fleuve.'),
('00000000-0000-0000-0000-000000000003','ar','نيل الرماد',null,'صحفي قاهري يكشف شبكة تهريب على ضفاف النيل.'),
('00000000-0000-0000-0000-000000000004','en','Orbit of Silence','No signal. No return.','The last crew of a deep-space relay station hears a voice that should not exist.'),
('00000000-0000-0000-0000-000000000004','fr','L''Orbite du silence','Aucun signal. Aucun retour.','Le dernier équipage d''une station relais entend une voix qui ne devrait pas exister.'),
('00000000-0000-0000-0000-000000000004','ar','مدار الصمت','لا إشارة. لا عودة.','طاقم محطة فضائية بعيدة يسمع صوتاً لا ينبغي أن يوجد.'),
('00000000-0000-0000-0000-000000000005','en','The Glass Harbor',null,'In a Breton port town, a fisherman''s death reopens a twenty-year-old case.'),
('00000000-0000-0000-0000-000000000005','fr','Le Port de Verre',null,'Dans un port breton, la mort d''un pêcheur rouvre une affaire vieille de vingt ans.'),
('00000000-0000-0000-0000-000000000005','ar','ميناء الزجاج',null,'في ميناء بريتاني، تعيد وفاة صياد فتح قضية عمرها عشرون عاماً.'),
('00000000-0000-0000-0000-000000000006','en','Dar El Bacha','One riad. Three families. Thirty nights.','A Ramadan comedy about three families forced to share a crumbling Fez riad.'),
('00000000-0000-0000-0000-000000000006','fr','Dar El Bacha','Un riad. Trois familles. Trente nuits.','Une comédie du Ramadan sur trois familles contraintes de partager un vieux riad à Fès.'),
('00000000-0000-0000-0000-000000000006','ar','دار الباشا','رياض واحد. ثلاث عائلات. ثلاثون ليلة.','كوميديا رمضانية عن ثلاث عائلات تتقاسم رياضاً قديماً في فاس.'),
('00000000-0000-0000-0000-000000000007','en','The Old Quarter',null,'A Damascus neighborhood saga across one turbulent decade.'),
('00000000-0000-0000-0000-000000000007','fr','Le Vieux Quartier',null,'La saga d''un quartier de Damas au fil d''une décennie mouvementée.'),
('00000000-0000-0000-0000-000000000007','ar','الحارة القديمة',null,'ملحمة حارة دمشقية عبر عقد مضطرب.'),
('00000000-0000-0000-0000-000000000008','en','Cairo Midnight',null,'A night-shift taxi driver becomes the only witness to a crime that shakes Cairo.'),
('00000000-0000-0000-0000-000000000008','fr','Minuit au Caire',null,'Un chauffeur de taxi de nuit devient l''unique témoin d''un crime.'),
('00000000-0000-0000-0000-000000000008','ar','منتصف ليل القاهرة',null,'سائق تاكسي ليلي يصبح الشاهد الوحيد على جريمة تهز القاهرة.'),
('00000000-0000-0000-0000-000000000009','en','Dunes of Oran',null,'Two brothers return to Oran to save their father''s failing music hall.'),
('00000000-0000-0000-0000-000000000009','fr','Les Dunes d''Oran',null,'Deux frères reviennent à Oran pour sauver le cabaret de leur père.'),
('00000000-0000-0000-0000-000000000009','ar','كثبان وهران',null,'شقيقان يعودان إلى وهران لإنقاذ قاعة والدهما الموسيقية.'),
('00000000-0000-0000-0000-000000000010','en','Tunis Blue',null,'A young architect fights to protect the medina of Tunis from developers.'),
('00000000-0000-0000-0000-000000000010','fr','Tunis Bleu',null,'Une jeune architecte se bat pour protéger la médina de Tunis.'),
('00000000-0000-0000-0000-000000000010','ar','تونس الزرقاء',null,'مهندسة شابة تكافح لحماية مدينة تونس العتيقة.'),
('00000000-0000-0000-0000-000000000011','en','Gulf Tides',null,'A pearl-diving family''s legacy collides with a modern shipping empire.'),
('00000000-0000-0000-0000-000000000011','fr','Marées du Golfe',null,'L''héritage d''une famille de pêcheurs de perles face à un empire maritime.'),
('00000000-0000-0000-0000-000000000011','ar','مد الخليج',null,'إرث عائلة غواصي لؤلؤ يصطدم بإمبراطورية شحن حديثة.'),
('00000000-0000-0000-0000-000000000012','en','Ronin of the Moon',null,'A masterless swordsman hunts the spirit that stole his shadow.'),
('00000000-0000-0000-0000-000000000012','fr','Le Rōnin de la Lune',null,'Un sabreur sans maître traque l''esprit qui a volé son ombre.'),
('00000000-0000-0000-0000-000000000012','ar','رونين القمر',null,'مبارز بلا سيد يطارد الروح التي سرقت ظله.'),
('00000000-0000-0000-0000-000000000013','en','Starfall Academy',null,'Students who fell from the stars learn to live as humans.'),
('00000000-0000-0000-0000-000000000013','fr','Académie Starfall',null,'Des élèves tombés des étoiles apprennent à vivre comme des humains.'),
('00000000-0000-0000-0000-000000000013','ar','أكاديمية النجوم الساقطة',null,'طلاب سقطوا من النجوم يتعلمون العيش كبشر.'),
('00000000-0000-0000-0000-000000000014','en','Ronin of the Moon: Crimson Tide',null,'The feature film set between seasons one and two.'),
('00000000-0000-0000-0000-000000000014','fr','Le Rōnin de la Lune : Marée pourpre',null,'Le film situé entre les saisons un et deux.'),
('00000000-0000-0000-0000-000000000014','ar','رونين القمر: المد القرمزي',null,'الفيلم الذي تدور أحداثه بين الموسمين الأول والثاني.'),
('00000000-0000-0000-0000-000000000015','en','Ink Dragon',null,'A calligrapher''s brush awakens a dragon sealed in ink.'),
('00000000-0000-0000-0000-000000000015','fr','Le Dragon d''encre',null,'Le pinceau d''un calligraphe réveille un dragon scellé dans l''encre.'),
('00000000-0000-0000-0000-000000000015','ar','تنين الحبر',null,'فرشاة خطاط توقظ تنيناً مختوماً في الحبر.'),
('00000000-0000-0000-0000-000000000016','en','Seoul Cipher',null,'A hacker deciphers messages hidden in a dead poet''s verses.'),
('00000000-0000-0000-0000-000000000016','fr','Le Chiffre de Séoul',null,'Une hackeuse déchiffre des messages cachés dans les vers d''un poète.'),
('00000000-0000-0000-0000-000000000016','ar','شيفرة سيول',null,'قرصانة تفك رسائل مخبأة في قصائد شاعر راحل.'),
('00000000-0000-0000-0000-000000000017','en','Little Lantern',null,'A tiny lantern sets out to bring light back to the old medina.'),
('00000000-0000-0000-0000-000000000017','fr','Petite Lanterne',null,'Une petite lanterne part ramener la lumière dans la vieille médina.'),
('00000000-0000-0000-0000-000000000017','ar','الفانوس الصغير',null,'فانوس صغير ينطلق ليعيد النور إلى المدينة القديمة.'),
('00000000-0000-0000-0000-000000000018','en','Zellij Explorers',null,'Three friends solve puzzles hidden in colorful tiles.'),
('00000000-0000-0000-0000-000000000018','fr','Les Explorateurs du Zellige',null,'Trois amis résolvent des énigmes cachées dans des carreaux colorés.'),
('00000000-0000-0000-0000-000000000018','ar','مستكشفو الزليج',null,'ثلاثة أصدقاء يحلون ألغازاً مخبأة في البلاط الملون.'),
('00000000-0000-0000-0000-000000000019','en','Casablanca 1958',null,'A restored black-and-white classic of love and exile in the port city.'),
('00000000-0000-0000-0000-000000000019','fr','Casablanca 1958',null,'Un classique restauré d''amour et d''exil dans la ville portuaire.'),
('00000000-0000-0000-0000-000000000019','ar','الدار البيضاء 1958',null,'كلاسيكية مرممة عن الحب والمنفى في المدينة الساحلية.'),
('00000000-0000-0000-0000-000000000020','en','The Andalusian Letters',null,'Letters between Granada and Tetouan reveal a forgotten family.'),
('00000000-0000-0000-0000-000000000020','fr','Les Lettres andalouses',null,'Des lettres entre Grenade et Tétouan révèlent une famille oubliée.'),
('00000000-0000-0000-0000-000000000020','ar','الرسائل الأندلسية',null,'رسائل بين غرناطة وتطوان تكشف عائلة منسية.'),
('00000000-0000-0000-0000-000000000021','en','Desert Falcon',null,'An ex-pilot races across the desert to stop a stolen drone.'),
('00000000-0000-0000-0000-000000000021','fr','Faucon du désert',null,'Un ancien pilote traverse le désert pour arrêter un drone volé.'),
('00000000-0000-0000-0000-000000000021','ar','صقر الصحراء',null,'طيار سابق يسابق الزمن عبر الصحراء لإيقاف طائرة مسيرة مسروقة.'),
('00000000-0000-0000-0000-000000000022','en','Midnight in Fez',null,'Two strangers share one night wandering the medina of Fez.'),
('00000000-0000-0000-0000-000000000022','fr','Minuit à Fès',null,'Deux inconnus partagent une nuit dans la médina de Fès.'),
('00000000-0000-0000-0000-000000000022','ar','منتصف الليل في فاس',null,'غريبان يتشاركان ليلة في أزقة فاس العتيقة.'),
('00000000-0000-0000-0000-000000000023','en','Kingdom of Sand',null,'The rise and fall of a medieval Saharan trading dynasty.'),
('00000000-0000-0000-0000-000000000023','fr','Royaume de sable',null,'L''ascension et la chute d''une dynastie marchande saharienne.'),
('00000000-0000-0000-0000-000000000023','ar','مملكة الرمال',null,'صعود وسقوط سلالة تجارية صحراوية في العصور الوسطى.'),
('00000000-0000-0000-0000-000000000024','en','Moon Garden',null,'A girl tends a garden that only blooms under moonlight.'),
('00000000-0000-0000-0000-000000000024','fr','Le Jardin de la Lune',null,'Une fille soigne un jardin qui ne fleurit qu''au clair de lune.'),
('00000000-0000-0000-0000-000000000024','ar','حديقة القمر',null,'فتاة تعتني بحديقة لا تزهر إلا تحت ضوء القمر.');

-- genres
insert into public.title_genres (title_id, genre_id)
select t.id, g.id from (values
 ('the-last-caravan','drama'),('the-last-caravan','adventure'),('atlas-noir','thriller'),('atlas-noir','crime'),
 ('nile-of-ashes','crime'),('nile-of-ashes','drama'),('orbit-of-silence','sci-fi'),('orbit-of-silence','thriller'),
 ('the-glass-harbor','mystery'),('the-glass-harbor','crime'),('dar-el-bacha','comedy'),('dar-el-bacha','family'),
 ('old-quarter','drama'),('old-quarter','history'),('cairo-midnight','crime'),('cairo-midnight','thriller'),
 ('dunes-of-oran','drama'),('dunes-of-oran','comedy'),('tunis-blue','drama'),('gulf-tides','drama'),('gulf-tides','history'),
 ('ronin-of-the-moon','action'),('ronin-of-the-moon','fantasy'),('starfall-academy','fantasy'),('starfall-academy','comedy'),
 ('ronin-of-the-moon-crimson-tide','action'),('ink-dragon','fantasy'),('ink-dragon','adventure'),('seoul-cipher','mystery'),('seoul-cipher','thriller'),
 ('little-lantern','animation'),('little-lantern','family'),('zellij-explorers','animation'),('zellij-explorers','adventure'),
 ('casablanca-1958','romance'),('casablanca-1958','drama'),('the-andalusian-letters','history'),('the-andalusian-letters','romance'),
 ('desert-falcon','action'),('midnight-in-fez','romance'),('kingdom-of-sand','history'),('kingdom-of-sand','drama'),('moon-garden','fantasy'),('moon-garden','family')
) v(s,g) join public.titles t on t.slug=v.s join public.genres g on g.slug=v.g;

insert into public.title_countries (title_id, country_code)
select t.id, v.c from (values
 ('the-last-caravan','MA'),('atlas-noir','MA'),('nile-of-ashes','EG'),('orbit-of-silence','US'),('the-glass-harbor','FR'),
 ('dar-el-bacha','MA'),('old-quarter','SY'),('cairo-midnight','EG'),('dunes-of-oran','DZ'),('tunis-blue','TN'),('gulf-tides','AE'),('gulf-tides','KW'),
 ('ronin-of-the-moon','JP'),('starfall-academy','JP'),('ronin-of-the-moon-crimson-tide','JP'),('ink-dragon','JP'),('seoul-cipher','KR'),
 ('little-lantern','MA'),('zellij-explorers','MA'),('casablanca-1958','MA'),('the-andalusian-letters','ES'),('the-andalusian-letters','MA'),
 ('desert-falcon','US'),('midnight-in-fez','MA'),('midnight-in-fez','FR'),('kingdom-of-sand','GB'),('moon-garden','CN')
) v(s,c) join public.titles t on t.slug=v.s;

insert into public.title_languages (title_id, language_code)
select t.id, v.l from (values
 ('the-last-caravan','ar'),('atlas-noir','ar'),('atlas-noir','fr'),('nile-of-ashes','ar'),('orbit-of-silence','en'),('the-glass-harbor','fr'),
 ('dar-el-bacha','ar'),('old-quarter','ar'),('cairo-midnight','ar'),('dunes-of-oran','ar'),('tunis-blue','ar'),('gulf-tides','ar'),
 ('ronin-of-the-moon','ja'),('starfall-academy','ja'),('ronin-of-the-moon-crimson-tide','ja'),('little-lantern','ar'),('zellij-explorers','ar'),('zellij-explorers','fr'),
 ('casablanca-1958','ar'),('casablanca-1958','fr'),('the-andalusian-letters','es'),('desert-falcon','en'),('midnight-in-fez','fr'),('kingdom-of-sand','en')
) v(s,l) join public.titles t on t.slug=v.s;

insert into public.credits (title_id, person_id, role, character_name, ord)
select t.id, p.id, v.r, v.ch, v.o from (values
 ('the-last-caravan','karim-bennani','actor','Hassan',1),('the-last-caravan','yasmine-alaoui','actor','Zahra',2),('the-last-caravan','amine-chraibi','director',null,0),
 ('atlas-noir','yasmine-alaoui','actor','Inspector Salma',1),('atlas-noir','omar-said','actor','Rachid',2),('atlas-noir','amine-chraibi','director',null,0),
 ('dar-el-bacha','omar-said','actor','Si Mohamed',1),('dar-el-bacha','sara-mansour','actor','Lalla Touria',2),
 ('cairo-midnight','nadia-farouk','actor','Mona',1),('nile-of-ashes','nadia-farouk','actor','Hoda',1),('old-quarter','leila-haddad','actor','Rana',1),
 ('orbit-of-silence','james-holt','actor','Cmdr. Reyes',1),('the-glass-harbor','claire-moreau','actor','Anne Le Goff',1),
 ('ronin-of-the-moon','hiro-tanaka','creator',null,0),('starfall-academy','hiro-tanaka','creator',null,0),('ink-dragon','hiro-tanaka','author',null,0),
 ('midnight-in-fez','karim-bennani','actor','Youssef',1),('midnight-in-fez','claire-moreau','actor','Camille',2)
) v(s,pp,r,ch,o) join public.titles t on t.slug=v.s join public.people p on p.slug=v.pp;

insert into public.title_relations values
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000014','movie'),
('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000012','parent'),
('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000012','related');

-- seasons & episodes
insert into public.seasons (title_id, number, name, year)
select t.id, s.n, 'Season ' || s.n, t.year + s.n - 1
from public.titles t
cross join lateral generate_series(1, case when t.slug in ('ronin-of-the-moon','the-glass-harbor','kingdom-of-sand') then 2 else 1 end) s(n)
where t.kind in ('series','anime') and t.format is distinct from 'movie';

insert into public.episodes (season_id, number, title, synopsis, runtime_min, air_date, thumbnail_url)
select s.id, e.n, 'Episode ' || e.n, 'Chapter ' || e.n || ' of the story.', t.runtime_min,
  coalesce(t.release_date, current_date) + ((s.number - 1) * 365 + e.n - 1),
  t.backdrop_url
from public.seasons s join public.titles t on t.id = s.title_id
cross join lateral generate_series(1, case when t.slug in ('dar-el-bacha','cairo-midnight','dunes-of-oran','gulf-tides','old-quarter') then 15 when t.kind='anime' then 12 else 8 end) e(n);

-- manga
insert into public.manga_volumes (title_id, number, release_date, cover_url)
select t.id, v.n, t.release_date + v.n * 90, t.poster_url from public.titles t cross join generate_series(1,4) v(n) where t.kind='manga';
insert into public.manga_chapters (title_id, volume_id, number, title, release_date)
select mv.title_id, mv.id, (mv.number - 1) * 6 + c.n, 'Chapter ' || ((mv.number - 1) * 6 + c.n), mv.release_date + c.n * 7
from public.manga_volumes mv cross join generate_series(1,6) c(n);

-- ramadan
insert into public.ramadan_seasons (year, starts_on, ends_on, is_current) values (2025,'2025-03-01','2025-03-30',false),(2026,'2026-02-18','2026-03-19',true),(2027,'2027-02-08','2027-03-09',false);
insert into public.ramadan_entries (season_id, title_id, air_time, status)
select rs.id, t.id, v.at, v.st from (values
 (2026,'dar-el-bacha','20:15','completed'),(2026,'cairo-midnight','21:00','completed'),(2026,'dunes-of-oran','20:30','completed'),(2026,'gulf-tides','22:00','completed'),
 (2025,'old-quarter','21:30','completed'),(2027,'tunis-blue','21:00','upcoming')
) v(y,s,at,st) join public.ramadan_seasons rs on rs.year=v.y join public.titles t on t.slug=v.s;

-- collections
insert into public.collections (slug, name_en, name_fr, name_ar, description_en, cover_url, ord) values
('maghreb-nights','Maghreb Nights','Nuits du Maghreb','ليالي المغرب العربي','Stories from Morocco, Algeria and Tunisia after dark.','/images/backdrops/b1.jpg',1),
('desert-epics','Desert Epics','Épopées du désert','ملاحم الصحراء','Sand, sun and destiny.','/images/backdrops/b2.jpg',2),
('restored-classics','Restored Classics','Classiques restaurés','كلاسيكيات مرممة','Heritage cinema, beautifully restored.','/images/backdrops/b3.jpg',3);
insert into public.collection_items (collection_id, title_id, ord)
select c.id, t.id, v.o from (values
 ('maghreb-nights','midnight-in-fez',1),('maghreb-nights','dunes-of-oran',2),('maghreb-nights','tunis-blue',3),('maghreb-nights','atlas-noir',4),
 ('desert-epics','the-last-caravan',1),('desert-epics','kingdom-of-sand',2),('desert-epics','desert-falcon',3),
 ('restored-classics','casablanca-1958',1),('restored-classics','the-andalusian-letters',2)
) v(c,s,o) join public.collections c on c.slug=v.c join public.titles t on t.slug=v.s;

-- authorized demo source (open-licensed test stream)
insert into public.video_sources (title_id, kind, url, provider)
select id, 'hls', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 'demo-open-license' from public.titles where kind <> 'manga';

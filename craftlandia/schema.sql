-- schema.sql – Craftlandia Ügyfélkapu D1 adatbázis séma
-- Futtatás: wrangler d1 execute craftlandia-db --file=schema.sql

-- ─── Felhasználók (Discord OAuth) ──────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id  TEXT    NOT NULL UNIQUE,
  username    TEXT    NOT NULL,
  global_name TEXT,
  avatar      TEXT,
  email       TEXT,
  polgarsag   TEXT    DEFAULT 'aktiv',  -- aktiv | felfuggesztett
  role        TEXT    DEFAULT 'citizen', -- citizen | admin | pm
  created_at  TEXT    NOT NULL,
  last_login  TEXT
);

-- ─── Vállalkozások ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cegek (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ugy_szam         TEXT    NOT NULL UNIQUE,
  discord_id       TEXT    NOT NULL,
  ceg_nev          TEXT    NOT NULL,
  tarsasagi_forma  TEXT    NOT NULL,  -- bt | kft | rt | ev
  alaptoke         REAL    NOT NULL DEFAULT 0,
  tearor           TEXT,
  telepules        TEXT    NOT NULL,
  utca             TEXT,
  irsz             TEXT,
  adoszam          TEXT,              -- generált: KF-YYYY-NNNNN
  status           TEXT    NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  megjegyzes       TEXT,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_cegek_discord ON cegek(discord_id);
CREATE INDEX IF NOT EXISTS idx_cegek_status  ON cegek(status);

-- ─── Adóbevallások ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adobevallasok (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  hivatkozas  TEXT    NOT NULL UNIQUE,
  discord_id  TEXT    NOT NULL,
  tipus       TEXT    NOT NULL,   -- eves | negyed | ho
  adoev       INTEGER NOT NULL,
  negyed      INTEGER,
  honap       INTEGER,
  adoszam     TEXT,
  adozo_nev   TEXT,
  telepules   TEXT,
  bevetel     REAL    NOT NULL DEFAULT 0,
  koltseg     REAL    NOT NULL DEFAULT 0,
  levon       REAL    NOT NULL DEFAULT 0,
  kedv        REAL    NOT NULL DEFAULT 0,
  adoalap     REAL    GENERATED ALWAYS AS (MAX(0, bevetel - koltseg - levon)) STORED,
  fizetendo   REAL,
  status      TEXT    NOT NULL DEFAULT 'submitted',  -- submitted | processing | accepted | rejected
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ado_discord ON adobevallasok(discord_id);

-- ─── Okmányigénylések ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS okmany_igenylasek (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ugy_szam   TEXT    NOT NULL UNIQUE,
  discord_id TEXT    NOT NULL,
  tipus      TEXT    NOT NULL,   -- szemelyi | lakcim | utlevel | adoig | anyakönyv | erkölcsi
  nev        TEXT    NOT NULL,
  szuldat    TEXT,
  anyja_neve TEXT,
  szulhely   TEXT,
  kezbesites TEXT    DEFAULT 'szemelyes',  -- posta | szemelyes
  postacim   TEXT,
  dij        REAL,
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | processing | ready | delivered
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_okmany_discord ON okmany_igenylasek(discord_id);

-- ─── Üzenetek ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uzenetek (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT    NOT NULL,
  from_name  TEXT    NOT NULL,
  subject    TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  category   TEXT    NOT NULL DEFAULT 'ertesites',  -- ado | hatarozat | ertesites | ceg
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uzenetek_discord ON uzenetek(discord_id);
CREATE INDEX IF NOT EXISTS idx_uzenetek_read    ON uzenetek(discord_id, read);

-- ─── EU Projektek (admin által kezelt) ─────────────────────
CREATE TABLE IF NOT EXISTS eu_projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   TEXT    NOT NULL UNIQUE,  -- pl. EU-2025-001
  name         TEXT    NOT NULL,
  municipality TEXT    NOT NULL,
  category     TEXT    NOT NULL,   -- infrastructure | education | environment | economy | health
  amount       REAL    NOT NULL,
  paid         REAL    NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'approved',  -- approved | processing | paid | rejected
  description  TEXT,
  progress     INTEGER NOT NULL DEFAULT 0,  -- 0-100
  date         TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eu_status   ON eu_projects(status);
CREATE INDEX IF NOT EXISTS idx_eu_category ON eu_projects(category);

-- ─── Választási Jelöltek ───────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id  TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  party       TEXT,
  slogan      TEXT,
  statement   TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidates_discord ON candidates(discord_id);

-- ─── Kincstár (EU Források feltöltése) ─────────────────────
CREATE TABLE IF NOT EXISTS treasury_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id  TEXT    NOT NULL, -- ki töltötte fel
  amount      REAL    NOT NULL,
  source      TEXT    NOT NULL, -- pl. "Központi Költségvetés"
  reason      TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Ügyiratok (általános napló) ───────────────────────────
CREATE TABLE IF NOT EXISTS ugyiratok (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  tipus      TEXT NOT NULL,   -- ceg | adobevallas | okmany | epitesi | tamogatas | panasz | lakcim
  hivatkozas TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ugyiratok_discord ON ugyiratok(discord_id);

-- ─── Lakcímbejelentések ────────────────────────────────────
CREATE TABLE IF NOT EXISTS lakcim_bejelentesek (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ugy_szam   TEXT NOT NULL UNIQUE,
  discord_id TEXT NOT NULL,
  nev        TEXT NOT NULL,
  telepules  TEXT NOT NULL,
  utca       TEXT NOT NULL,
  irsz       TEXT NOT NULL,
  tipus      TEXT NOT NULL DEFAULT 'allando',  -- allando | ideiglenes
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

-- ─── Panaszok / Jogorvoslatok ──────────────────────────────
CREATE TABLE IF NOT EXISTS panaszok (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ugy_szam      TEXT NOT NULL UNIQUE,
  discord_id    TEXT NOT NULL,
  panasz_tipus  TEXT NOT NULL,  -- hatarozat | hataskortules | jogserelem
  szerv_neve    TEXT NOT NULL,
  leiras        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL
);

-- ─── EU Pályázatok (Támogatások) ───────────────────────────
CREATE TABLE IF NOT EXISTS eu_applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ugy_szam     TEXT    NOT NULL UNIQUE,  -- pl. TAM-2025-XXXX
  discord_id   TEXT    NOT NULL,
  ceg_id       INTEGER NOT NULL,
  project_name TEXT    NOT NULL,
  amount       REAL    NOT NULL,
  description  TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
  progress     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  FOREIGN KEY(ceg_id) REFERENCES cegek(id)
);

CREATE INDEX IF NOT EXISTS idx_eu_app_discord ON eu_applications(discord_id);
CREATE INDEX IF NOT EXISTS idx_eu_app_status  ON eu_applications(status);

-- ─── Seed: EU projektek ────────────────────────────────────
INSERT OR IGNORE INTO eu_projects (project_id, name, municipality, category, amount, paid, status, progress, description, date) VALUES
('EU-2025-001','Bazsi City Főtér Felújítás','Bazsi City','infrastructure',450000,450000,'paid',100,'A főtér teljes infrastrukturális megújítása.','2025-03-15'),
('EU-2025-002','Vasfalu Általános Iskola Bővítés','Vasfalu','education',320000,320000,'paid',100,'8 új tanterem és sportcsarnok.','2025-04-01'),
('EU-2025-003','Zöld Energia Program – Napelemes Park','Bazsi City','environment',780000,507000,'processing',65,'500 kW napelemes erőmű.','2025-06-20'),
('EU-2025-004','Helyi Piac Fejlesztés','Palotás','economy',195000,39000,'approved',20,'A heti piac fejlesztése.','2025-07-10'),
('EU-2025-005','Egészségügyi Centrum','Rózsaváros','health',560000,268800,'processing',48,'Modern alapellátási centrum.','2025-05-05'),
('EU-2025-006','Kerékpárút Hálózat','Vasfalu','infrastructure',230000,230000,'paid',100,'12 km kerékpárút.','2025-02-28'),
('EU-2025-007','Digitális Oktatási Platform','Bazsi City','education',145000,14500,'approved',10,'Online tanulási platform.','2025-08-01'),
('EU-2025-008','Vízgazdálkodási Projekt','Palotás','environment',420000,147000,'processing',35,'Esővíz-gyűjtő rendszer.','2025-06-01'),
('EU-2025-009','Startup Inkubátor Ház','Bazsi City','economy',310000,15500,'approved',5,'Coworking és inkubátor.','2025-09-15'),
('EU-2025-010','Falusi Rendelő Felújítás','Rózsaváros','health',87000,87000,'paid',100,'Rendelő teljes felújítása.','2025-01-20'),
('EU-2025-011','Ipari Park Infrastruktúra','Palotás','economy',670000,0,'rejected',0,'Elutasítva: hatástanulmány hiánya.','2025-04-30'),
('EU-2025-012','Hulladékgazdálkodási Fejlesztés','Vasfalu','environment',255000,140250,'processing',55,'Szelektív hulladékgyűjtés.','2025-07-25');
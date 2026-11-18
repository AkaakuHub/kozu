CREATE TABLE score_commits (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  parent TEXT REFERENCES score_commits(id),
  merge_parent TEXT REFERENCES score_commits(id),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX score_commits_owner ON score_commits(owner, id);

CREATE TABLE score_branches (
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  head TEXT REFERENCES score_commits(id),
  PRIMARY KEY (owner, name)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_pulls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  merged TEXT REFERENCES score_commits(id),
  FOREIGN KEY (owner, source) REFERENCES score_branches(owner, name),
  FOREIGN KEY (owner, target) REFERENCES score_branches(owner, name),
  CHECK (source <> target)
) STRICT;
CREATE INDEX score_pulls_owner ON score_pulls(owner, id);
CREATE UNIQUE INDEX score_pulls_open ON score_pulls(owner, source, target) WHERE merged IS NULL;

CREATE TABLE score_header (
  revision TEXT PRIMARY KEY REFERENCES score_commits(id),
  title TEXT NOT NULL, seed INTEGER NOT NULL, tempo REAL NOT NULL,
  tonic INTEGER NOT NULL, mode TEXT NOT NULL, flats INTEGER NOT NULL CHECK (flats IN (0, 1)),
  numerator INTEGER NOT NULL, denominator INTEGER NOT NULL
) STRICT;

CREATE TABLE score_tracks (
  revision TEXT NOT NULL REFERENCES score_commits(id), id TEXT NOT NULL, removed INTEGER NOT NULL CHECK (removed IN (0, 1)),
  pos INTEGER, name TEXT, kind TEXT, program INTEGER, pattern TEXT, gain REAL, mute INTEGER, solo INTEGER, octave INTEGER,
  guitar_output TEXT, string_1 INTEGER, string_2 INTEGER, string_3 INTEGER, string_4 INTEGER, string_5 INTEGER, string_6 INTEGER, max_fret INTEGER, max_span INTEGER, strum_ms REAL, transpose INTEGER, patch_name TEXT,
  PRIMARY KEY (revision, id)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_sections (
  revision TEXT NOT NULL REFERENCES score_commits(id), id TEXT NOT NULL, removed INTEGER NOT NULL CHECK (removed IN (0, 1)),
  pos INTEGER, name TEXT, role TEXT, variant TEXT, length INTEGER, source TEXT,
  PRIMARY KEY (revision, id)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_clips (
  revision TEXT NOT NULL REFERENCES score_commits(id), section_id TEXT NOT NULL, track_id TEXT NOT NULL,
  removed INTEGER NOT NULL CHECK (removed IN (0, 1)),
  PRIMARY KEY (revision, section_id, track_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_notes (
  revision TEXT NOT NULL REFERENCES score_commits(id), section_id TEXT NOT NULL, track_id TEXT NOT NULL, id TEXT NOT NULL,
  removed INTEGER NOT NULL CHECK (removed IN (0, 1)),
  tick INTEGER, duration INTEGER, midi INTEGER, degree INTEGER, accidental INTEGER, octave INTEGER,
  velocity INTEGER CHECK (velocity BETWEEN 1 AND 127), origin TEXT, locked INTEGER,
  CHECK (removed = 1 OR (tick >= 0 AND duration > 0 AND ((midi BETWEEN 0 AND 127 AND degree IS NULL)
      OR (midi IS NULL AND degree BETWEEN 1 AND 7 AND accidental IS NOT NULL AND octave IS NOT NULL)))),
  PRIMARY KEY (revision, section_id, track_id, id)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_chords (
  revision TEXT NOT NULL REFERENCES score_commits(id), section_id TEXT NOT NULL, id TEXT NOT NULL,
  removed INTEGER NOT NULL CHECK (removed IN (0, 1)),
  tick INTEGER, duration INTEGER, quality TEXT, inversion INTEGER,
  midi INTEGER, degree INTEGER, accidental INTEGER, octave INTEGER,
  bass_midi INTEGER, bass_degree INTEGER, bass_accidental INTEGER, bass_octave INTEGER,
  PRIMARY KEY (revision, section_id, id)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_events (
  revision TEXT NOT NULL REFERENCES score_commits(id), id TEXT NOT NULL, removed INTEGER NOT NULL CHECK (removed IN (0, 1)),
  pos INTEGER, kind TEXT, section_id TEXT, tick INTEGER, duration INTEGER, tempo REAL, end_tempo REAL,
  tonic INTEGER, mode TEXT, flats INTEGER, numerator INTEGER, denominator INTEGER,
  velocity INTEGER, crash INTEGER, gain REAL, pattern TEXT, subdivision INTEGER, track_id TEXT, semitones INTEGER,
  PRIMARY KEY (revision, id)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_effect_tracks (
  revision TEXT NOT NULL REFERENCES score_commits(id), effect_id TEXT NOT NULL, pos INTEGER NOT NULL,
  removed INTEGER NOT NULL CHECK (removed IN (0, 1)), track_id TEXT,
  PRIMARY KEY (revision, effect_id, pos)
) STRICT, WITHOUT ROWID;

CREATE TABLE score_chord_intervals (
  revision TEXT NOT NULL REFERENCES score_commits(id), section_id TEXT NOT NULL, chord_id TEXT NOT NULL,
  pos INTEGER NOT NULL, removed INTEGER NOT NULL CHECK (removed IN (0, 1)), interval INTEGER,
  PRIMARY KEY (revision, section_id, chord_id, pos)
) STRICT, WITHOUT ROWID;

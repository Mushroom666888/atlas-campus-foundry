CREATE TABLE campus_universities (
  id text PRIMARY KEY, owner_id text NOT NULL REFERENCES accounts(id), name text NOT NULL,
  allow_affiliations boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE campus_campuses (
  id text PRIMARY KEY, university_id text NOT NULL REFERENCES campus_universities(id),
  name text NOT NULL, timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, university_id)
);
CREATE TABLE campus_buildings (
  id text PRIMARY KEY, university_id text NOT NULL REFERENCES campus_universities(id),
  campus_id text NOT NULL, name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, campus_id),
  FOREIGN KEY(campus_id, university_id) REFERENCES campus_campuses(id, university_id)
);
CREATE TABLE campus_venues (
  id text PRIMARY KEY, university_id text NOT NULL REFERENCES campus_universities(id),
  campus_id text NOT NULL, building_id text, name text NOT NULL,
  capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 100000),
  latitude double precision, longitude double precision,
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, university_id),
  FOREIGN KEY(campus_id, university_id) REFERENCES campus_campuses(id, university_id),
  FOREIGN KEY(building_id, campus_id) REFERENCES campus_buildings(id, campus_id)
);
CREATE TABLE campus_courses (
  id text PRIMARY KEY, university_id text NOT NULL REFERENCES campus_universities(id),
  campus_id text, name text NOT NULL, code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(university_id, code),
  FOREIGN KEY(campus_id, university_id) REFERENCES campus_campuses(id, university_id)
);
CREATE TABLE campus_clubs (
  id text PRIMARY KEY, university_id text NOT NULL REFERENCES campus_universities(id),
  campus_id text, name text NOT NULL, description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, university_id),
  FOREIGN KEY(campus_id, university_id) REFERENCES campus_campuses(id, university_id)
);
CREATE TABLE campus_affiliations (
  user_id text NOT NULL REFERENCES accounts(id), university_id text NOT NULL REFERENCES campus_universities(id),
  campus_id text, program text NOT NULL DEFAULT '',
  verification text NOT NULL DEFAULT 'self-declared' CHECK(verification='self-declared'),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, university_id),
  FOREIGN KEY(campus_id, university_id) REFERENCES campus_campuses(id, university_id)
);
CREATE TABLE campus_event_links (
  event_id text PRIMARY KEY REFERENCES entities(id),
  university_id text NOT NULL REFERENCES campus_universities(id), venue_id text, club_id text,
  FOREIGN KEY(venue_id, university_id) REFERENCES campus_venues(id, university_id),
  FOREIGN KEY(club_id, university_id) REFERENCES campus_clubs(id, university_id)
);
CREATE INDEX campus_campuses_school ON campus_campuses(university_id);
CREATE INDEX campus_buildings_school ON campus_buildings(university_id,campus_id);
CREATE INDEX campus_venues_school ON campus_venues(university_id,campus_id);
CREATE INDEX campus_courses_school ON campus_courses(university_id,campus_id);
CREATE INDEX campus_clubs_school ON campus_clubs(university_id,campus_id);

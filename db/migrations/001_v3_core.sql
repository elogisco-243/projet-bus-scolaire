-- Bus scolaire V3: projet de migration PostgreSQL 14+.
-- A EXECUTER UNIQUEMENT sur une base de TEST/SANDBOX apres revue.
-- Ce schema n'est PAS applique automatiquement sur Render.
BEGIN;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('school','operator')),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  timezone text NOT NULL DEFAULT 'Africa/Lubumbashi',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identifiant du fournisseur d'identite externe. Jamais un mot de passe.
  identity_subject text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('school_admin','operator_admin','dispatcher','driver','parent')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id,role)
);
CREATE INDEX memberships_user_idx ON organization_memberships(user_id) WHERE active;

CREATE TABLE school_operator_agreements (
  school_id uuid NOT NULL REFERENCES organizations(id),
  operator_id uuid NOT NULL REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id,operator_id),
  CHECK (school_id <> operator_id)
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES organizations(id),
  -- Identifiant opaque; aucune information nominative sur un enfant n'est requise ici.
  school_student_ref text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id,school_student_ref)
);
CREATE INDEX students_school_idx ON students(school_id);

CREATE TABLE verified_parent_student_links (
  parent_user_id uuid NOT NULL REFERENCES users(id),
  student_id uuid NOT NULL REFERENCES students(id),
  verified_at timestamptz NOT NULL,
  revoked_at timestamptz,
  verified_by_user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (parent_user_id, student_id),
  CHECK (revoked_at IS NULL OR revoked_at >= verified_at)
);
CREATE INDEX active_parent_links_idx ON verified_parent_student_links(student_id)
  WHERE revoked_at IS NULL;

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES organizations(id),
  fleet_code text NOT NULL CHECK (length(fleet_code) BETWEEN 1 AND 32),
  seat_capacity integer NOT NULL CHECK (seat_capacity BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (operator_id,fleet_code)
);

CREATE TABLE routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  route_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  FOREIGN KEY (school_id,operator_id)
    REFERENCES school_operator_agreements(school_id,operator_id),
  UNIQUE (school_id,route_code)
);

CREATE TABLE route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id),
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  label text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  UNIQUE (route_id,sequence_no)
);

CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  driver_user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','cancelled')),
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scheduled_end_at IS NULL OR scheduled_end_at > scheduled_start_at)
);
CREATE INDEX trips_route_time_idx ON trips(route_id,scheduled_start_at DESC);
CREATE INDEX trips_active_idx ON trips(driver_user_id,status)
  WHERE status IN ('planned','in_progress');

CREATE TABLE trip_students (
  trip_id uuid NOT NULL REFERENCES trips(id),
  student_id uuid NOT NULL REFERENCES students(id),
  PRIMARY KEY (trip_id,student_id)
);
CREATE INDEX trip_students_student_idx ON trip_students(student_id);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  action_code text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_time_idx ON audit_events(organization_id,happened_at DESC);

-- Reste a implementer AVANT production: contraintes transactionnelles inter-organisations,
-- verification des liens parents-eleves, RLS / isolation base de donnees,
-- conservation/purge, gestion de consentement et droits d'acces audites.
COMMIT;

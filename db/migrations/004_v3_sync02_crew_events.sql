-- A2S Scola SYNC-02 / PostgreSQL 16 / DRAFT FOR ISOLATED STAGING ONLY.
-- Requires 001 -> 002 -> 003. Not deployed; do not run on any live database.
-- This migration does NOT enable an API, writer SQL role or mobile synchronization.
BEGIN;

-- Migration 002 maps memberships to school/operator using generated organization_kind.
-- Explicit replacement is necessary when introducing attendant as an OPERATOR role.
ALTER TABLE public.organization_memberships
  DROP CONSTRAINT memberships_organization_kind_fk;
ALTER TABLE public.organization_memberships
  DROP COLUMN organization_kind;
ALTER TABLE public.organization_memberships
  DROP CONSTRAINT organization_memberships_role_check;
ALTER TABLE public.organization_memberships
  ADD CONSTRAINT organization_memberships_role_check
  CHECK (role IN ('school_admin','operator_admin','dispatcher','driver','attendant','parent'));
ALTER TABLE public.organization_memberships
  ADD COLUMN organization_kind text GENERATED ALWAYS AS
    (CASE WHEN role IN ('school_admin','parent') THEN 'school' ELSE 'operator' END) STORED;
ALTER TABLE public.organization_memberships
  ADD CONSTRAINT memberships_organization_kind_fk
  FOREIGN KEY (organization_id, organization_kind)
  REFERENCES public.organizations(id,kind);

CREATE TABLE public.trip_attendants (
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  attendant_user_id uuid NOT NULL REFERENCES public.users(id),
  assigned_by_user_id uuid NOT NULL REFERENCES public.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (trip_id, attendant_user_id),
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);
CREATE INDEX trip_attendants_active_idx ON public.trip_attendants(trip_id)
  WHERE revoked_at IS NULL;

-- A driver may pointage exceptionally only after the operator formally authorizes
-- a driver-alone trip, and only while there is NO assigned active attendant.
CREATE TABLE public.trip_solo_authorizations (
  trip_id uuid PRIMARY KEY REFERENCES public.trips(id),
  driver_user_id uuid NOT NULL REFERENCES public.users(id),
  authorized_by_user_id uuid NOT NULL REFERENCES public.users(id),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= authorized_at)
);

-- An append-only event ledger. event_id is supplied by the offline queue and
-- UNIQUE, preventing duplicate records on retry. Actor ID comes from server.
CREATE TABLE public.trip_student_events (
  event_id uuid PRIMARY KEY,
  trip_id uuid NOT NULL,
  student_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(id),
  stop_id uuid NOT NULL REFERENCES public.route_stops(id),
  action text NOT NULL CHECK (action IN ('board','alight')),
  occurred_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  parked_attested boolean NOT NULL CHECK (parked_attested = true),
  sequence_no bigint NOT NULL DEFAULT 0 CHECK (sequence_no > 0),
  UNIQUE (trip_id,student_id,sequence_no),
  FOREIGN KEY (trip_id,student_id) REFERENCES public.trip_students(trip_id,student_id)
);
CREATE INDEX trip_student_events_order_idx
  ON public.trip_student_events(trip_id,student_id,sequence_no DESC);
CREATE INDEX trip_student_events_trip_time_idx
  ON public.trip_student_events(trip_id,accepted_at DESC);

CREATE FUNCTION public.v3_check_attendant_assignment() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE op_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND
    (OLD.trip_id <> NEW.trip_id OR OLD.attendant_user_id <> NEW.attendant_user_id OR
     OLD.assigned_by_user_id <> NEW.assigned_by_user_id OR OLD.assigned_at <> NEW.assigned_at)
  THEN RAISE EXCEPTION 'SYNC02: immutable assignment' USING ERRCODE='23514'; END IF;
  -- Lock the trip on assignment/revocation to serialize with solo approval.
  PERFORM 1 FROM public.trips WHERE id=NEW.trip_id FOR UPDATE;
  IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT operator_id INTO op_id FROM public.trips WHERE id=NEW.trip_id;
  IF op_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m JOIN public.users u ON u.id=m.user_id
    WHERE m.user_id=NEW.attendant_user_id AND m.organization_id=op_id
      AND m.role='attendant' AND m.active AND u.active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m JOIN public.users u ON u.id=m.user_id
    WHERE m.user_id=NEW.assigned_by_user_id AND m.organization_id=op_id
      AND m.role IN ('operator_admin','dispatcher') AND m.active AND u.active
  ) THEN RAISE EXCEPTION 'SYNC02: attendant assignment denied' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip_solo_authorizations a
    WHERE a.trip_id=NEW.trip_id AND a.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'SYNC02: revoke solo authorization before assigning attendant' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER sync02_attendant_assignment
BEFORE INSERT OR UPDATE ON public.trip_attendants
FOR EACH ROW EXECUTE FUNCTION public.v3_check_attendant_assignment();

CREATE FUNCTION public.v3_check_solo_authorization() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE tr public.trips%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND
    (OLD.trip_id <> NEW.trip_id OR OLD.driver_user_id <> NEW.driver_user_id OR
     OLD.authorized_by_user_id <> NEW.authorized_by_user_id OR OLD.authorized_at <> NEW.authorized_at)
  THEN RAISE EXCEPTION 'SYNC02: immutable solo approval' USING ERRCODE='23514'; END IF;
  -- Serialize granting/revoking solo rights with attendant assignment.
  SELECT * INTO tr FROM public.trips WHERE id=NEW.trip_id FOR UPDATE;
  IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT FOUND OR tr.driver_user_id<>NEW.driver_user_id OR NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m JOIN public.users u ON u.id=m.user_id
    WHERE m.organization_id=tr.operator_id AND m.user_id=NEW.authorized_by_user_id
      AND m.role IN ('operator_admin','dispatcher') AND m.active AND u.active
  ) THEN RAISE EXCEPTION 'SYNC02: solo approval denied' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip_attendants a
    WHERE a.trip_id=NEW.trip_id AND a.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'SYNC02: attendant already assigned' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER sync02_solo_authorization
BEFORE INSERT OR UPDATE ON public.trip_solo_authorizations
FOR EACH ROW EXECUTE FUNCTION public.v3_check_solo_authorization();

CREATE FUNCTION public.v3_check_student_pointage() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE tr public.trips%ROWTYPE;
DECLARE previous_action text;
DECLARE previous_sequence bigint;
DECLARE current_route uuid;
BEGIN
  -- Serialise all pointage changes for one child on one trip, including retries.
  PERFORM 1 FROM public.trip_students ts
    WHERE ts.trip_id=NEW.trip_id AND ts.student_id=NEW.student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SYNC02: student not assigned' USING ERRCODE='23514'; END IF;
  SELECT * INTO tr FROM public.trips WHERE id=NEW.trip_id FOR SHARE;
  IF NOT FOUND OR tr.status<>'in_progress' THEN
    RAISE EXCEPTION 'SYNC02: trip not active' USING ERRCODE='23514';
  END IF;
  SELECT rs.route_id INTO current_route FROM public.route_stops rs WHERE rs.id=NEW.stop_id;
  IF current_route IS DISTINCT FROM tr.route_id THEN
    RAISE EXCEPTION 'SYNC02: stop not on assigned route' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id=NEW.actor_user_id AND u.active) THEN
    RAISE EXCEPTION 'SYNC02: actor not active' USING ERRCODE='23514';
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM public.trip_attendants a
      JOIN public.organization_memberships m
        ON m.user_id=a.attendant_user_id AND m.organization_id=tr.operator_id
         AND m.role='attendant' AND m.active
      WHERE a.trip_id=tr.id AND a.attendant_user_id=NEW.actor_user_id
        AND a.revoked_at IS NULL)
    OR (NEW.actor_user_id=tr.driver_user_id
      AND EXISTS (SELECT 1 FROM public.organization_memberships m
        WHERE m.user_id=NEW.actor_user_id AND m.organization_id=tr.operator_id
          AND m.role='driver' AND m.active)
      AND EXISTS (SELECT 1 FROM public.trip_solo_authorizations a
        WHERE a.trip_id=tr.id AND a.driver_user_id=NEW.actor_user_id
          AND a.revoked_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM public.trip_attendants a
        WHERE a.trip_id=tr.id AND a.revoked_at IS NULL))
  ) THEN RAISE EXCEPTION 'SYNC02: actor cannot pointage' USING ERRCODE='23514'; END IF;
  -- Do not use client occurred_at to order state transitions; it may arrive late.
  SELECT e.action,e.sequence_no INTO previous_action,previous_sequence
    FROM public.trip_student_events e
    WHERE e.trip_id=NEW.trip_id AND e.student_id=NEW.student_id
    ORDER BY e.sequence_no DESC LIMIT 1;
  IF (NEW.action='board' AND previous_action='board') OR
     (NEW.action='alight' AND previous_action IS DISTINCT FROM 'board') THEN
    RAISE EXCEPTION 'SYNC02: invalid board/alight transition' USING ERRCODE='23514';
  END IF;
  IF NEW.occurred_at>clock_timestamp()+interval '5 minutes' OR
     NEW.occurred_at<clock_timestamp()-interval '72 hours' THEN
    RAISE EXCEPTION 'SYNC02: event timestamp outside accepted window' USING ERRCODE='23514';
  END IF;
  -- Sequence reflects commit/processing order under trip_students FOR UPDATE.
  -- The client cannot assign a sequence or a server acceptance timestamp.
  NEW.sequence_no := COALESCE(previous_sequence,0) + 1;
  NEW.accepted_at := clock_timestamp();
  RETURN NEW;
END; $$;
CREATE TRIGGER sync02_guard_pointage
BEFORE INSERT ON public.trip_student_events
FOR EACH ROW EXECUTE FUNCTION public.v3_check_student_pointage();

-- RLS is deny-by-default. No account receives UPDATE/INSERT/DELETE on these
-- tables in this migration. Future API writer must be an isolated, audited role.
ALTER TABLE public.trip_attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_attendants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trip_solo_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_solo_authorizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trip_student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_student_events FORCE ROW LEVEL SECURITY;
GRANT SELECT ON public.trip_attendants TO bus_v3_reader;
-- Do not expose actor_user_id or parked_attested to parents/crew SQL readers.
GRANT SELECT (event_id,trip_id,student_id,stop_id,action,occurred_at,accepted_at,sequence_no)
  ON public.trip_student_events TO bus_v3_reader;

-- Extend the pre-existing signed identity trip-visibility helper.
CREATE OR REPLACE FUNCTION bus_v3_rls.trip_visible(target_trip uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog,public,bus_v3_rls AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id=target_trip
      AND EXISTS (SELECT 1 FROM public.organizations s WHERE s.id=t.school_id AND s.active)
      AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id=t.operator_id AND o.active)
      AND (
        bus_v3_rls.is_member(t.school_id,ARRAY['school_admin']) OR
        bus_v3_rls.is_member(t.operator_id,ARRAY['operator_admin','dispatcher']) OR
        (t.driver_user_id=bus_v3_rls.actor_id() AND
          bus_v3_rls.is_member(t.operator_id,ARRAY['driver'])) OR
        (bus_v3_rls.is_member(t.operator_id,ARRAY['attendant']) AND EXISTS (
          SELECT 1 FROM public.trip_attendants a WHERE a.trip_id=t.id
            AND a.attendant_user_id=bus_v3_rls.actor_id() AND a.revoked_at IS NULL
        )) OR
        (bus_v3_rls.is_member(t.school_id,ARRAY['parent']) AND EXISTS (
          SELECT 1 FROM public.trip_students ts
          JOIN public.students s ON s.id=ts.student_id AND s.school_id=t.school_id AND s.active
          JOIN public.verified_parent_student_links l ON l.student_id=s.id
            AND l.parent_user_id=bus_v3_rls.actor_id() AND l.revoked_at IS NULL
          WHERE ts.trip_id=t.id
        ))
      )
  );
$$;

CREATE POLICY v3_org_attendant_read ON public.organizations
FOR SELECT TO bus_v3_reader USING (bus_v3_rls.is_member(id,ARRAY['attendant']));
CREATE POLICY v3_memberships_attendant_self ON public.organization_memberships
FOR SELECT TO bus_v3_reader USING (
  user_id=bus_v3_rls.actor_id() AND active AND
  bus_v3_rls.is_member(organization_id,ARRAY['attendant'])
);
CREATE POLICY v3_attendants_read ON public.trip_attendants FOR SELECT TO bus_v3_reader
USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id=trip_id AND
    (bus_v3_rls.is_member(t.operator_id,ARRAY['operator_admin','dispatcher']) OR
     (attendant_user_id=bus_v3_rls.actor_id() AND revoked_at IS NULL AND
      bus_v3_rls.is_member(t.operator_id,ARRAY['attendant'])))));

-- Crew sees only opaque references on its assigned trip. Parents retain the
-- older stricter policy that reveals ONLY the linked child reference.
CREATE POLICY v3_trip_students_crew_read ON public.trip_students
FOR SELECT TO bus_v3_reader USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id=trip_id AND
    ((t.driver_user_id=bus_v3_rls.actor_id() AND
       bus_v3_rls.is_member(t.operator_id,ARRAY['driver'])) OR
     (bus_v3_rls.is_member(t.operator_id,ARRAY['attendant']) AND
       EXISTS(SELECT 1 FROM public.trip_attendants a
       WHERE a.trip_id=t.id AND a.attendant_user_id=bus_v3_rls.actor_id()
         AND a.revoked_at IS NULL))))
);
CREATE POLICY v3_student_events_read ON public.trip_student_events
FOR SELECT TO bus_v3_reader USING (
  (bus_v3_rls.parent_linked(student_id) AND bus_v3_rls.trip_visible(trip_id)) OR
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id=trip_id AND
    (bus_v3_rls.is_member(t.school_id,ARRAY['school_admin']) OR
      (t.driver_user_id=bus_v3_rls.actor_id() AND
        bus_v3_rls.is_member(t.operator_id,ARRAY['driver'])) OR
      (bus_v3_rls.is_member(t.operator_id,ARRAY['attendant']) AND
        EXISTS (SELECT 1 FROM public.trip_attendants a WHERE a.trip_id=t.id
        AND a.attendant_user_id=bus_v3_rls.actor_id() AND a.revoked_at IS NULL))))
);
COMMIT;

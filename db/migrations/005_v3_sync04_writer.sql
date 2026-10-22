-- A2S SCOLA SYNC-04: PROPOSED WRITER, disposable PostgreSQL 16 ONLY.
-- Requires 001..004. DO NOT apply on Render/production.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bus_v3_writer') THEN
    CREATE ROLE bus_v3_writer NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE bus_v3_writer NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA bus_v3_write;
REVOKE ALL ON SCHEMA bus_v3_write FROM PUBLIC;
GRANT USAGE ON SCHEMA bus_v3_write TO bus_v3_writer;

-- Populated only by a separately audited trusted operations service.
-- Mobile and writer SQL role receive ZERO permissions on this table.
CREATE TABLE public.trip_pointage_context (
  trip_id uuid PRIMARY KEY REFERENCES public.trips(id),
  current_stop_id uuid NOT NULL REFERENCES public.route_stops(id),
  parked_confirmed_at timestamptz NOT NULL,
  parked_valid_until timestamptz NOT NULL,
  attested_by_user_id uuid NOT NULL REFERENCES public.users(id),
  CHECK (parked_valid_until > parked_confirmed_at),
  CHECK (parked_valid_until <= parked_confirmed_at + interval '5 minutes')
);
ALTER TABLE public.trip_pointage_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_pointage_context FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_pointage_context FROM PUBLIC;

-- Restricted writer is allowed to EXECUTE a single checked operation.
-- It never obtains direct SELECT/INSERT/UPDATE/DELETE on child data.
CREATE FUNCTION bus_v3_write.record_pointage(
  p_event_id uuid,p_trip_id uuid,p_student_id uuid,p_stop_id uuid,
  p_action text,p_occurred_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,bus_v3_rls,bus_v3_write
AS $$
DECLARE
  v_actor uuid := bus_v3_rls.actor_id();
  v_trip public.trips%ROWTYPE;
  v_context public.trip_pointage_context%ROWTYPE;
  v_existing public.trip_student_events%ROWTYPE;
  v_stop uuid;
  v_sequence bigint;
  v_allowed boolean := false;
BEGIN
  -- HMAC verified in RLS helper, never from client JSON or browser headers.
  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.users WHERE id=v_actor AND active
  ) THEN
    RAISE EXCEPTION 'WRITE_DENIED' USING ERRCODE='42501';
  END IF;
  -- Stable lock order: trip then trip_students, serialize with crew changes.
  SELECT * INTO v_trip FROM public.trips WHERE id=p_trip_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WRITE_DENIED' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.organizations o WHERE o.id=v_trip.school_id AND o.active
  ) OR NOT EXISTS(
    SELECT 1 FROM public.organizations o WHERE o.id=v_trip.operator_id AND o.active
  ) OR NOT EXISTS(
    SELECT 1 FROM public.school_operator_agreements a
    WHERE a.school_id=v_trip.school_id AND a.operator_id=v_trip.operator_id AND a.status='active'
  ) THEN RAISE EXCEPTION 'WRITE_DENIED' USING ERRCODE='42501'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.trip_attendants a
    JOIN public.organization_memberships m
      ON m.organization_id=v_trip.operator_id AND m.user_id=a.attendant_user_id
      AND m.role='attendant' AND m.active
    WHERE a.trip_id=p_trip_id AND a.attendant_user_id=v_actor AND a.revoked_at IS NULL
  ) INTO v_allowed;
  IF NOT v_allowed AND v_actor=v_trip.driver_user_id THEN
    SELECT EXISTS(
      SELECT 1 FROM public.organization_memberships m
      WHERE m.user_id=v_actor AND m.organization_id=v_trip.operator_id
        AND m.role='driver' AND m.active
    ) AND EXISTS(
      SELECT 1 FROM public.trip_solo_authorizations s
      WHERE s.trip_id=p_trip_id AND s.driver_user_id=v_actor AND s.revoked_at IS NULL
    ) AND NOT EXISTS(
      SELECT 1 FROM public.trip_attendants a
      WHERE a.trip_id=p_trip_id AND a.revoked_at IS NULL
    ) INTO v_allowed;
  END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'WRITE_DENIED' USING ERRCODE='42501'; END IF;

  -- The unique event ID is examined AFTER active authorization, so replay is
  -- safe when a previously confirmed stop has already changed.
  SELECT * INTO v_existing FROM public.trip_student_events WHERE event_id=p_event_id;
  IF FOUND THEN
    IF v_existing.actor_user_id=v_actor AND v_existing.trip_id=p_trip_id
      AND v_existing.student_id=p_student_id AND v_existing.action=p_action
      AND v_existing.occurred_at=p_occurred_at
      AND (p_stop_id IS NULL OR p_stop_id=v_existing.stop_id)
    THEN
      RETURN jsonb_build_object('result','already_recorded',
                                'sequenceNo',v_existing.sequence_no);
    END IF;
    RAISE EXCEPTION 'EVENT_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF v_trip.status<>'in_progress' OR p_action NOT IN ('board','alight')
     OR p_action IS NULL THEN
    RAISE EXCEPTION 'EVENT_CONFLICT' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM public.trip_students ts
    JOIN public.students s ON s.id=ts.student_id AND s.school_id=v_trip.school_id
      AND s.active
    WHERE ts.trip_id=p_trip_id AND ts.student_id=p_student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WRITE_DENIED' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_context FROM public.trip_pointage_context c
  WHERE c.trip_id=p_trip_id FOR SHARE;
  IF NOT FOUND OR v_context.parked_confirmed_at > clock_timestamp()
     OR v_context.parked_valid_until < clock_timestamp()
     OR NOT EXISTS(
       SELECT 1 FROM public.organization_memberships m JOIN public.users u
         ON u.id=m.user_id AND u.active
       WHERE m.user_id=v_context.attested_by_user_id
         AND m.organization_id=v_trip.operator_id
         AND m.role IN ('operator_admin','dispatcher') AND m.active
     ) OR NOT EXISTS(
       SELECT 1 FROM public.route_stops s
       WHERE s.id=v_context.current_stop_id AND s.route_id=v_trip.route_id
     ) THEN
    RAISE EXCEPTION 'STOP_NOT_ATTESTED' USING ERRCODE='23514';
  END IF;
  v_stop := v_context.current_stop_id;
  IF p_stop_id IS NOT NULL AND p_stop_id <> v_stop THEN
    RAISE EXCEPTION 'STOP_NOT_ATTESTED' USING ERRCODE='23514';
  END IF;

  -- The existing 004 trigger locks trip_students and allocates sequence_no.
  -- No user can set parked_attested through this function; it is derived from
  -- a trusted, still-valid operations attestation checked above.
  INSERT INTO public.trip_student_events(
    event_id,trip_id,student_id,actor_user_id,stop_id,action,
    occurred_at,parked_attested
  ) VALUES (
    p_event_id,p_trip_id,p_student_id,v_actor,v_stop,p_action,p_occurred_at,true
  ) RETURNING sequence_no INTO v_sequence;
  RETURN jsonb_build_object('result','recorded','sequenceNo',v_sequence);
END;
$$;
REVOKE ALL ON FUNCTION bus_v3_write.record_pointage(uuid,uuid,uuid,uuid,text,timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bus_v3_write.record_pointage(uuid,uuid,uuid,uuid,text,timestamptz)
  TO bus_v3_writer;
COMMIT;

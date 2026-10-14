-- Bus scolaire V3 — migration 003 : RLS par identité attestée.
-- À appliquer UNIQUEMENT dans une base de TEST, après 001 et 002.
-- Requiert une exécution par un administrateur PostgreSQL capable de créer des rôles
-- et l'extension pgcrypto. Ne provisionne aucune clé secrète.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bus_v3_reader') THEN
    CREATE ROLE bus_v3_reader NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE bus_v3_reader NOLOGIN NOINHERIT NOBYPASSRLS;

CREATE SCHEMA bus_v3_rls;
REVOKE ALL ON SCHEMA bus_v3_rls FROM PUBLIC;

-- Provisionnement séparé requis (jamais de clé en dépôt).
-- La clé est partagée uniquement entre l'API de confiance et cette table protégée.
CREATE TABLE bus_v3_rls.signing_keys (
  id smallint PRIMARY KEY CHECK (id = 1),
  secret bytea NOT NULL CHECK (octet_length(secret) >= 32)
);
REVOKE ALL ON bus_v3_rls.signing_keys FROM PUBLIC;

-- Les GUC sont modifiables par une connexion SQL. Leur contenu n'est accepté
-- QUE si la signature HMAC correspond à la clé tenue secrète dans PostgreSQL.
-- Format: HMAC-SHA256-hex de "actor_uuid:unix_expiry"; maximum 120 s à venir.
CREATE FUNCTION bus_v3_rls.actor_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, bus_v3_rls
AS $$
DECLARE
  actor_text text := current_setting('bus_v3.actor_id', true);
  expiry_text text := current_setting('bus_v3.actor_exp', true);
  proof_text text := current_setting('bus_v3.actor_proof', true);
  expected text;
  expiry_seconds bigint;
  now_seconds bigint := floor(extract(epoch FROM statement_timestamp()))::bigint;
BEGIN
  IF actor_text IS NULL OR actor_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR expiry_text IS NULL OR expiry_text !~ '^[0-9]{10,11}$'
     OR proof_text IS NULL OR proof_text !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  expiry_seconds := expiry_text::bigint;
  IF expiry_seconds <= now_seconds OR expiry_seconds > now_seconds + 120 THEN
    RETURN NULL;
  END IF;
  SELECT encode(hmac(convert_to(actor_text || ':' || expiry_text, 'UTF8'), k.secret, 'sha256'), 'hex')
    INTO expected FROM bus_v3_rls.signing_keys AS k WHERE k.id = 1;
  IF expected IS NULL OR expected <> proof_text THEN RETURN NULL; END IF;
  RETURN actor_text::uuid;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN NULL;
END;
$$;

-- Fonctions d'aide SECURITY DEFINER : doivent appartenir à un rôle DB de confiance
-- pouvant lire les tables. Aucun SQL ni identifiant client n'est accepté en argument.
CREATE FUNCTION bus_v3_rls.is_member(target_org uuid, allowed_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, bus_v3_rls
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships AS m
    JOIN public.users AS u ON u.id=m.user_id AND u.active
    JOIN public.organizations AS o ON o.id=m.organization_id AND o.active
    WHERE m.user_id=bus_v3_rls.actor_id() AND m.organization_id=target_org
      AND m.active AND m.role=ANY(allowed_roles)
  );
$$;

CREATE FUNCTION bus_v3_rls.trip_visible(target_trip uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, bus_v3_rls
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips AS t
    WHERE t.id=target_trip
      AND EXISTS (SELECT 1 FROM public.organizations AS s WHERE s.id=t.school_id AND s.active)
      AND EXISTS (SELECT 1 FROM public.organizations AS o WHERE o.id=t.operator_id AND o.active)
      AND (
        bus_v3_rls.is_member(t.school_id,ARRAY['school_admin']) OR
        bus_v3_rls.is_member(t.operator_id,ARRAY['operator_admin','dispatcher']) OR
        (t.driver_user_id=bus_v3_rls.actor_id() AND
         bus_v3_rls.is_member(t.operator_id,ARRAY['driver'])) OR
        (bus_v3_rls.is_member(t.school_id,ARRAY['parent']) AND EXISTS (
           SELECT 1 FROM public.trip_students AS ts
           JOIN public.students AS s ON s.id=ts.student_id AND s.school_id=t.school_id AND s.active
           JOIN public.verified_parent_student_links AS l ON l.student_id=s.id
             AND l.parent_user_id=bus_v3_rls.actor_id() AND l.revoked_at IS NULL
           WHERE ts.trip_id=t.id
        ))
      )
  );
$$;

CREATE FUNCTION bus_v3_rls.route_visible(target_route uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, bus_v3_rls
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.routes AS r
    WHERE r.id=target_route AND (
      bus_v3_rls.is_member(r.school_id,ARRAY['school_admin']) OR
      bus_v3_rls.is_member(r.operator_id,ARRAY['operator_admin','dispatcher']) OR
      EXISTS (SELECT 1 FROM public.trips AS t WHERE t.route_id=r.id
                AND bus_v3_rls.trip_visible(t.id))
    )
  );
$$;

-- Les fonctions du schéma bus_v3_rls n'exposent ni la clé ni les signatures.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bus_v3_rls FROM PUBLIC;
GRANT USAGE ON SCHEMA bus_v3_rls TO bus_v3_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bus_v3_rls TO bus_v3_reader;
GRANT USAGE ON SCHEMA public TO bus_v3_reader;
GRANT SELECT ON public.organizations, public.users, public.organization_memberships,
  public.school_operator_agreements, public.students, public.verified_parent_student_links,
  public.vehicles, public.routes, public.route_stops, public.trips,
  public.trip_students TO bus_v3_reader;
-- Aucun GRANT sur audit_events ni sur les clés, aucune permission d'écriture.

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_org_read ON public.organizations FOR SELECT TO bus_v3_reader USING (
  bus_v3_rls.is_member(id,ARRAY['school_admin','parent','operator_admin','dispatcher','driver'])
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_users_self ON public.users FOR SELECT TO bus_v3_reader
  USING (id = bus_v3_rls.actor_id() AND active);

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_memberships_self ON public.organization_memberships FOR SELECT TO bus_v3_reader
  USING (user_id = bus_v3_rls.actor_id() AND active AND
    bus_v3_rls.is_member(organization_id,ARRAY['school_admin','parent','operator_admin','dispatcher','driver']));

ALTER TABLE public.school_operator_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_operator_agreements FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_agreement_read ON public.school_operator_agreements FOR SELECT TO bus_v3_reader
  USING (bus_v3_rls.is_member(school_id,ARRAY['school_admin']) OR
         bus_v3_rls.is_member(operator_id,ARRAY['operator_admin','dispatcher']));

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_students_read ON public.students FOR SELECT TO bus_v3_reader USING (
  active AND (bus_v3_rls.is_member(school_id,ARRAY['school_admin']) OR
  bus_v3_rls.parent_linked(id))
);

ALTER TABLE public.verified_parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_parent_student_links FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_links_read ON public.verified_parent_student_links FOR SELECT TO bus_v3_reader
  USING (revoked_at IS NULL AND (bus_v3_rls.parent_linked(student_id) OR
    bus_v3_rls.school_admin_for_student(student_id)));

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_vehicles_read ON public.vehicles FOR SELECT TO bus_v3_reader
  USING (bus_v3_rls.is_member(operator_id,ARRAY['operator_admin','dispatcher']));

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_routes_read ON public.routes FOR SELECT TO bus_v3_reader
  USING (bus_v3_rls.route_visible(id));

ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_stops_read ON public.route_stops FOR SELECT TO bus_v3_reader
  USING (bus_v3_rls.route_visible(route_id));

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_trips_read ON public.trips FOR SELECT TO bus_v3_reader
  USING (bus_v3_rls.trip_visible(id));

ALTER TABLE public.trip_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_students FORCE ROW LEVEL SECURITY;
CREATE POLICY v3_trip_students_read ON public.trip_students FOR SELECT TO bus_v3_reader
  USING (bus_v3_rls.trip_visible(trip_id) AND (
    EXISTS (SELECT 1 FROM public.trips AS t WHERE t.id=trip_id AND
      bus_v3_rls.is_member(t.school_id,ARRAY['school_admin'])) OR
    bus_v3_rls.parent_linked(student_id)
  ));

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
-- Aucun rôle applicatif ne peut lire l'audit.

COMMIT;

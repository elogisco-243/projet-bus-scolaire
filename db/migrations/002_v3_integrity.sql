-- Bus scolaire V3 / migration 002 - integrite multi-organisation.
-- Depend de 001_v3_core.sql. Executer sur PostgreSQL 14+ en sandbox apres sauvegarde.
-- NE PAS lancer directement sur la base de production.
BEGIN;

-- Une FK composite permet de distinguer une ecole d'un transporteur au niveau SQL.
ALTER TABLE organizations
  ADD CONSTRAINT organizations_id_kind_uq UNIQUE (id, kind);

ALTER TABLE organization_memberships
  ADD COLUMN organization_kind text GENERATED ALWAYS AS
    (CASE WHEN role IN ('school_admin', 'parent') THEN 'school' ELSE 'operator' END) STORED,
  ADD CONSTRAINT memberships_organization_kind_fk
    FOREIGN KEY (organization_id, organization_kind) REFERENCES organizations(id, kind);

ALTER TABLE school_operator_agreements
  ADD COLUMN school_kind text GENERATED ALWAYS AS ('school'::text) STORED,
  ADD COLUMN operator_kind text GENERATED ALWAYS AS ('operator'::text) STORED,
  ADD CONSTRAINT agreements_school_kind_fk
    FOREIGN KEY (school_id, school_kind) REFERENCES organizations(id, kind),
  ADD CONSTRAINT agreements_operator_kind_fk
    FOREIGN KEY (operator_id, operator_kind) REFERENCES organizations(id, kind);

ALTER TABLE students
  ADD COLUMN school_kind text GENERATED ALWAYS AS ('school'::text) STORED,
  ADD CONSTRAINT students_school_kind_fk
    FOREIGN KEY (school_id, school_kind) REFERENCES organizations(id, kind),
  ADD CONSTRAINT students_id_school_uq UNIQUE (id, school_id);

ALTER TABLE vehicles
  ADD COLUMN operator_kind text GENERATED ALWAYS AS ('operator'::text) STORED,
  ADD CONSTRAINT vehicles_operator_kind_fk
    FOREIGN KEY (operator_id, operator_kind) REFERENCES organizations(id, kind),
  ADD CONSTRAINT vehicles_id_operator_uq UNIQUE (id, operator_id);

ALTER TABLE routes
  ADD CONSTRAINT routes_id_school_operator_uq UNIQUE (id, school_id, operator_id);

-- Denormalisation encadree par FK composite : le trajet garde les memes organisations
-- que son itineraire, et son vehicule appartient obligatoirement au transporteur.
ALTER TABLE trips ADD COLUMN school_id uuid, ADD COLUMN operator_id uuid;
UPDATE trips AS t SET school_id = r.school_id, operator_id = r.operator_id
FROM routes AS r WHERE r.id = t.route_id;
ALTER TABLE trips
  ALTER COLUMN school_id SET NOT NULL,
  ALTER COLUMN operator_id SET NOT NULL,
  ADD CONSTRAINT trips_route_organizations_fk
    FOREIGN KEY (route_id, school_id, operator_id)
    REFERENCES routes(id, school_id, operator_id),
  ADD CONSTRAINT trips_vehicle_operator_fk
    FOREIGN KEY (vehicle_id, operator_id)
    REFERENCES vehicles(id, operator_id),
  ADD CONSTRAINT trips_id_school_uq UNIQUE (id, school_id);

-- Un eleve affecte au trajet doit appartenir a l'ecole du trajet.
ALTER TABLE trip_students ADD COLUMN school_id uuid;
UPDATE trip_students AS ts SET school_id = t.school_id
FROM trips AS t WHERE ts.trip_id = t.id;
ALTER TABLE trip_students
  ALTER COLUMN school_id SET NOT NULL,
  ADD CONSTRAINT trip_students_trip_school_fk
    FOREIGN KEY (trip_id, school_id) REFERENCES trips(id, school_id),
  ADD CONSTRAINT trip_students_student_school_fk
    FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id);

-- Avant d'affecter un chauffeur, verifier qu'il est membre du bon transporteur.
-- Avant de demarrer/reaffecter un trajet en cours, verifier les statuts actifs.
CREATE FUNCTION v3_check_trip_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM organization_memberships m
    WHERE m.organization_id = NEW.operator_id
      AND m.user_id = NEW.driver_user_id
      AND m.role = 'driver' AND m.active
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'V3: chauffeur non actif ou hors transporteur' USING ERRCODE='23514';
  END IF;

  IF NEW.status = 'in_progress' THEN
    PERFORM 1 FROM users u WHERE u.id = NEW.driver_user_id AND u.active FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'V3: compte chauffeur inactif' USING ERRCODE='23514';
    END IF;

    PERFORM 1 FROM school_operator_agreements a
      WHERE a.school_id = NEW.school_id AND a.operator_id = NEW.operator_id
        AND a.status = 'active' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'V3: convention ecole-transporteur inactive' USING ERRCODE='23514';
    END IF;

    PERFORM 1 FROM vehicles v
      WHERE v.id = NEW.vehicle_id AND v.operator_id = NEW.operator_id AND v.active FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'V3: vehicule inactif' USING ERRCODE='23514';
    END IF;

    PERFORM 1 FROM routes r WHERE r.id = NEW.route_id AND r.active FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'V3: itineraire inactif' USING ERRCODE='23514';
    END IF;

    PERFORM 1 FROM organizations o WHERE o.id = NEW.school_id AND o.active FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'V3: ecole inactive' USING ERRCODE='23514';
    END IF;
    PERFORM 1 FROM organizations o WHERE o.id = NEW.operator_id AND o.active FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'V3: transporteur inactif' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trips_check_assignment
BEFORE INSERT OR UPDATE OF route_id, vehicle_id, driver_user_id, status, school_id, operator_id
ON trips FOR EACH ROW EXECUTE FUNCTION v3_check_trip_assignment();

-- Interdire les desactivations qui rendraient incoherent un trajet actif.
-- Les mises a jour acquièrent un verrou sur la ligne source; les demarrages
-- prennent FOR SHARE dans v3_check_trip_assignment.
CREATE FUNCTION v3_guard_active_trip_dependencies() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_trip_exists boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'vehicles' THEN
    IF OLD.active AND NOT NEW.active THEN
      SELECT EXISTS (SELECT 1 FROM trips t WHERE t.vehicle_id = OLD.id
                     AND t.status = 'in_progress') INTO active_trip_exists;
    END IF;
  ELSIF TG_TABLE_NAME = 'routes' THEN
    IF OLD.active AND NOT NEW.active THEN
      SELECT EXISTS (SELECT 1 FROM trips t WHERE t.route_id = OLD.id
                     AND t.status = 'in_progress') INTO active_trip_exists;
    END IF;
  ELSIF TG_TABLE_NAME = 'school_operator_agreements' THEN
    IF OLD.status = 'active' AND NEW.status <> 'active' THEN
      SELECT EXISTS (SELECT 1 FROM trips t WHERE t.school_id = OLD.school_id
                     AND t.operator_id = OLD.operator_id AND t.status = 'in_progress')
        INTO active_trip_exists;
    END IF;
  ELSIF TG_TABLE_NAME = 'organization_memberships' THEN
    IF OLD.role = 'driver' AND OLD.active AND NOT NEW.active THEN
      SELECT EXISTS (SELECT 1 FROM trips t WHERE t.operator_id = OLD.organization_id
                     AND t.driver_user_id = OLD.user_id AND t.status = 'in_progress')
        INTO active_trip_exists;
    END IF;
  ELSIF TG_TABLE_NAME = 'users' THEN
    IF OLD.active AND NOT NEW.active THEN
      SELECT EXISTS (SELECT 1 FROM trips t WHERE t.driver_user_id = OLD.id
                     AND t.status = 'in_progress') INTO active_trip_exists;
    END IF;
  ELSIF TG_TABLE_NAME = 'organizations' THEN
    IF OLD.active AND NOT NEW.active THEN
      SELECT EXISTS (SELECT 1 FROM trips t
                     WHERE (t.school_id = OLD.id OR t.operator_id = OLD.id)
                       AND t.status = 'in_progress') INTO active_trip_exists;
    END IF;
  END IF;
  IF active_trip_exists THEN
    RAISE EXCEPTION 'V3: terminer ou reaffecter le trajet avant desactivation'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_vehicle_active BEFORE UPDATE OF active ON vehicles
FOR EACH ROW EXECUTE FUNCTION v3_guard_active_trip_dependencies();
CREATE TRIGGER guard_route_active BEFORE UPDATE OF active ON routes
FOR EACH ROW EXECUTE FUNCTION v3_guard_active_trip_dependencies();
CREATE TRIGGER guard_agreement_status BEFORE UPDATE OF status ON school_operator_agreements
FOR EACH ROW EXECUTE FUNCTION v3_guard_active_trip_dependencies();
CREATE TRIGGER guard_driver_membership BEFORE UPDATE OF active ON organization_memberships
FOR EACH ROW EXECUTE FUNCTION v3_guard_active_trip_dependencies();
CREATE TRIGGER guard_driver_account BEFORE UPDATE OF active ON users
FOR EACH ROW EXECUTE FUNCTION v3_guard_active_trip_dependencies();
CREATE TRIGGER guard_organization_active BEFORE UPDATE OF active ON organizations
FOR EACH ROW EXECUTE FUNCTION v3_guard_active_trip_dependencies();

-- Verification d'un lien parent/eleve : meme ecole et verification par admin scolaire.
-- La revocation doit rester possible meme quand le parent n'a plus de compte actif.
CREATE FUNCTION v3_verify_parent_student_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE school uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.parent_user_id <> OLD.parent_user_id OR NEW.student_id <> OLD.student_id) THEN
    RAISE EXCEPTION 'V3: lien parent-eleve immuable; revoquer et recreer' USING ERRCODE='23514';
  END IF;
  IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT s.school_id INTO school FROM students s WHERE s.id = NEW.student_id AND s.active;
  IF school IS NULL THEN
    RAISE EXCEPTION 'V3: eleve non actif' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM organization_memberships m JOIN users u ON u.id=m.user_id
    WHERE m.organization_id=school AND m.user_id=NEW.parent_user_id
      AND m.role='parent' AND m.active AND u.active FOR SHARE OF m, u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'V3: parent non verifie par cette ecole' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM organization_memberships m JOIN users u ON u.id=m.user_id
    WHERE m.organization_id=school AND m.user_id=NEW.verified_by_user_id
      AND m.role='school_admin' AND m.active AND u.active FOR SHARE OF m, u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'V3: verification exige un administrateur de cette ecole'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER verify_parent_student_link
BEFORE INSERT OR UPDATE OF parent_user_id, student_id, verified_by_user_id, revoked_at
ON verified_parent_student_links FOR EACH ROW EXECUTE FUNCTION v3_verify_parent_student_link();

-- Important: ce lot NE met PAS en place les politiques RLS. Toute connexion SQL
-- applicative directe reste interdite avant RLS et tests d'isolation.
COMMIT;

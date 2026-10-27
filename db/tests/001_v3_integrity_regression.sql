-- A executer sur une BASE DE TEST apres 001_v3_core.sql et 002_v3_integrity.sql.
-- Les donnees sont fictives et le ROLLBACK final ne laisse aucune donnee de test.
\set ON_ERROR_STOP on
BEGIN;
DO $tests$
DECLARE
  sa uuid := gen_random_uuid(); sb uuid := gen_random_uuid();
  oa uuid := gen_random_uuid(); ob uuid := gen_random_uuid();
  da uuid := gen_random_uuid(); db uuid := gen_random_uuid();
  pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  aa uuid := gen_random_uuid(); ab uuid := gen_random_uuid();
  va uuid := gen_random_uuid(); vb uuid := gen_random_uuid();
  ra uuid := gen_random_uuid(); rb uuid := gen_random_uuid();
  ta uuid := gen_random_uuid(); st_a uuid := gen_random_uuid(); st_b uuid := gen_random_uuid();
BEGIN
  INSERT INTO organizations(id,kind,name) VALUES
    (sa,'school','Ecole Alpha'), (sb,'school','Ecole Beta'),
    (oa,'operator','Transport Alpha'), (ob,'operator','Transport Beta');
  INSERT INTO users(id,identity_subject) VALUES
    (da,'integration-driver-a'),(db,'integration-driver-b'),
    (pa,'integration-parent-a'),(pb,'integration-parent-b'),
    (aa,'integration-admin-a'),(ab,'integration-admin-b');
  INSERT INTO organization_memberships(organization_id,user_id,role) VALUES
    (oa,da,'driver'),(ob,db,'driver'),(sa,pa,'parent'),(sb,pb,'parent'),
    (sa,aa,'school_admin'),(sb,ab,'school_admin');

  -- Inversion des types ecole/transporteur interdite.
  BEGIN
    INSERT INTO school_operator_agreements(school_id,operator_id,status)
      VALUES (oa,sa,'active');
    RAISE EXCEPTION 'ECHEC TEST: accord avec roles inverses accepte';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  -- Compte chauffeur membre d'une ecole interdit.
  BEGIN
    INSERT INTO organization_memberships(organization_id,user_id,role)
      VALUES (sa,db,'driver');
    RAISE EXCEPTION 'ECHEC TEST: chauffeur membre ecole accepte';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO school_operator_agreements(school_id,operator_id,status)
    VALUES(sa,oa,'active'),(sb,ob,'active');
  INSERT INTO students(id,school_id,school_student_ref) VALUES
    (st_a,sa,'ALPHA_001'),(st_b,sb,'BETA_001');
  INSERT INTO vehicles(id,operator_id,fleet_code,seat_capacity) VALUES
    (va,oa,'BUS_A',20),(vb,ob,'BUS_B',18);
  INSERT INTO routes(id,school_id,operator_id,route_code)
    VALUES(ra,sa,oa,'A01'),(rb,sb,ob,'B01');

  -- Pas de vehicule d'un autre transporteur sur ce trajet.
  BEGIN
    INSERT INTO trips(route_id,vehicle_id,driver_user_id,school_id,operator_id,scheduled_start_at)
      VALUES (ra,vb,da,sa,oa,now());
    RAISE EXCEPTION 'ECHEC TEST: vehicule autre transporteur accepte';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  -- Un chauffeur d'un transporteur B ne peut conduire la ligne A.
  BEGIN
    INSERT INTO trips(route_id,vehicle_id,driver_user_id,school_id,operator_id,scheduled_start_at)
      VALUES (ra,va,db,sa,oa,now());
    RAISE EXCEPTION 'ECHEC TEST: chauffeur externe accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Impossible de mentir sur l'ecole de l'itineraire.
  BEGIN
    INSERT INTO trips(route_id,vehicle_id,driver_user_id,school_id,operator_id,scheduled_start_at)
      VALUES (ra,va,da,sb,oa,now());
    RAISE EXCEPTION 'ECHEC TEST: fausse ecole du trajet acceptee';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO trips(id,route_id,vehicle_id,driver_user_id,school_id,operator_id,scheduled_start_at)
    VALUES (ta,ra,va,da,sa,oa,now());
  INSERT INTO trip_students(trip_id,student_id,school_id) VALUES (ta,st_a,sa);
  -- Un enfant d'une ecole B ne peut etre inscrit au trajet d'une ecole A.
  BEGIN
    INSERT INTO trip_students(trip_id,student_id,school_id) VALUES(ta,st_b,sa);
    RAISE EXCEPTION 'ECHEC TEST: eleve autre ecole accepte';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  -- Pas de lien parent de l'ecole B avec un enfant de l'ecole A.
  BEGIN
    INSERT INTO verified_parent_student_links(parent_user_id,student_id,verified_at,verified_by_user_id)
      VALUES(pb,st_a,now(),aa);
    RAISE EXCEPTION 'ECHEC TEST: lien parent autre ecole accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Pas de verification par l'admin d'une autre ecole.
  BEGIN
    INSERT INTO verified_parent_student_links(parent_user_id,student_id,verified_at,verified_by_user_id)
      VALUES(pa,st_a,now(),ab);
    RAISE EXCEPTION 'ECHEC TEST: admin autre ecole accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Verification legitime et revocation.
  INSERT INTO verified_parent_student_links(parent_user_id,student_id,verified_at,verified_by_user_id)
    VALUES(pa,st_a,now(),aa);
  UPDATE verified_parent_student_links SET revoked_at=now()
    WHERE parent_user_id=pa AND student_id=st_a;

  -- Une convention non active interdit le demarrage.
  UPDATE school_operator_agreements SET status='suspended' WHERE school_id=sa AND operator_id=oa;
  BEGIN
    UPDATE trips SET status='in_progress' WHERE id=ta;
    RAISE EXCEPTION 'ECHEC TEST: trajet demarre avec convention suspendue';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE school_operator_agreements SET status='active' WHERE school_id=sa AND operator_id=oa;
  UPDATE trips SET status='in_progress',started_at=now() WHERE id=ta;

  -- Les ressources d'un trajet EN COURS ne peuvent etre desactivees.
  BEGIN
    UPDATE vehicles SET active=false WHERE id=va;
    RAISE EXCEPTION 'ECHEC TEST: desactivation vehicule actif acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE routes SET active=false WHERE id=ra;
    RAISE EXCEPTION 'ECHEC TEST: desactivation itineraire actif acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE organization_memberships SET active=false
      WHERE organization_id=oa AND user_id=da AND role='driver';
    RAISE EXCEPTION 'ECHEC TEST: desactivation chauffeur actif acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE users SET active=false WHERE id=da;
    RAISE EXCEPTION 'ECHEC TEST: desactivation compte chauffeur actif acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE school_operator_agreements SET status='ended' WHERE school_id=sa AND operator_id=oa;
    RAISE EXCEPTION 'ECHEC TEST: arret accord actif accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE organizations SET active=false WHERE id=sa;
    RAISE EXCEPTION 'ECHEC TEST: fermeture ecole avec trajet actif acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Apres fin de trajet, le compte chauffeur peut etre desactive.
  UPDATE trips SET status='completed',ended_at=now() WHERE id=ta;
  UPDATE organization_memberships SET active=false
    WHERE organization_id=oa AND user_id=da AND role='driver';
  IF NOT EXISTS (SELECT 1 FROM organization_memberships
                 WHERE organization_id=oa AND user_id=da AND NOT active) THEN
    RAISE EXCEPTION 'ECHEC TEST: desactivation chauffeur termine';
  END IF;
  RAISE NOTICE 'OK : protections multi-ecoles, multi-transporteurs, parents et trajets actifs';
END;
$tests$;
ROLLBACK;

'use strict';

// SYNC-04 isolated SQL writer: never mounted or deployed in this branch.
const {createActorProof}=require('./rls-session');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
function createSync04PgWriter({pool,signingSecretHex}) {
  if(!pool||typeof pool.connect!=='function')throw TypeError('Writer pool required');
  createActorProof('11111111-1111-4111-8111-111111111111',signingSecretHex);
  return {
    async saveEvent(actor,event) {
      if(!uuid(actor?.userId)||!uuid(event?.id)||!uuid(event?.tripId)||
         !uuid(event?.studentId)||(event.stopId!=null&&!uuid(event.stopId))||
         !['board','alight'].includes(event.type)||
         typeof event.occurredAt!=='string')
        throw new TypeError('Invalid authorized event');
      const proof=createActorProof(actor.userId,signingSecretHex);
      const client=await pool.connect();
      let active=false;
      try {
        await client.query('BEGIN');
        active=true;
        await client.query('SET LOCAL ROLE bus_v3_writer');
        const role=await client.query(
          "SELECT current_user AS role,current_setting('transaction_read_only') AS read_only");
        if(role.rows[0]?.role!=='bus_v3_writer'||role.rows[0]?.read_only!=='off')
          throw Error('SYNC04_WRITER_ROLE_NOT_ENFORCED');
        await client.query(
          "SELECT set_config('bus_v3.actor_id',$1,true),set_config('bus_v3.actor_exp',$2,true),set_config('bus_v3.actor_proof',$3,true)",
          [proof.actorId,proof.expiry,proof.proof]);
        const saved=await client.query(
          "SELECT bus_v3_write.record_pointage($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::timestamptz) AS receipt",
          [event.id,event.tripId,event.studentId,event.stopId,event.type,event.occurredAt]
        );
        const receipt=saved.rows[0]?.receipt;
        if(!receipt||!['recorded','already_recorded'].includes(receipt.result)||
           !Number.isSafeInteger(Number(receipt.sequenceNo))||Number(receipt.sequenceNo)<1)
          throw Error('SYNC04_INVALID_DATABASE_RESULT');
        await client.query('COMMIT');
        active=false;
        return {result:receipt.result,sequenceNo:Number(receipt.sequenceNo)};
      } catch(e) {
        if(active)try{await client.query('ROLLBACK');}catch{ /* preserve error */ }
        throw e;
      } finally {client.release();}
    }
  };
}
module.exports={createSync04PgWriter};

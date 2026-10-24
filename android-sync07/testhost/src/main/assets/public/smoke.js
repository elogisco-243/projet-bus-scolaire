// SYNC-11 synthetic local test host; only stores [] and randomly generated tenant UUIDs.
// NEVER import or execute in UI-145. No fetch(), network, credentials or student data.
window.__sync11Result = 'PENDING';
const state = document.getElementById('state');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function finish(value) {
  window.__sync11Result = value;
  if (state) state.textContent = value;
}
async function smoke() {
  let native = null, token = null, part = null;
  try {
    for (let i = 0; i < 80; i++) {
      native = window.Capacitor?.Plugins?.A2SScolaSecureQueue;
      if (native && typeof native.inspect === 'function') break;
      await sleep(250);
    }
    if (!native || typeof native.inspect !== 'function') throw Error('BRIDGE_NOT_REGISTERED');
    const meta = await native.inspect();
    if (meta?.provider !== 'native_encrypted_sqlite' ||
        meta.version !== 1 || meta.atomicRevision !== true ||
        meta.deviceWideLease !== true || meta.locked !== false)
      throw Error('INVALID_NATIVE_INSPECT');

    part = 'a2s-scola-sync06:' + Array.from({length:4}, () => crypto.randomUUID()).join(':');
    ({token} = await native.acquireLease({partition:part}));
    if (typeof token !== 'string' || token.length < 20) throw Error('INVALID_LEASE');

    const before = await native.read({partition:part,token});
    if (before.revision !== 0 || !Array.isArray(before.items) || before.items.length !== 0)
      throw Error('NONEMPTY_TEST_PARTITION');

    const ack = await native.compareAndSwap({
      partition:part,token,revision:before.revision,items:[]
    });
    if (ack.revision !== 1) throw Error('CAS_REVISION_MISMATCH');

    const after = await native.read({partition:part,token});
    if (after.revision !== 1 || after.items.length !== 0)
      throw Error('READ_AFTER_CAS_MISMATCH');

    let staleRejected = false;
    try { await native.compareAndSwap({partition:part,token,revision:0,items:[]}); }
    catch (_) { staleRejected = true; }
    if (!staleRejected) throw Error('STALE_CAS_NOT_REJECTED');

    await native.releaseLease({token});
    token = null;
    const retry = await native.acquireLease({partition:part});
    token = retry.token;
    const persisted = await native.read({partition:part,token});
    if (persisted.revision !== 1 || persisted.items.length !== 0)
      throw Error('NATIVE_REOPEN_READ_INVALID');
    await native.releaseLease({token});
    token = null;
    finish('PASS');
  } catch (err) {
    finish('FAIL:' + String(err?.message || err).slice(0,110).replace(/[\r\n]/g, ' '));
  } finally {
    if (token && native) {
      try {await native.releaseLease({token});} catch (_) {}
    }
  }
}
window.addEventListener('load', () => { void smoke(); }, {once:true});
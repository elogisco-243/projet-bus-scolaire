// SYNC-08 staging opt-in only. This module is NOT imported by UI-145.
// Real app must register ScolaQueuePlugin in MainActivity explicitly.
import {createSync07ScopedBridge} from '../mobile-sync07/bridge.mjs';
import {Sync05Error} from '../mobile-sync05/transport.mjs';
export function createSync08CapacitorBridge({registerPlugin,enabled=false,
  mode,platform}={}) {
  if(!enabled||mode!=='staging'||platform!=='android')
    throw new Sync05Error('SYNC08_DISABLED','review');
  if(typeof registerPlugin!=='function')
    throw new TypeError('CAPACITOR_REGISTER_PLUGIN_REQUIRED');
  const native=registerPlugin('A2SScolaSecureQueue');
  return createSync07ScopedBridge({plugin:native});
}

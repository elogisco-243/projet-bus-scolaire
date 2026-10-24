// SYNC-07: JavaScript adapter to a FUTURE trusted Capacitor/native plugin.
// The plugin must forward calls to SqlCipherQueueStore and restrict WebView origin.
// NOT imported by UI-145. No fake encrypted storage fallback.
import {Sync05Error} from '../mobile-sync05/transport.mjs';

// Adapter exactly implementing SYNC-06's read/persist interface.
// Scoped token lives only inside withExclusiveLease, never in localStorage.
export function createSync07ScopedBridge({plugin}={}){
  const names=['inspect','acquireLease','read','compareAndSwap','releaseLease'];
  if(!plugin||names.some(n=>typeof plugin[n]!=='function'))
    throw new TypeError('SYNC07_NATIVE_PLUGIN_REQUIRED');
  let current=null;
  return Object.freeze({
    async inspect(){
      return plugin.inspect();
    },
    async withExclusiveLease(partition,callback){
      if(current)throw new Sync05Error('NATIVE_LEASE_BUSY');
      const acquired=await plugin.acquireLease({partition});
      if(typeof acquired?.token!=='string'||acquired.token.length<20)
        throw new Sync05Error('NATIVE_LEASE_INVALID','review');
      const lease={partition,token:acquired.token};
      current=lease;
      let output,error;
      try{output=await callback();}catch(e){error=e;}
      try{await plugin.releaseLease({token:lease.token});}catch(e){if(!error)error=e;}
      current=null;
      if(error)throw error;
      return output;
    },
    async read(partition){
      if(!current||current.partition!==partition)throw new Sync05Error('NATIVE_LEASE_REQUIRED','review');
      return plugin.read({partition,token:current.token});
    },
    async compareAndSwap(partition,expectedRevision,items){
      if(!current||current.partition!==partition)throw new Sync05Error('NATIVE_LEASE_REQUIRED','review');
      return plugin.compareAndSwap({partition,token:current.token,revision:expectedRevision,items});
    }
  });
}

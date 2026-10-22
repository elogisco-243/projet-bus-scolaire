// SYNC-07: JavaScript adapter to a FUTURE trusted Capacitor/native plugin.
// The plugin must forward calls to SqlCipherQueueStore and restrict WebView origin.
// NOT imported by UI-145. No fake encrypted storage fallback.
import {Sync05Error} from '../mobile-sync05/transport.mjs';

export function createSync07NativeBridge({plugin}={}){
  const names=['inspect','acquireLease','read','compareAndSwap','releaseLease'];
  if(!plugin||names.some(n=>typeof plugin[n]!=='function'))
    throw new TypeError('SYNC07_NATIVE_PLUGIN_REQUIRED');

  return Object.freeze({
    async inspect(){
      const state=await plugin.inspect();
      if(!state||state.provider!=='native_encrypted_sqlite'||
         state.version!==1||state.atomicRevision!==true||
         state.deviceWideLease!==true||state.locked!==false)
        throw new Sync05Error('NATIVE_STORAGE_NOT_READY','review');
      return state;
    },
    async withExclusiveLease(partition,callback){
      if(typeof callback!=='function')throw new TypeError('LEASE_CALLBACK_REQUIRED');
      // Native plugin acquires an OS file lock; do NOT emulate with JS mutex.
      const lease=await plugin.acquireLease({partition});
      if(typeof lease?.token!=='string'||lease.token.length<20)
        throw new Sync05Error('NATIVE_LEASE_INVALID','review');
      let result,primary;
      try{
        result=await callback();
      }catch(e){primary=e;}
      try{
        await plugin.releaseLease({token:lease.token});
      }catch(e){
        if(!primary)throw e;
      }
      if(primary)throw primary;
      return result;
    },
    // Native read/CAS require lease token; the closure stores the token only
    // while the callback runs, using an explicit contextual wrapper below.
    async read(){throw new Sync05Error('NATIVE_LEASE_CONTEXT_REQUIRED','review');},
    async compareAndSwap(){throw new Sync05Error('NATIVE_LEASE_CONTEXT_REQUIRED','review');}
  });
}

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

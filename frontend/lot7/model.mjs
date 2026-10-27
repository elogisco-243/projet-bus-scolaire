export const PLANS = Object.freeze({freemium:{notifications:true,map:false},gps:{notifications:true,map:true}});
export function canUseMap(role,plan){return role==='parent' && PLANS[plan]?.map===true;}
export function makeDemo(){return {role:'parent',plan:'freemium',online:true,started:false,stop:0,events:[],alerts:[],notifications:[{text:'Le bus est prévu à 06h45',time:'06:30'}],lastSync:null};}
export const stops=['Dépôt','Golf','Centre','École Horizon'];
export function record(s,type,detail=''){const next=structuredClone(s);next.events.unshift({id:`demo-${next.events.length+1}`,type,detail,stop:stops[next.stop],timestamp:new Date().toISOString(),synced:false});return next;}
export function begin(s){if(s.started)return s;let n={...s,started:true};return record(n,'Départ du bus');}
export function arrive(s){if(!s.started)return s;let n=record(s,'Arrivée à l’arrêt');n.stop=Math.min(n.stop+1,stops.length-1);return n;}
export function alertEvent(s,type){if(!s.started)return s;let n=record(s,'Alerte',type);n.alerts.unshift({type,at:new Date().toISOString(),status:'À traiter'});return n;}
export function sync(s){if(!s.online)return s;const n=structuredClone(s);n.events.forEach(e=>e.synced=true);n.lastSync=new Date().toISOString();return n;}
export function setNetwork(s,online){return {...s,online};}
export function parentFeed(s){return [...s.notifications,...s.events.filter(e=>e.synced).map(e=>({text:e.type+(e.detail?` : ${e.detail}`:''),time:new Date(e.timestamp).toLocaleTimeString('fr-CD',{hour:'2-digit',minute:'2-digit'})}))];}

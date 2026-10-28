/** UI-191: Guided demo actions. Keeps validated Android UI assets untouched.
 * Suggestions never grant permission; the UI-188 reducer decides all changes.
 */
import {nextSimpleAction} from './four-role-simple-actions.mjs';
import {executeFourRoleDemo,fourRoleDemoView} from './four-role-demo-workflow.mjs';
const commandMap=Object.freeze({
 driver:Object.freeze({secure_vehicle:'secure_vehicle',begin:'start_trip',arrive:'arrive_stop',
  resume:'resume_trip','close-trip':'finish_trip'}),
 attendant:Object.freeze({check_in:'check_in',ready:'ready_departure',
  confirm_empty:'confirm_empty'}),
 supervisor:Object.freeze({review_trip:'review_trip'}),
 parent:Object.freeze({})
});
const denied=code=>Object.freeze({ok:false,code});
export function guidedRoleView(snapshot,role,{parentStudentIds=[]}={}){
 const suggestion=nextSimpleAction(snapshot,role,{parentStudentIds});
 if(!suggestion.ok)return suggestion;
 const view=fourRoleDemoView(snapshot,role,{parentStudentIds});
 if(!view.ok)return view;
 return Object.freeze({ok:true,role,view,primary:suggestion.primary,
  navigation:suggestion.secondary,mode:'demo'});
}
export function executeSuggestedDemoAction(snapshot,{role,action,parentStudentIds=[]}={}){
 const suggestion=nextSimpleAction(snapshot,role,{parentStudentIds});
 if(!suggestion.ok)return suggestion;
 if(suggestion.primary.action!==action)return denied('NOT_CURRENT_PRIMARY_ACTION');
 const command=commandMap[role]?.[action];
 if(!command)return denied('NAVIGATION_ONLY_OR_REQUIRES_CONTEXT');
 // Explicitly run the existing reducer. A suggestion is never an authorization.
 return executeFourRoleDemo(snapshot,{role,action:command});
}
export function classifySuggestedAction(snapshot,role,{parentStudentIds=[]}={}){
 const suggestion=nextSimpleAction(snapshot,role,{parentStudentIds});
 if(!suggestion.ok)return suggestion;
 return Object.freeze({ok:true,primary:suggestion.primary,
  executable:!!commandMap[role]?.[suggestion.primary.action],
  requiresConfirmation:suggestion.primary.requiresConfirmation,
  operationalEnabled:false});
}
export function dispatchRealWorldAction(){return denied('OPERATIONAL_DISPATCH_DISABLED');}

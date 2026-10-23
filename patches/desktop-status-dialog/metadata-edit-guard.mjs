// Retain the observed metadata base without disabling the dialog's escape controls.
export function guardMetadataEditors(document,{desktop,status,message=()=>{}}){
 const waiting=new WeakMap();let serial=Promise.resolve();
 const update=fn=>{const run=serial.then(fn);serial=run.catch(()=>{});return run;};
 const release=()=>queueMicrotask(()=>{if(!document.querySelector('dialog[open]'))update(()=>document.querySelector('dialog[open]')?undefined:desktop.call('metadataEditorState',[{active:false}])).catch(error=>message(error.message));});
 function restore(session){if(session.restored)return;session.restored=true;clearTimeout(session.timer);session.observer.disconnect();for(const [control,inert]of session.controls)control.inert=inert;session.notice.remove();if(session.busy===null)session.dialog.removeAttribute('aria-busy');else session.dialog.setAttribute('aria-busy',session.busy);}
 function fail(dialog,session,error){if(waiting.get(dialog)!==session)return;waiting.delete(dialog);restore(session);if(dialog.open)dialog.close();release();message(error.message||String(error));}
 document.addEventListener('beforetoggle',event=>{
  const dialog=event.target;if(dialog.tagName!=='DIALOG')return;
  if(event.newState==='closed'){
   const session=waiting.get(dialog);if(!session)return;waiting.delete(dialog);restore(session);release();return;
  }
  if(event.newState!=='open'||!status()?.active)return;
  const head=status().projectedHead,notice=document.createElement('p'),controls=new Map();
  notice.className='small muted';notice.dataset.metadataEditorWait='';notice.setAttribute('role','status');notice.textContent='Preparing this editor. Waiting for the current save to finish…';
  const gateControls=()=>{for(const control of dialog.querySelectorAll('button,input,textarea,select,[contenteditable],a[href]')){if(control.matches('[data-close]')||controls.has(control))continue;controls.set(control,control.inert);control.inert=true;}};
  const observer=new MutationObserver(gateControls),session={dialog,notice,controls,observer,busy:dialog.getAttribute('aria-busy'),timer:null};
  waiting.set(dialog,session);dialog.setAttribute('aria-busy','true');gateControls();observer.observe(dialog,{childList:true,subtree:true});const heading=dialog.querySelector('.dialog-head');if(heading)heading.after(notice);else dialog.prepend(notice);
  session.timer=setTimeout(()=>fail(dialog,session,Error('The editor could not finish opening. No changes were made. Wait for the current save to finish, then try again.')),15000);
  update(()=>waiting.get(dialog)===session?desktop.call('metadataEditorState',[{active:true,head}]):undefined).then(()=>{
   if(waiting.get(dialog)!==session)return;restore(session);
   if(dialog.open){const focus=[...dialog.querySelectorAll('[autofocus],input:not([type=hidden]),textarea,select,button:not([data-close])')].find(control=>!control.inert&&!control.disabled&&!control.closest('[inert]'));focus?.focus({preventScroll:true});}
  }).catch(error=>fail(dialog,session,error));
 },true);
}

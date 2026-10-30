import {MAX_FILES,validateFile} from './attachment-core.mjs';
export const isFileDrag=transfer=>Array.from(transfer?.types||[]).includes('Files');
export function droppedFiles(transfer){
 const files=Array.from(transfer?.files||[]),entries=Array.from(transfer?.items||[]);
 if(!isFileDrag(transfer)||!files.length||files.length>MAX_FILES)throw Error('Drop 1–'+MAX_FILES+' Files onto a Task.');
 if(entries.some(item=>item.kind!=='file'||item.webkitGetAsEntry?.()?.isDirectory))throw Error('Drop Files Only; Folders and Mixed Text Drops Are Not Supported.');
 for(const file of files)validateFile(file);
 return files;
}
// External HTML file drops are independent of the existing pointer-based hierarchy drag.
export class FileDropTarget{
 constructor({doc,attach,item,notify,internalDrag=()=>false,suppressClick=()=>{}}){this.doc=doc;this.attach=attach;this.item=item;this.notify=notify;this.internalDrag=internalDrag;this.suppressClick=suppressClick;this.busy=false;this.target=null;
  this.feedback=doc.createElement('p');this.feedback.id='file-drop-feedback';this.feedback.className='drop-message';this.feedback.setAttribute('role','status');this.feedback.hidden=true;doc.body.append(this.feedback);
  this.over=e=>this.dragover(e);this.leave=e=>{if(this.target&&(!e.relatedTarget?.nodeType||!this.target.contains(e.relatedTarget)))this.clear();};this.end=()=>this.clear();this.drop=e=>this.receive(e);this.escape=e=>{if(e.key==='Escape')this.clear();};
  doc.addEventListener('dragenter',this.over,true);doc.addEventListener('dragover',this.over,true);doc.addEventListener('dragleave',this.leave,true);doc.addEventListener('drop',this.drop,true);doc.addEventListener('dragend',this.end,true);doc.addEventListener('keydown',this.escape,true);doc.defaultView.addEventListener('blur',this.end);
 }
 row(element){const row=element?.closest?.('#rows > tr[data-row]');return row&&row.getClientRects().length&&this.item(row.dataset.row)?row:null;}
 clear(){this.target?.classList.remove('file-drop-target');this.target=null;this.feedback.hidden=true;}
 dragover(event){if(!isFileDrag(event.dataTransfer))return;event.preventDefault();event.stopPropagation();const row=this.internalDrag()||this.busy?null:this.row(event.target);if(event.dataTransfer)event.dataTransfer.dropEffect=row?'copy':'none';if(this.target!==row)this.clear();if(!row)return;this.target=row;row.classList.add('file-drop-target');const item=this.item(row.dataset.row);this.feedback.textContent='Attach Files to “'+item.summary+'” · '+item.id;this.feedback.hidden=false;}
 async receive(event){
  // Prevent default file/URL navigation even when the destination is outside the list.
  event.preventDefault();if(!isFileDrag(event.dataTransfer))return;event.stopImmediatePropagation();const row=this.row(event.target),item=row&&this.item(row.dataset.row);this.clear();this.suppressClick();
  if(this.busy){this.notify('Files Are Still Being Kept Locally. Wait Before Dropping More.');return;}
  if(this.internalDrag()||!item){this.notify('Drop Files onto a Task in the Work Pane.');return;}
  let files;try{files=droppedFiles(event.dataTransfer);}catch(error){this.notify(error.message);return;}
  this.busy=true;this.notify('Keeping '+files.length+' File'+(files.length===1?'':'s')+' for '+item.id+' Locally…');
  try{const result=await this.attach(item.id,files);this.notify(result.length+' File'+(result.length===1?'':'s')+' Added to “'+item.summary+'” · '+item.id+'. Upload Follows the Auto-Sync Setting.');}
  catch(error){this.notify('Cannot Attach to '+item.id+' · '+error.message);}
  finally{this.busy=false;this.clear();}
 }
 dispose(){this.clear();const d=this.doc;d.removeEventListener('dragenter',this.over,true);d.removeEventListener('dragover',this.over,true);d.removeEventListener('dragleave',this.leave,true);d.removeEventListener('drop',this.drop,true);d.removeEventListener('dragend',this.end,true);d.removeEventListener('keydown',this.escape,true);d.defaultView.removeEventListener('blur',this.end);this.feedback.remove();}
}


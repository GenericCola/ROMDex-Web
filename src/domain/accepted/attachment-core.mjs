export const MAX_FILE_BYTES=50*1024*1024;
export const MAX_FILES=10;
export function validateFile(file,limit=MAX_FILE_BYTES){
 if(typeof file.name!=='string'||!file.name||file.name.length>255||/[\\/\r\n\0]/.test(file.name)||['.','..'].includes(file.name))throw Error('Use a Valid File Name Without Path Characters.');
 if(!Number.isSafeInteger(file.size)||file.size<0||file.size>limit)throw Error('Files Must Be '+fileSize(limit)+' or Smaller.');
}
export function fileSize(bytes){return bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(1)+' KB':(bytes/1024/1024).toFixed(1)+' MB';}
export const isRaster=type=>['image/png','image/jpeg','image/gif','image/webp','image/bmp'].includes(type);
export function attachmentMetadata(raw){return {id:raw.id,name:raw.name,size:raw.size,mimeType:raw.mimeType||'application/octet-stream',created:raw.created,updated:raw.updated};}
export function attachmentCount(item){return (item.attachments?.length||0)+(item.pendingAttachments?.length||0);}
export function validUploadId(id){if(typeof id!=='string'||!/^[-\w]{1,100}$/.test(id))throw Error('Invalid Upload ID.');return id;}
export function validateUpload(op){validUploadId(op.uploadId);if(op.opId!==op.uploadId)throw Error('Upload and Operation IDs Must Match.');validateFile(op.file);if(!/^[a-f0-9]{64}$/.test(op.file.hash||''))throw Error('Invalid File Checksum.');}
export function validateAttachmentDelete(op){
 if(op.type!=='attachment-delete'||!/^[-\w]{1,100}$/.test(op.opId||'')||!/^PMON-\d+$/.test(op.issueId||'')||!/^[-\w]{1,100}$/.test(op.attachmentId||'')||op.base?.id!==op.attachmentId||typeof op.base.name!=='string'||!Number.isSafeInteger(op.base.size)||op.base.size<0)throw Error('Invalid Attachment Deletion.');
}
export function sameAttachment(a,b){return ['id','name','size','mimeType','created','updated'].every(k=>a[k]===b[k]);}

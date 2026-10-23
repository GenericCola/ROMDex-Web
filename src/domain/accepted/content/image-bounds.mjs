import {Buffer} from 'buffer/index.js';
import {requireThat} from './contracts.mjs';
export function checkImageBounds(bytes,mime){
 let width=0,height=0;
 if(mime==='image/png'){requireThat(bytes.length>=33&&bytes.readUInt32BE(8)===13&&bytes.subarray(12,16).toString()==='IHDR','The PNG Header Is Incomplete.');width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
 else if(mime==='image/gif'){requireThat(bytes.length>=10,'The GIF Header Is Incomplete.');width=bytes.readUInt16LE(6);height=bytes.readUInt16LE(8);}
 else if(mime==='image/jpeg'){
  let at=2;while(at<bytes.length){requireThat(bytes[at++]===255,'Invalid JPEG Marker.');while(bytes[at]===255)at++;const marker=bytes[at++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;requireThat(at+2<=bytes.length,'Incomplete JPEG Segment.');const size=bytes.readUInt16BE(at);requireThat(size>=2&&at+size<=bytes.length,'Invalid JPEG Segment Length.');if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){requireThat(size>=8,'Incomplete JPEG Dimensions.');height=bytes.readUInt16BE(at+3);width=bytes.readUInt16BE(at+5);break;}at+=size;}
 }else if(mime==='image/webp'){
  const kind=bytes.subarray(12,16).toString();if(kind==='VP8X'){requireThat(bytes.length>=30,'Incomplete WebP Header.');width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}
  else if(kind==='VP8L'){requireThat(bytes.length>=25&&bytes[20]===0x2f,'Incomplete Lossless WebP Header.');const data=bytes.readUInt32LE(21);width=(data&0x3fff)+1;height=((data>>>14)&0x3fff)+1;}
  else{requireThat(kind==='VP8 '&&bytes.length>=30&&bytes.subarray(23,26).equals(Buffer.from([0x9d,1,0x2a])),'Unsupported WebP Header.');width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff;}
 }
 requireThat(width>0&&height>0&&width<=4096&&height<=4096&&width*height<=8*1024*1024,'The Planning Image Dimensions Exceed the Supported Bound.');return {width,height};
}

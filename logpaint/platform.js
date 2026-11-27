import {download} from './export.js';
const native=()=>window.__TAURI__?.core;
export async function saveFile(blob,name){
 if(!native()){download(blob,name);return true;}
 const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});
 return native().invoke('save_file',{name,data});
}
export async function openNative(){
 if(!native())return null;
 const file=await native().invoke('open_file');
 if(!file)return {cancelled:true};
 const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
 return {name:file.name,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
}
export const isDesktop=()=>!!native();

export function rgbToHsv(r,g,b){
 r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360;}
 return [h,max===0?0:d/max*100,max*100];
}
export function hsvToRgb(h,s,v){
 h=((h%360)+360)%360/60;s/=100;v/=100;const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c;
 const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
 return rgb.map(n=>Math.round((n+m)*255));
}
export const rgbToHex=rgb=>'#'+rgb.map(c=>Math.round(c).toString(16).padStart(2,'0')).join('');
export const hexToRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function setupColorPicker(){
 const $=id=>document.getElementById(id),channels={rgb:['r','g','b'],hsv:['h','s','v']};let rgb=hexToRgb($('color').value),hsv=rgbToHsv(...rgb);
 function sync(){const hex=rgbToHex(rgb);$('color').value=hex;$('hex').value=hex;
  for(const [mode,ids] of Object.entries(channels))ids.forEach((id,i)=>{const val=Math.round((mode==='rgb'?rgb:hsv)[i]);$(id).value=val;$(id+'Number').value=val;});
  $('s').style.background=`linear-gradient(to right,#${Math.round(hsv[2]/100*255).toString(16).padStart(2,'0').repeat(3)},${rgbToHex(hsvToRgb(hsv[0],100,hsv[2]))})`;
  $('v').style.background=`linear-gradient(to right,#000,${rgbToHex(hsvToRgb(hsv[0],hsv[1],100))})`;
 }
 function fromHex(hex){rgb=hexToRgb(hex);const next=rgbToHsv(...rgb);if(next[1]===0)next[0]=hsv[0];hsv=next;sync();}
 $('color').addEventListener('input',()=>fromHex($('color').value));
 $('hex').addEventListener('change',()=>{let hex=$('hex').value.trim();if(/^#[0-9a-f]{3}$/i.test(hex))hex='#'+[...hex.slice(1)].map(c=>c+c).join('');if(/^#[0-9a-f]{6}$/i.test(hex))fromHex(hex);else sync();});
 document.querySelectorAll('[data-color]').forEach(button=>button.onclick=()=>fromHex(button.dataset.color));
 for(const [mode,ids] of Object.entries(channels))ids.forEach((id,i)=>{for(const input of [$(id),$(id+'Number')])input.addEventListener('input',()=>{
  if(input.value==='')return;const n=Number(input.value);if(!Number.isFinite(n))return;const max=mode==='rgb'?255:i===0?360:100;
  if(mode==='rgb'){rgb[i]=Math.round(Math.max(0,Math.min(max,n)));const next=rgbToHsv(...rgb);if(next[1]===0)next[0]=hsv[0];hsv=next;}else{hsv[i]=Math.max(0,Math.min(max,n));rgb=hsvToRgb(...hsv);}sync();
 });});
 document.querySelectorAll('[data-color-mode]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-color-mode]').forEach(b=>b.classList.toggle('active',b===button));for(const mode of ['palette','rgb','hsv'])$('color-'+mode).hidden=mode!==button.dataset.colorMode;});sync();
}

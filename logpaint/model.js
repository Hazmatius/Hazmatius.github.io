export const TAU=Math.PI*2;
export const BACKGROUND=[17/255,25/255,20/255,1];
export const MAX_SAMPLES=250000;
// One allocation per 4096 samples, rather than one object per pointer event.
export class Samples {
 constructor(){this.chunks=[];this.length=0;}
 push(x,y,r){if(this.length>=MAX_SAMPLES)throw Error('Sample limit reached. Save this painting before starting another.');const i=this.length++;const chunk=i>>>12,offset=(i&4095)*3;if(!this.chunks[chunk])this.chunks[chunk]=new Float32Array(64*3);if(offset+3>this.chunks[chunk].length){const grown=new Float32Array(Math.min(4096*3,this.chunks[chunk].length*2));grown.set(this.chunks[chunk]);this.chunks[chunk]=grown;}this.chunks[chunk][offset]=x;this.chunks[chunk][offset+1]=y;this.chunks[chunk][offset+2]=r;}
 get(i){return this.chunks[i>>>12].subarray((i&4095)*3,(i&4095)*3+3);}
 toJSON(){return this.chunks.flatMap((chunk,i)=>Array.from(chunk.subarray(0,Math.min(4096,this.length-i*4096)*3)));}
 static from(data){const result=new Samples();for(let i=0;i<data.length;i+=3)result.push(data[i],data[i+1],data[i+2]);return result;}
}
export function canonicalStamp(x,y,r,q,theta){
 const n=Math.floor(Math.log(Math.max(Math.hypot(x,y),1e-20))/Math.log(q));
 const scale=Math.pow(q,-n),a=-n*theta,c=Math.cos(a),s=Math.sin(a);
 return [(x*c-y*s)*scale,(x*s+y*c)*scale,r*scale,a];
}
export function coordinates(x,y,q,theta){const s=Math.log(Math.hypot(x,y))/Math.log(q);return [s-Math.floor(s),((Math.atan2(y,x)-theta*s)/TAU%1+1)%1];}
export function serialize(project){return JSON.stringify({format:'LogPaint',version:project.center?7:project.grid?6:(project.view.angle||project.secondaryView?.angle)?5:project.baseImage?4:project.strokes.some(s=>s.space)?3:project.secondaryView?2:1,...(project.baseImage?{baseImage:project.baseImage}:{}),...(project.grid?{grid:project.grid}:{}),symmetry:{scale:project.scale,rotation:project.rotation,...(project.center?{center:project.center}:{})},view:project.view,...(project.secondaryView?{secondaryView:project.secondaryView,layout:project.layout||'single'}:{}),strokes:project.strokes.map(s=>({shape:s.shape,color:s.color,...(s.space?{space:s.space,...(s.space==='log'?{aspect:s.aspect}:{} )}:{}),samples:s.samples.toJSON()}))});}
export function deserialize(text){
 if(text.length>40_000_000)throw Error('Project exceeds the 40 MB import limit.');
 const d=JSON.parse(text),finite=v=>typeof v==='number'&&Number.isFinite(v);
 if(d.format!=='LogPaint'||![1,2,3,4,5,6,7].includes(d.version))throw Error('Unsupported LogPaint project version.');
 if(!d.symmetry||!finite(d.symmetry.scale)||d.symmetry.scale<1.2||d.symmetry.scale>1024||!finite(d.symmetry.rotation)||Math.abs(d.symmetry.rotation)>Math.PI)throw Error('Invalid symmetry settings.');
 if(d.symmetry.center!==undefined&&(!Array.isArray(d.symmetry.center)||d.symmetry.center.length!==2||!d.symmetry.center.every(v=>finite(v)&&Math.abs(v)<=1e6)))throw Error('Invalid symmetry center.');
 if(!Array.isArray(d.strokes)||d.strokes.length>10000)throw Error('Invalid stroke list.');
 if(d.baseImage!==undefined&&d.baseImage!=='leiden-p4-v1')throw Error('Unknown project base image.');
 if(d.grid!==undefined&&(!d.grid||typeof d.grid.enabled!=='boolean'||!Number.isInteger(d.grid.density)||d.grid.density<2||d.grid.density>16||!finite(d.grid.opacity)||d.grid.opacity<.15||d.grid.opacity>1))throw Error('Invalid grid settings.');
 let count=0;
 for(const s of d.strokes){if(s?.space!==undefined&&!['plane','log','escher'].includes(s.space))throw Error('Invalid stroke coordinate space.');if(s?.space==='log'&&(!finite(s.aspect)||s.aspect<.001||s.aspect>1000))throw Error('Invalid log brush aspect.');}
 for(const s of d.strokes){if(!s||!['circle','square'].includes(s.shape)||!Array.isArray(s.color)||s.color.length!==4||!s.color.every(v=>finite(v)&&v>=0&&v<=1)||!Array.isArray(s.samples)||s.samples.length%3)throw Error('Invalid stroke data.');count+=s.samples.length/3;if(count>MAX_SAMPLES)throw Error('Too many brush samples.');for(let i=0;i<s.samples.length;i++){const v=s.samples[i];if(!finite(v)||Math.abs(v)>1e8||(i%3===2&&v<=0))throw Error('Invalid brush sample.');}}
 const view=d.view;
 for(const camera of [d.view,d.secondaryView])if(camera?.angle!==undefined&&(!finite(camera.angle)||Math.abs(camera.angle)>Math.PI+1e-10))throw Error('Invalid view angle.');
 if(d.layout!==undefined&&!['single','columns','rows'].includes(d.layout))throw Error('Invalid split layout.');
 const second=d.secondaryView;
 if(second&&(!finite(second.zoom)||second.zoom<1e-5||second.zoom>1e5||!Array.isArray(second.pan)||second.pan.length!==2||!second.pan.every(v=>finite(v)&&Math.abs(v)<=1e8)||!['plane','log','escher'].includes(second.mode)))throw Error('Invalid secondary view.');
 if(!view||!finite(view.zoom)||view.zoom<1e-5||view.zoom>1e5||!Array.isArray(view.pan)||view.pan.length!==2||!view.pan.every(v=>finite(v)&&Math.abs(v)<=1e8)||!['plane','log','escher'].includes(view.mode))throw Error('Invalid view.');
 return {...(d.symmetry.center?{center:[...d.symmetry.center]}:{}),...(d.grid?{grid:{enabled:d.grid.enabled,density:d.grid.density,opacity:d.grid.opacity}}:{}),...(d.baseImage?{baseImage:d.baseImage}:{}),...(second?{secondaryView:{zoom:second.zoom,pan:[...second.pan],mode:second.mode,...(second.angle!==undefined?{angle:second.angle}:{})},layout:d.layout||'single'}:{}),scale:d.symmetry.scale,rotation:d.symmetry.rotation,view:{zoom:view.zoom,pan:[...view.pan],mode:view.mode,...(view.angle!==undefined?{angle:view.angle}:{})},strokes:d.strokes.map(s=>({...s,samples:Samples.from(s.samples)}))};
}

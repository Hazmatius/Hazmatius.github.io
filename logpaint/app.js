import {Renderer} from './gpu.js';
import {Samples,TAU,MAX_SAMPLES,serialize,deserialize} from './model.js';
import {encodeExport} from './export.js';
import {saveFile,openNative,isDesktop} from './platform.js';
import {defaultView,paneRects,cameraPoint,brushRadius,zoomAt,panBy} from './views.js';
import {setupColorPicker} from './colors.js';
import {galleryExample} from './examples.js';
import {setupNumericSliders} from './numeric-sliders.js';
import {TouchPan} from './touch-pan.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),preview=$('preview'),previewContext=preview.getContext('2d');
let renderer;
try{renderer=new Renderer(canvas);}catch(e){$('status').textContent=e.message;$('hint').textContent='WebGL 2 is required';throw e;}
const freshProject=()=>({scale:2.5,rotation:0,view:defaultView(),secondaryView:defaultView('escher'),layout:'single',strokes:[]});
let project=freshProject(),activeIndex=0,panTool=false,previewView=defaultView('log');
const viewAt=index=>index===2?previewView:index===0?project.view:(project.secondaryView??=defaultView('escher'));
const paneAt=index=>index===2?{x:0,y:0,width:preview.clientWidth,height:preview.clientHeight}:paneRects(canvas.clientWidth,canvas.clientHeight,project.layout)[index];
function ensureViews(){project.secondaryView??=defaultView('escher');project.layout??='single';activeIndex=0;}
let shape='circle',redo=[],active=null,pointer=null,space=false,queued=false,busy=false,dirty=false,replayID=0,total=0;
const pending=[];const touchPan=new TouchPan();let numericSliders;
const nativeTouchEvents='ontouchstart' in window;
const center=()=>project.center||[0,0];
const degrees=rad=>Math.round(rad*180/Math.PI*100)/100;
function status(text){$('status').textContent=text;}
function update(){
 total=project.strokes.reduce((n,s)=>n+s.samples.length,0);
 $('memory').textContent=`${total.toLocaleString()} samples · ${(total*12/1024).toFixed(0)} KB`;
 $('undo').disabled=busy||!project.strokes.length;$('redo').disabled=busy||!redo.length;
 $('hint').hidden=project.strokes.length>0||!!project.baseImage;$('scale').value=project.scale;
 $('rotation').value=degrees(project.rotation);$('rotationValue').textContent=`${$('rotation').value}°`;
 document.querySelectorAll('#views button').forEach(b=>b.classList.toggle('active',b.dataset.view===project.view.mode));
 const names={plane:'COMPLEX PLANE',log:'LOG-POLAR',escher:'ESCHER'};
 $('canvasLabel').textContent=names[project.view.mode];$('secondLabel').textContent=names[viewAt(1).mode];
 $('canvasLabel').classList.toggle('active',activeIndex===0);$('secondLabel').classList.toggle('active',activeIndex===1);
 const split=project.layout!=='single';$('secondLabel').hidden=$('divider').hidden=!split;
 $('secondLabel').style.left=project.layout==='columns'?'calc(50% + 22px)':'22px';
 $('secondLabel').style.top=project.layout==='rows'?'calc(50% + 20px)':'20px';
 Object.assign($('divider').style,project.layout==='columns'?{left:'calc(50% - 2px)',top:'0',width:'4px',height:'100%'}:{left:'0',top:'calc(50% - 2px)',width:'100%',height:'4px'});
 $('firstAngle').value=degrees(project.view.angle||0);$('firstAngleValue').textContent=`${$('firstAngle').value}°`;$('secondAngle').value=degrees(viewAt(1).angle||0);$('secondAngleValue').textContent=`${$('secondAngle').value}°`;$('secondAngle').disabled=!split;
 $('gridToggle').checked=project.grid?.enabled||false;$('gridDensity').value=project.grid?.density??4;$('gridOpacity').value=Math.round((project.grid?.opacity??.65)*1000)/10;$('gridDensityValue').textContent=$('gridDensity').value;$('gridOpacityValue').textContent=`${$('gridOpacity').value}%`;
 for(const [id,value] of [['centerX',center()[0]],['centerY',center()[1]]])if(document.activeElement!==$(id))$(id).value=value;
 $('formulaValues').textContent=`q = ${project.scale} · θ = ${degrees(project.rotation)}° · c = ${center()[0]} ${center()[1]<0?'−':'+'} ${Math.abs(center()[1])}i`;
 $('layout').value=project.layout;$('secondaryMode').value=viewAt(1).mode;$('secondaryHome').disabled=!split;
 $('activePane').textContent=`Active: ${activeIndex===2?'log strip':activeIndex===0?'first':'second'} view · ${Math.round(viewAt(activeIndex).zoom*100)}%`;
 $('attribution').hidden=!project.baseImage;$('canvas-wrap').classList.toggle('panning',panTool);preview.classList.toggle('active',activeIndex===2);numericSliders?.sync();
}
function frame(){queued=false;
 if(pending.length&&!busy){for(const {stroke,start,end} of pending)renderer.stamp(stroke,start,end,project.scale,project.rotation);pending.length=0;}
 const dpr=Math.min(devicePixelRatio||1,2),rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 if(!$('unwrappedPanel').hidden){
  const pw=Math.min(w,Math.round(preview.clientWidth*dpr)),ph=Math.min(h,Math.round(preview.clientHeight*dpr));
  if(preview.width!==pw||preview.height!==ph){preview.width=pw;preview.height=ph;}
  renderer.draw(pw,ph,previewView,project.scale,project.rotation,'log',null,[0,0],project.grid,center());
  previewContext.drawImage(canvas,0,h-ph,pw,ph,0,0,pw,ph);
 }
 renderer.gl.clearColor(0.09,0.12,0.09,1);renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);
 // Both panes sample the same tile in the same WebGL context; no GPU readback.
 paneRects(w,h,project.layout).forEach((pane,i)=>renderer.draw(pane.width,pane.height,viewAt(i),project.scale,project.rotation,viewAt(i).mode,null,[pane.x,h-pane.y-pane.height],project.grid,center()));
 update();
}
function request(){if(!queued){queued=true;requestAnimationFrame(frame);}}
let paperImage;
async function ensureBase(token){
 const id=project.baseImage||null;if(renderer.baseId===id)return;
 if(id){paperImage??=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Paper image could not be loaded.'));image.src='./assets/leiden-p4.jpg';});
  const image=await paperImage;if(token!==replayID)return;renderer.setBaseImage(image);
 }else renderer.setBaseImage(null);
 renderer.baseId=id;
}
async function replay(){
 const id=++replayID;busy=true;pending.length=0;update();status('Rebuilding tile…');
 try{await ensureBase(id);}catch(e){if(id===replayID){busy=false;status(e.message);request();}return;}if(id!==replayID)return;renderer.clear();
 for(const stroke of project.strokes){for(let i=0;i<stroke.samples.length;i+=128){if(id!==replayID)return;renderer.stamp(stroke,i,Math.min(i+128,stroke.samples.length),project.scale,project.rotation);request();await new Promise(resolve=>setTimeout(resolve,0));}}
 if(id===replayID){busy=false;update();request();status('Ready · symmetry applied');}
}
function eventPane(e,index){
 if(index===2||e.currentTarget===preview){const rect=preview.getBoundingClientRect();return {index:2,view:previewView,pane:paneAt(2),x:e.clientX-rect.left,y:rect.height-(e.clientY-rect.top)};}
 const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,panes=paneRects(rect.width,rect.height,project.layout);
 if(index===undefined)index=panes.findIndex(p=>x>=p.x&&x<=p.x+p.width&&y>=p.y&&y<=p.y+p.height);
 if(index<0)index=activeIndex===2?0:activeIndex;
 const pane=panes[index]||panes[0];
 return {index,view:viewAt(index),pane,x:x-pane.x,y:pane.height-(y-pane.y)};
}
function world(e,index=pointer?.index){const a=eventPane(e,index);const point=cameraPoint(a.x,a.y,a.pane.width,a.pane.height,a.view);return a.view.mode==='log'?point:[point[0]-center()[0],point[1]-center()[1]];}
function radius(point,index=activeIndex){
 const pane=paneAt(index),view=viewAt(index),size=+$('size').value;
 return brushRadius(point,view,pane.width,pane.height,size,$('sizeMode').value,project.scale);
}
function cursor(e){
 const a=eventPane(e),surface=a.index===2?preview:canvas,rect=surface.getBoundingClientRect(),c=$(a.index===2?'previewCursor':'cursor');
 if(panTool||space){c.style.display='none';surface.style.cursor='grab';return;}
 surface.style.cursor='none';const p=world(e,a.index),r=radius(p,a.index),unit=4/(Math.min(a.pane.width,a.pane.height)*a.view.zoom);
 let diameter=a.view.mode==='log'?r*2*a.pane.width*a.view.zoom:r*2/unit;diameter=Math.min(diameter,2000);
 c.style.display='block';c.style.left=`${e.clientX-rect.left}px`;c.style.top=`${e.clientY-rect.top}px`;c.style.width=c.style.height=`${diameter}px`;c.style.borderRadius=shape==='circle'?'50%':'0';c.style.transform=`translate(-50%,-50%) rotate(${-a.view.angle||0}rad)`;
}
function sample(p){
 if(total>=MAX_SAMPLES){finish();status('Sample limit reached. Save your project.');return;}
 const r=radius(p);if(!p.every(Number.isFinite)||p.some(v=>Math.abs(v)>1e8)||!Number.isFinite(r)||r>1e8||r<=0){finish();status('Brush coordinates exceed the project range. Reset or zoom the view.');return;}
 const start=active.samples.length;active.samples.push(...p,r);total++;
 const last=pending.at(-1);if(last?.stroke===active&&last.end===start)last.end++;else pending.push({stroke:active,start,end:start+1});dirty=true;request();
}
function finish(){active=null;pointer=null;touchPan.clear();}
function pointerDown(e){
 if(e.pointerType==='touch'&&panTool){
  // Safari also sends PointerEvents for these contacts. Handle each contact
  // through just one API; touch handlers below explicitly own native gestures.
  if(nativeTouchEvents)return;
  if(busy||pointer)return;e.preventDefault();
  const a=eventPane(e);
  if(touchPan.begin(e.pointerId,{x:a.x,y:a.y},a.index,e.currentTarget)){
   e.currentTarget.setPointerCapture(e.pointerId);activeIndex=a.index;
   $('cursor').style.display='none';$('previewCursor').style.display='none';
   status('Pan · drag with one finger; pinch or move with two fingers');request();
  }
  return;
 }
 if(touchPan.active)return;
 if(busy||pointer||![0,1].includes(e.button))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
 const a=eventPane(e);activeIndex=a.index;
 pointer={id:e.pointerId,index:a.index,x:e.clientX,y:e.clientY,p:world(e,a.index),pan:panTool||space||e.button===1};
 request();if(pointer.pan){status('Pan · drag to move this view');return;}
 const hex=$('color').value;active={shape,space:a.view.mode,...(a.view.mode==='log'?{aspect:a.pane.height/a.pane.width}:{}),color:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat(+$('opacity').value/100),samples:new Samples()};project.strokes.push(active);redo=[];sample(pointer.p);
}
function pointerMove(e){
 if(nativeTouchEvents&&e.pointerType==='touch'&&panTool)return;
 if(touchPan.has(e.pointerId)){
  e.preventDefault();const a=eventPane(e,touchPan.index);
  touchPan.move(e.pointerId,{x:a.x,y:a.y},a.view,a.pane.width,a.pane.height);request();return;
 }
 if(touchPan.active)return;
 cursor(e);if(!pointer||pointer.id!==e.pointerId)return;
 if(pointer.pan){
  const a=eventPane(e,pointer.index),dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  panBy(a.view,dx,-dy,a.pane.width,a.pane.height);
  pointer.x=e.clientX;pointer.y=e.clientY;request();return;
 }
 const coalesced=e.getCoalescedEvents?.(),events=coalesced?.length?coalesced:[e];
 for(const event of events){if(!active)break;const p=world(event),prev=pointer.p,dist=Math.hypot(p[0]-prev[0],(p[1]-prev[1])*(active.aspect||1)),spacing=Math.max(Math.min(radius(p),radius(prev))*.35,1e-9),steps=Math.min(128,Math.max(1,Math.ceil(dist/spacing)));
  for(let i=1;i<=steps&&active;i++)sample([prev[0]+(p[0]-prev[0])*i/steps,prev[1]+(p[1]-prev[1])*i/steps]);if(pointer)pointer.p=p;
 }
}
for(const surface of [canvas,preview]){
 const touchPoint=(e,t,index)=>eventPane({currentTarget:surface,clientX:t.clientX,clientY:t.clientY},index);
 surface.addEventListener('touchstart',e=>{
  if(!panTool)return;
  e.preventDefault();if(busy||pointer)return;
  for(const t of e.changedTouches){
   const a=touchPoint(e,t);
   if(touchPan.begin(`touch:${t.identifier}`,{x:a.x,y:a.y},a.index,surface))activeIndex=a.index;
  }
  $('cursor').style.display='none';$('previewCursor').style.display='none';
  status('Touch pan ready · pinch with two fingers to zoom');request();
 },{passive:false});
 surface.addEventListener('touchmove',e=>{
  if(!panTool)return;e.preventDefault();
  if(touchPan.surface!==surface)return;
  for(const t of e.changedTouches){
   const id=`touch:${t.identifier}`;if(!touchPan.has(id))continue;
   const a=touchPoint(e,t,touchPan.index);
   touchPan.move(id,{x:a.x,y:a.y},a.view,a.pane.width,a.pane.height);
  }
  request();
 },{passive:false});
 for(const type of ['touchend','touchcancel'])surface.addEventListener(type,e=>{
  if(panTool&&e.cancelable)e.preventDefault();
  for(const t of e.changedTouches)touchPan.end(`touch:${t.identifier}`);
 },{passive:false});
 // WebKit's native pinch recognizer can otherwise zoom the containing page.
 for(const type of ['gesturestart','gesturechange','gestureend'])surface.addEventListener(type,e=>{
  if(panTool)e.preventDefault();
 },{passive:false});
 surface.addEventListener('pointerdown',pointerDown);surface.addEventListener('pointermove',pointerMove);
 for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{if(touchPan.has(e.pointerId)){touchPan.end(e.pointerId);return;}if(pointer?.id===e.pointerId)finish();});
 surface.addEventListener('pointerleave',()=>$(surface===preview?'previewCursor':'cursor').style.display='none');
 surface.addEventListener('wheel',e=>{e.preventDefault();const a=eventPane(e);activeIndex=a.index;zoomAt(a.view,a.x,a.y,a.pane.width,a.pane.height,Math.exp(-e.deltaY*.001));request();},{passive:false});
}
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();space=true;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();}});
window.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;finish();});
document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{shape=b.dataset.shape;document.querySelectorAll('[data-shape]').forEach(x=>x.classList.toggle('active',x===b));});
setupColorPicker();
$('size').oninput=$('sizeMode').onchange=()=>{$('sizeValue').textContent=$('sizeMode').value==='screen'?`${$('size').value} px`:`${Math.round(+$('size').value/2*100)/100}% radius`;};
$('opacity').oninput=()=>$('opacityValue').textContent=`${$('opacity').value}%`;
$('scale').onchange=()=>{const q=+$('scale').value;if(!Number.isFinite(q)||q<1.2||q>1024){$('scale').value=project.scale;status('Repeat scale must be between 1.2 and 1024.');return;}finish();project.scale=q;dirty=true;replay();};
$('rotation').oninput=()=>$('rotationValue').textContent=`${$('rotation').value}°`;
$('rotation').onchange=()=>{const next=+$('rotation').value*Math.PI/180;if(Math.abs(next-project.rotation)<1e-12)return;finish();project.rotation=next;dirty=true;replay();};
for(const id of ['centerX','centerY'])$(id).onchange=()=>{const x=$('centerX').valueAsNumber,y=$('centerY').valueAsNumber;if(![x,y].every(Number.isFinite)||Math.abs(x)>1e6||Math.abs(y)>1e6){status('Center coordinates must be finite numbers between −1000000 and 1000000.');$('centerX').value=center()[0];$('centerY').value=center()[1];return;}finish();project.center=[x,y];dirty=true;request();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{finish();activeIndex=0;project.view=defaultView(b.dataset.view);if(b.dataset.view!=='log')project.view.pan=[...center()];dirty=true;request();});
$('home').onclick=()=>{finish();const view=viewAt(activeIndex);view.zoom=1;view.pan=view.mode==='log'?[0,0]:[...center()];view.angle=0;request();status('View centered · zoom and angle reset · painting preserved');};
$('secondaryHome').onclick=()=>{finish();const view=viewAt(1);view.zoom=1;view.pan=view.mode==='log'?[0,0]:[...center()];view.angle=0;request();status('Second view centered · painting preserved');};
for(const id of ['gridToggle','gridDensity','gridOpacity'])$(id).oninput=()=>{project.grid={enabled:$('gridToggle').checked,density:Number($('gridDensity').value),opacity:Number($('gridOpacity').value)/100};dirty=true;request();};
for(const [id,index] of [['firstAngle',0],['secondAngle',1]])$(id).oninput=()=>{finish();viewAt(index).angle=Number($(id).value)*Math.PI/180;activeIndex=index;dirty=true;request();};
$('panTool').onclick=()=>{finish();panTool=!panTool;$('panTool').setAttribute('aria-pressed',String(panTool));request();};
$('layout').onchange=()=>{finish();project.layout=$('layout').value;if(project.layout==='single')activeIndex=0;dirty=true;request();};
$('secondaryMode').onchange=()=>{finish();project.secondaryView=defaultView($('secondaryMode').value);if(project.secondaryView.mode!=='log')project.secondaryView.pan=[...center()];if(project.layout==='single')project.layout='columns';activeIndex=1;dirty=true;request();};
$('undo').onclick=()=>{if(busy||!project.strokes.length)return;finish();redo.push(project.strokes.pop());dirty=true;replay();};
$('redo').onclick=()=>{if(busy||!redo.length)return;finish();project.strokes.push(redo.pop());dirty=true;replay();};
$('new').onclick=()=>{if(dirty&&!confirm('Discard this painting and start a new one?'))return;finish();++replayID;busy=false;project=freshProject();previewView=defaultView('log');activeIndex=0;redo=[];pending.length=0;dirty=false;renderer.baseId=null;renderer.setBaseImage(null);request();status('New painting');};
$('save').onclick=async()=>{finish();try{if(await saveFile(new Blob([serialize(project)],{type:'application/json'}),'Untitled.logpaint')){dirty=false;status('Project saved · editable stroke data preserved');}}catch(e){status(`Save failed: ${e.message}`);}};
$('open').onclick=async()=>{if(!isDesktop()){$('file').click();return;}try{const file=await openNative();if(file.cancelled)return;const next=deserialize(file.text);if(dirty&&!confirm('Replace the current painting with this project?'))return;finish();project=next;ensureViews();redo=[];dirty=false;await replay();status(`Opened ${file.name}`);}catch(e){status(`Open failed: ${e.message}`);}};
$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>40_000_000)throw Error('Project exceeds the 40 MB import limit.');const next=deserialize(await file.text());if(dirty&&!confirm('Replace the current painting with this project?'))return;finish();project=next;ensureViews();redo=[];dirty=false;await replay();status(`Opened ${file.name}`);}catch(e){status(`Open failed: ${e.message}`);}finally{$('file').value='';}};
$('export').onclick=()=>{$('exportDialog').showModal();};
$('download').onclick=async()=>{if(busy){status('Wait for the tile to finish rebuilding.');return;}const w=+$('width').value,h=+$('height').value,dpi=+$('dpi').value,format=$('format').value;if(!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64||w>4096||h>4096||!Number.isInteger(dpi)||dpi<36||dpi>1200){status('Choose integer dimensions from 64–4096 px and DPI from 36–1200.');return;}$('download').disabled=true;status('Rendering export…');await new Promise(requestAnimationFrame);try{frame();const pixels=renderer.exportPixels(w,h,{...project,view:viewAt(activeIndex),exportGrid:$('exportGrid').checked}),blob=await encodeExport(pixels,w,h,format,dpi);if(await saveFile(blob,`LogPaint.${format==='jpeg'?'jpg':format==='tiff'?'tif':format}`)){ $('exportDialog').close();status(`Exported ${w} × ${h} ${format.toUpperCase()}`);}}catch(e){status(`Export failed: ${e.message}`);}finally{$('download').disabled=false;request();}};
$('demo').onclick=()=>{if(busy)return;if(project.strokes.length&&dirty&&!confirm('Replace the current painting with an example pattern?'))return;finish();delete project.baseImage;delete project.center;project.strokes=[];redo=[];project.scale=2.5;project.rotation=.42;project.view=defaultView();project.secondaryView=defaultView('escher');previewView=defaultView('log');activeIndex=0;for(let k=0;k<3;k++){const s={shape:k===1?'square':'circle',color:[[.93,.46,.32,1],[.89,.75,.45,1],[.47,.71,.67,1]][k],samples:new Samples()};for(let i=0;i<90;i++){const a=i/89*1.8+k*TAU/3,r=1.2+.25*Math.sin(i/89*Math.PI);s.samples.push(r*Math.cos(a),r*Math.sin(a),k===1?.035:.055);}project.strokes.push(s);}dirty=true;replay();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();busy=true;status('GPU context lost. Save your project, then reload to restore rendering.');});
canvas.addEventListener('webglcontextrestored',()=>{renderer=new Renderer(canvas);replay();});
numericSliders=setupNumericSliders(status);
for(const id of ['scale','centerX','centerY'])$(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}});
new ResizeObserver(request).observe($('canvas-wrap'));request();
// Small, read-only diagnostics for profiling and browser checks.
window.logpaint={get stats(){return {samples:total,strokeBytes:total*12,tileWidth:renderer.w,tileHeight:renderer.h,gpuError:renderer.gl.getError(),busy,layout:project.layout,activePane:activeIndex};},serialize:()=>serialize(project)};

async function loadGallery(initial=false){
 if(busy)return;
 if(!initial&&dirty&&!confirm('Replace this painting with the gallery example?'))return;
 finish();const sample=galleryExample();project=sample;previewView=defaultView('log');activeIndex=0;redo=[];dirty=false;
 await replay();if(project===sample)status('Gallery study · original example · paint in either pane, or choose New for a blank canvas');
}
$('gallery').onclick=()=>loadGallery();
async function loadPaper(initial=false){
 if(busy)return;
 if(!initial&&dirty&&!confirm('Replace this painting with the paper example?'))return;
 finish();project={...freshProject(),baseImage:'leiden-p4-v1',scale:256,layout:'columns'};const sample=project;
 previewView=defaultView('log');activeIndex=0;redo=[];dirty=false;
 await replay();if(project===sample)status('Paper example · Leiden reconstruction · paint in any view, or choose New for a blank canvas');
}
$('paper').onclick=()=>loadPaper();
if(!new URLSearchParams(location.search).has('blank'))loadPaper(true);

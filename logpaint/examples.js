import {Samples} from './model.js';
import {defaultView} from './views.js';

// Original, editable line drawing: a harbour seen from a gallery, with the
// same gallery inside its central frame. This is an illustration of the
// construction, not a reproduction of Escher's Print Gallery.
export function galleryExample(){
 const strokes=[];
 const colors={paper:'#e8dfc6',ink:'#30494c',water:'#82aaa5',stone:'#c8c7ae',roof:'#ba7459',white:'#f5edd8',shadow:'#718a83',gold:'#bc995c'};
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat(1);
 function brush(color,shape='circle'){
  const value=colors[color]||color,last=strokes.at(-1);
  if(last?._color===value&&last.shape===shape)return last;
  const stroke={space:'plane',shape,color:rgb(value),samples:new Samples(),_color:value};strokes.push(stroke);return stroke;
 }
 function path(points,color='ink',radius=.018,closed=false,shape='circle'){
  const s=brush(color,shape),p=closed?[...points,points[0]]:points;
  for(let k=1;k<p.length;k++){const a=p[k-1],b=p[k],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Math.max(radius*1.2,.012)));
   for(let i=0;i<=steps;i++){const t=i/steps;s.samples.push(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,radius);}
  }
 }
 function rect(x,y,w,h,color){const r=Math.min(w,h)/2;path(w>=h?[[x+r,y+r],[x+w-r,y+r]]:[[x+r,y+r],[x+r,y+h-r]],color,r,false,'square');}
 function outline(x,y,w,h,color='ink',r=.018){path([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],color,r,true,'square');}
 function ellipse(x,y,rx,ry,color,r=.018,start=0,end=Math.PI*2){const p=[];for(let i=0;i<=32;i++){const a=start+(end-start)*i/32;p.push([x+rx*Math.cos(a),y+ry*Math.sin(a)]);}path(p,color,r);}
 // A center-crossing invariant stamp supplies the parchment background.
 brush('paper').samples.push(0,0,1);
 // Keep fills away from the singular center: a center-crossing invariant
 // footprint would flood the whole painting.
 rect(-2.6,-.62,2.26,1.16,'water');rect(.34,-.62,2.26,1.16,'water');
 rect(-.34,.34,.68,.2,'water');rect(-.34,-.62,.68,.28,'water');
 // Harbour skyline: stepped houses, terracotta roofs, windows and a tower.
 const houses=[[-2.45,.52,.54,.96],[-1.89,.52,.62,1.26],[-1.25,.52,.5,.82],[-.73,.52,.62,1.07],[-.09,.52,.55,1.3],[.49,.52,.58,.94],[1.1,.52,.55,1.1],[1.68,.52,.64,.78]];
 for(let i=0;i<houses.length;i++){
  const [x,y,w,h]=houses[i];rect(x,y,w,h,i%2?'white':'stone');outline(x,y,w,h);
  path([[x-.03,y+h],[x+w/2,y+h+.24],[x+w+.03,y+h]],'roof',.055);
  path([[x-.03,y+h],[x+w/2,y+h+.24],[x+w+.03,y+h]],'ink',.017);
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){const wx=x+.1+col*(w-.2)/2,wy=y+.2+row*.37;rect(wx,wy,.085,.16,'shadow');}
  path([[x+.05,y+.03],[x+w-.05,y+.03]],'ink',.025);
 }
 rect(1.87,.51,.28,1.85,'white');outline(1.87,.51,.28,1.85);rect(1.93,1.96,.15,.23,'shadow');
 path([[1.82,2.36],[2.01,2.62],[2.2,2.36]],'roof',.055);
 ellipse(2.01,1.7,.07,.07,'ink',.012);
 // Ripples, sailing boats and a promenade make the scene readable at a glance.
 for(let j=0;j<5;j++)for(let k=0;k<4;k++){const x=-2.3+k*1.25+(j%2)*.16,y=-.48+j*.16;path([[x,y],[x+.48,y+.015]],'white',.012);}
 for(const [x,y,scale] of [[-1.4,.03,.7],[1.25,-.06,.85]]){
  path([[x-.3*scale,y],[x+.3*scale,y],[x+.2*scale,y-.12*scale],[x-.22*scale,y-.12*scale]],'ink',.025,true);
  path([[x,y],[x,y+.5*scale],[x+.25*scale,y+.05*scale]],'white',.035);
  path([[x,y],[x,y+.5*scale]],'ink',.012);
 }
 // The gallery foreground encloses the picture, with a tiled perspective floor.
 rect(-2.6,-2.55,5.2,1.82,'stone');
 path([[-2.6,-.72],[2.6,-.72]],'ink',.035);
 for(let i=-4;i<=4;i++)path([[i*.28,-.72],[i*.9,-2.55]],'shadow',.015);
 for(const y of [-1.02,-1.46,-2.1])path([[-2.6,y],[2.6,y]],'shadow',.016);
 rect(-2.6,-.7,.24,3.4,'paper');rect(2.36,-.7,.24,3.4,'paper');
 path([[-2.32,-.72],[-2.32,2.08]],'ink',.035);path([[2.32,-.72],[2.32,2.08]],'ink',.035);
 ellipse(0,1.98,2.32,.7,'ink',.04,0,Math.PI);
 ellipse(0,1.98,2.12,.54,'gold',.028,0,Math.PI);
 // Side-wall pictures.
 for(const x of [-2.08,1.66]){rect(x,-.55,.42,.55,'paper');outline(x,-.55,.42,.55,'gold',.035);path([[x+.05,-.39],[x+.18,-.2],[x+.34,-.38]],'ink',.014);}
 // A visitor, looking toward the self-containing picture at the origin.
 rect(.98,-1.4,.3,.56,'ink');ellipse(1.13,-.68,.13,.16,'ink',.08);
 path([[1.0,-1.3],[.91,-1.92]],'ink',.055);path([[1.23,-1.3],[1.32,-1.92]],'ink',.055);
 path([[1.02,-.91],[.78,-1.15]],'ink',.05);path([[1.27,-.91],[1.39,-1.23]],'ink',.05);
 path([[.83,-1.95],[1.0,-1.95]],'ink',.035);path([[1.26,-1.95],[1.43,-1.95]],'ink',.035);
 // q=8 makes the recursive frame big enough to understand without zooming.
 // The whole scene repeats inside this frame without an embedded bitmap.
 outline(-.34,-.34,.68,.68,'gold',.04);outline(-.3,-.3,.6,.6,'ink',.016);
 for(const s of strokes)delete s._color;
 return {scale:8,rotation:0,view:{...defaultView(),zoom:.72},secondaryView:{...defaultView('escher'),zoom:.72},layout:'columns',strokes};
}

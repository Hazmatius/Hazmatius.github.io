import {TAU} from './model.js';

export const defaultView=(mode='plane')=>({zoom:1,pan:[0,0],mode,angle:0});
// Pullback of exp(alpha * log(z)), alpha = 2pi*i / (log(q)+i*theta+2pi*i).
// A turn around the destination advances by one source repeat and one turn.
export function escherInverse(q,theta){return [1+theta/TAU,-Math.log(q)/TAU];}
export function sourceLog(u,v,q,theta){const [a,b]=escherInverse(q,theta);return [a*u-b*v,b*u+a*v];}
export function paneRects(width,height,layout){
 if(layout==='columns'){const w=Math.floor((width-4)/2);return [{x:0,y:0,width:w,height},{x:w+4,y:0,width:width-w-4,height}];}
 if(layout==='rows'){const h=Math.floor((height-4)/2);return [{x:0,y:0,width,height:h},{x:0,y:h+4,width,height:height-h-4}];}
 return [{x:0,y:0,width,height}];
}
// Coordinates in each camera's own space. y grows upwards.
export function cameraPoint(x,y,width,height,view){
 const a=view.angle||0,c=Math.cos(a),s=Math.sin(a),dx=x-width/2,dy=y-height/2;
 const rx=c*dx+s*dy,ry=-s*dx+c*dy;
 if(view.mode==='log')return [.5+rx/(width*view.zoom)+view.pan[0],.5+ry/(height*view.zoom)+view.pan[1]];
 const unit=4/(Math.min(width,height)*view.zoom);
 return [rx*unit+view.pan[0],ry*unit+view.pan[1]];
}
export function brushPoint(point,view,q,theta){
 if(view.mode==='log'){const [s,t]=point,r=q**s,a=t*TAU+s*theta;return [r*Math.cos(a),r*Math.sin(a)];}
 if(view.mode==='escher'){const [u,v]=sourceLog(Math.log(Math.max(Math.hypot(...point),1e-20)),Math.atan2(point[1],point[0]),q,theta);return [Math.exp(u)*Math.cos(v),Math.exp(u)*Math.sin(v)];}
 return point;
}
export function zoomAt(view,x,y,width,height,factor){
 const before=cameraPoint(x,y,width,height,view);
 view.zoom=Math.max(1e-5,Math.min(1e5,view.zoom*factor));
 const after=cameraPoint(x,y,width,height,view);
 view.pan[0]+=before[0]-after[0];view.pan[1]+=before[1]-after[1];
}

// The source lattice becomes another scale/rotation lattice in Escher space.
// This lets brush footprints be tested exactly in their authored view, on GPU.
export function brushOrbit(space,q,theta){
 const period=Math.log(q);
 if(space!=='escher')return {period,twist:theta,forward:[1,0]};
 const [a,b]=escherInverse(q,theta),norm=a*a+b*b;
 const re=a/norm,im=-b/norm;
 return {period:re*period-im*theta,twist:im*period+re*theta,forward:[re,im]};
}
export function brushRadius(point,view,width,height,size,mode,q){
 if(view.mode==='log')return mode==='radial'?Math.log1p(size/200)/Math.log(q):size/(2*width*view.zoom);
 return mode==='radial'?Math.max(Math.hypot(...point),1e-8)*size/200:size*2/(Math.min(width,height)*view.zoom);
}

export function panBy(view,dx,dy,width,height){
 const before=cameraPoint(width/2,height/2,width,height,view),after=cameraPoint(width/2+dx,height/2+dy,width,height,view);
 view.pan[0]-=after[0]-before[0];view.pan[1]-=after[1]-before[1];
}

import {cameraPoint,panBy} from './views.js';

const midpoint=points=>({x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2,distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)});

export function pinchBetween(view,before,after,width,height){
 const anchor=cameraPoint(before.x,before.y,width,height,view);
 const factor=before.distance>=4&&after.distance>=4?after.distance/before.distance:1;
 view.zoom=Math.max(1e-5,Math.min(1e5,view.zoom*factor));
 const moved=cameraPoint(after.x,after.y,width,height,view);
 view.pan[0]+=anchor[0]-moved[0];view.pan[1]+=anchor[1]-moved[1];
}

// One session stays on the pane where its first finger landed. No per-frame
// timers or paint samples are needed; updates reuse the existing render queue.
export class TouchPan {
 constructor(){this.clear();}
 clear(){this.points=new Map();this.index=null;this.surface=null;}
 has(id){return this.points.has(id);}
 get active(){return this.points.size>0;}
 begin(id,point,index,surface){
  if(this.active&&(this.index!==index||this.surface!==surface||this.points.size>=2))return false;
  if(!this.active){this.index=index;this.surface=surface;}
  this.points.set(id,point);return true;
 }
 move(id,point,view,width,height){
  if(!this.has(id))return false;
  const old=this.points.get(id);
  if(this.points.size===1){panBy(view,point.x-old.x,point.y-old.y,width,height);this.points.set(id,point);}
  else{const before=midpoint([...this.points.values()]);this.points.set(id,point);pinchBetween(view,before,midpoint([...this.points.values()]),width,height);}
  return true;
 }
 end(id){this.points.delete(id);if(!this.active)this.clear();}
}

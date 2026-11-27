import {canonicalStamp,BACKGROUND} from './model.js';
import {escherInverse,brushOrbit} from './views.js';
const VERT=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
const BRUSH=`#version 300 es
precision highp float;
in vec2 uv;out vec4 result;
uniform sampler2D source;uniform float period,twist;uniform vec2 tileSize;uniform int count,shape;uniform vec4 stamps[8];uniform vec4 pigment;uniform int brushSpace;uniform vec2 orbit,forward;uniform float aspect;
const float TAU=6.28318530718;
void main(){
 vec4 old=textureLod(source,uv,0.);
 float u=uv.x*period,v=TAU*uv.y+uv.x*twist;
 if(brushSpace==2){float nextU=forward.x*u-forward.y*v;v=forward.y*u+forward.x*v;u=nextU;}
 float r=exp(u),ang=v;
 vec2 p=r*vec2(cos(ang),sin(ang));
 for(int j=0;j<8;j++){if(j>=count)break;
  vec4 b=stamps[j];
  if(brushSpace==1){
   vec2 delta=fract(uv-b.xy+.5)-.5;delta.y*=aspect;
   float distance=shape==1?max(abs(delta.x),abs(delta.y)):length(delta);
   float edge=max(.5*(1./tileSize.x+aspect/tileSize.y),b.z*.002);
   float coverage=1.-smoothstep(b.z-edge,b.z+edge,distance);
   old=vec4(mix(old.rgb,pigment.rgb,pigment.a*coverage),1.);continue;
  }
  float center=length(b.xy),bound=b.z*(shape==1?1.414214:1.);
  float hi=floor(log(max((center+bound)/r,1e-30))/orbit.x);
  float lo=ceil(log(max((center-bound)/r,1e-30))/orbit.x);
  float coverage=0.;
  // At most 64 relevant scale levels, bounded independently of zoom.
  for(int i=0;i<64;i++){float n=hi-float(i);if(n<lo)break;
   float a=n*orbit.y;vec2 z=exp(n*orbit.x)*mat2(cos(a),sin(a),-sin(a),cos(a))*p-b.xy;
   float c=cos(b.w),s=sin(b.w);z=mat2(c,-s,s,c)*z;
   float distance=shape==1?max(abs(z.x),abs(z.y)):length(z);
   float edge=max(exp(n*orbit.x)*r*length(forward)*(period/tileSize.x+(TAU+abs(twist))/tileSize.y)*.5,b.z*.002);
   coverage=max(coverage,1.-smoothstep(b.z-edge,b.z+edge,distance));
   if(coverage>.999)break;
  }
  old=vec4(mix(old.rgb,pigment.rgb,pigment.a*coverage),1.);
 }
 result=old;
}`;
const VIEW=`#version 300 es
precision highp float;
in vec2 uv;out vec4 result;
uniform sampler2D source;uniform vec2 resolution,origin,pan,warp;uniform float zoom,period,twist,viewAngle;uniform int mode;uniform bool gridEnabled;uniform float gridDensity,gridOpacity;
const float TAU=6.28318530718;
vec3 sampleLog(float u,float v,vec2 dx,vec2 dy){
 float s=u/period,t=(v-s*twist)/TAU;
 vec2 tx=vec2(dx.x/period,(dx.y-twist*dx.x/period)/TAU),ty=vec2(dy.x/period,(dy.y-twist*dy.x/period)/TAU);
 vec3 color=textureGrad(source,vec2(s,t),tx,ty).rgb;
 if(!gridEnabled)return color;
 // A dyadic Cartesian quadtree: each square shell meets the next at
 // an existing grid line, so complete cells subdivide into four squares.
 vec2 direction=vec2(cos(v),sin(v));
 float squareLogRadius=u+log(max(max(abs(direction.x),abs(direction.y)),1e-20));
 float step=log(2.),k=floor(squareLogRadius/step);
 float radius=exp(u-k*step);
 vec2 point=radius*direction;
 vec2 tangent=vec2(-direction.y,direction.x);
 vec2 gx=gridDensity*radius*(direction*dx.x+tangent*dx.y),gy=gridDensity*radius*(direction*dy.x+tangent*dy.y);
 vec2 width=max(vec2(length(vec2(gx.x,gy.x)),length(vec2(gx.y,gy.y))),vec2(1e-6));
 vec2 distance=abs(fract(point*gridDensity+.5)-.5)/width;
 vec2 fade=vec2(1.)-smoothstep(vec2(.35),vec2(.9),width);
 vec2 lines=(vec2(1.)-smoothstep(vec2(.45),vec2(1.25),distance))*fade;
 vec2 halos=(vec2(1.)-smoothstep(vec2(1.1),vec2(2.2),distance))*fade;
 color=mix(color,vec3(.025,.07,.085),max(halos.x,halos.y)*gridOpacity*.6);
 return mix(color,vec3(.32,.83,.95),max(lines.x,lines.y)*gridOpacity);
}
vec3 samplePoint(vec2 z,vec2 dx,vec2 dy){
 float rr=max(dot(z,z),1e-30),u=.5*log(rr),v=atan(z.y,z.x);
 vec2 du=z/rr,dv=vec2(-z.y,z.x)/rr;
 if(mode==2){float nextU=warp.x*u-warp.y*v;v=warp.y*u+warp.x*v;u=nextU;
  vec2 nextDu=warp.x*du-warp.y*dv;dv=warp.y*du+warp.x*dv;du=nextDu;}
 return sampleLog(u,v,vec2(dot(du,dx),dot(dv,dx)),vec2(dot(du,dy),dot(dv,dy)));
}
void main(){
 float c=cos(viewAngle),s=sin(viewAngle);mat2 rotation=mat2(c,-s,s,c);
 vec2 local=rotation*(gl_FragCoord.xy-origin-resolution*.5);
 if(mode==1){vec2 tile=local/(resolution*zoom)+.5+pan;vec2 tx=vec2(c/resolution.x,-s/resolution.y)/zoom,ty=vec2(s/resolution.x,c/resolution.y)/zoom;result=vec4(sampleLog(tile.x*period,tile.y*TAU+tile.x*twist,vec2(tx.x*period,tx.y*TAU+tx.x*twist),vec2(ty.x*period,ty.y*TAU+ty.x*twist)),1);return;}
 float unit=4./(min(resolution.x,resolution.y)*zoom);
 vec2 z=local*unit+pan;
 vec3 color=samplePoint(z,rotation*vec2(unit,0),rotation*vec2(0,unit));
 if(abs(z.x)<=unit*.5&&abs(z.y)<=unit*.5){
  color=vec3(0);for(int y=0;y<8;y++)for(int x=0;x<8;x++){
   vec2 point=rotation*(((vec2(float(x),float(y))+.5)/8.-.5)*resolution*unit)+pan;
   color+=samplePoint(point,vec2(resolution.x*unit/8.,0),vec2(0,resolution.y*unit/8.))/64.;
  }
 }
 result=vec4(color,1);
}`;
export class Renderer {
 constructor(canvas,tileWidth=1024,tileHeight=512){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!this.gl)throw Error('LogPaint requires WebGL 2. Enable hardware acceleration or try another browser.');
  const g=this.gl;this.w=tileWidth;this.h=tileHeight;this.brush=this.program(BRUSH);this.view=this.program(VIEW);this.fbo=g.createFramebuffer();this.current=0;this.dirty=true;const anisotropy=g.getExtension('EXT_texture_filter_anisotropic');
  this.textures=[0,1].map(()=>{const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texStorage2D(g.TEXTURE_2D,Math.floor(Math.log2(Math.max(this.w,this.h)))+1,g.RGBA8,this.w,this.h);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);if(anisotropy)g.texParameterf(g.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,g.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));return t;});this.clear();
 }
 program(fragment){const g=this.gl;const compile=(type,code)=>{const s=g.createShader(type);g.shaderSource(s,code);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};const p=g.createProgram(),v=compile(g.VERTEX_SHADER,VERT),f=compile(g.FRAGMENT_SHADER,fragment);g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));g.deleteShader(v);g.deleteShader(f);return {p,locations:new Map()};}
 location(program,key){if(!program.locations.has(key))program.locations.set(key,this.gl.getUniformLocation(program.p,key));return program.locations.get(key);}
 setBaseImage(image){
  this.baseCanvas=null;
  if(image){const canvas=document.createElement('canvas');canvas.width=this.w;canvas.height=this.h;
   // The published illustration shows repeated periods. Its vertical period
   // is ~310 px; the horizontal period follows log(256)/(2*pi).
   canvas.getContext('2d').drawImage(image,50,38.75,310*Math.log(256)/(Math.PI*2),310,0,0,this.w,this.h);this.baseCanvas=canvas;}
  this.clear();
 }
 clear(){const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,this.fbo);for(const t of this.textures){g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('GPU painting framebuffer is unavailable.');g.clearColor(...BACKGROUND);g.clear(g.COLOR_BUFFER_BIT);if(this.baseCanvas){g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,this.baseCanvas);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);}}g.bindFramebuffer(g.FRAMEBUFFER,null);this.dirty=true;}
 stamp(stroke,start,end,q,theta){
  const g=this.gl,p=this.brush,space=stroke.space||'plane',orbit=brushOrbit(space,q,theta);g.useProgram(p.p);g.uniform1i(this.location(p,'brushSpace'),space==='log'?1:space==='escher'?2:0);g.uniform2f(this.location(p,'orbit'),orbit.period,orbit.twist);g.uniform2fv(this.location(p,'forward'),orbit.forward);g.uniform1f(this.location(p,'aspect'),stroke.aspect||1);g.uniform2f(this.location(p,'tileSize'),this.w,this.h);g.uniform1f(this.location(p,'period'),Math.log(q));g.uniform1f(this.location(p,'twist'),theta);g.uniform1i(this.location(p,'shape'),stroke.shape==='square'?1:0);g.uniform4fv(this.location(p,'pigment'),stroke.color);g.uniform1i(this.location(p,'source'),0);g.activeTexture(g.TEXTURE0);g.viewport(0,0,this.w,this.h);g.bindFramebuffer(g.FRAMEBUFFER,this.fbo);
  for(let offset=start;offset<end;offset+=8){const n=Math.min(8,end-offset),data=new Float32Array(32);for(let j=0;j<n;j++){const [x,y,r]=stroke.samples.get(offset+j);data.set(space==='log'?[x-Math.floor(x),y-Math.floor(y),r,0]:canonicalStamp(x,y,r,Math.exp(orbit.period),orbit.twist),j*4);}g.uniform1i(this.location(p,'count'),n);g.uniform4fv(this.location(p,'stamps[0]'),data);g.bindTexture(g.TEXTURE_2D,this.textures[this.current]);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.textures[1-this.current],0);g.drawArrays(g.TRIANGLES,0,3);this.current=1-this.current;}
  g.bindFramebuffer(g.FRAMEBUFFER,null);this.dirty=true;
 }
 draw(width,height,view,q,theta,mode=view.mode,target=null,origin=[0,0],grid=null,center=[0,0]){
  const g=this.gl,p=this.view;g.useProgram(p.p);g.uniform1i(this.location(p,'gridEnabled'),grid?.enabled?1:0);g.uniform1f(this.location(p,'gridDensity'),grid?.density??4);g.uniform1f(this.location(p,'gridOpacity'),grid?.opacity??.65);g.bindTexture(g.TEXTURE_2D,this.textures[this.current]);if(this.dirty){g.generateMipmap(g.TEXTURE_2D);this.dirty=false;}g.bindFramebuffer(g.FRAMEBUFFER,target);g.viewport(origin[0],origin[1],width,height);g.useProgram(p.p);g.uniform2fv(this.location(p,'origin'),origin);g.uniform2fv(this.location(p,'warp'),escherInverse(q,theta));g.uniform1i(this.location(p,'source'),0);g.uniform2f(this.location(p,'resolution'),width,height);g.uniform2fv(this.location(p,'pan'),mode==='log'?view.pan:[view.pan[0]-center[0],view.pan[1]-center[1]]);g.uniform1f(this.location(p,'zoom'),view.zoom);g.uniform1f(this.location(p,'viewAngle'),view.angle||0);g.uniform1f(this.location(p,'period'),Math.log(q));g.uniform1f(this.location(p,'twist'),theta);g.uniform1i(this.location(p,'mode'),mode==='log'?1:mode==='escher'?2:0);g.drawArrays(g.TRIANGLES,0,3);
 }
 exportPixels(width,height,project){
  const g=this.gl;if(width>g.getParameter(g.MAX_TEXTURE_SIZE)||height>g.getParameter(g.MAX_TEXTURE_SIZE))throw Error('Export exceeds this GPU’s texture limit.');
  const t=g.createTexture(),f=g.createFramebuffer();try{g.bindTexture(g.TEXTURE_2D,t);g.texStorage2D(g.TEXTURE_2D,1,g.RGBA8,width,height);g.bindFramebuffer(g.FRAMEBUFFER,f);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Export framebuffer allocation failed.');this.draw(width,height,project.view,project.scale,project.rotation,project.view.mode,f,[0,0],project.exportGrid?project.grid:null,project.center||[0,0]);const raw=new Uint8Array(width*height*4),pixels=new Uint8ClampedArray(raw.length);g.readPixels(0,0,width,height,g.RGBA,g.UNSIGNED_BYTE,raw);for(let y=0;y<height;y++)pixels.set(raw.subarray(y*width*4,(y+1)*width*4),(height-1-y)*width*4);return pixels;}finally{g.bindFramebuffer(g.FRAMEBUFFER,null);g.deleteFramebuffer(f);g.deleteTexture(t);}
 }
 destroy(){const g=this.gl;this.textures.forEach(t=>g.deleteTexture(t));g.deleteFramebuffer(this.fbo);g.deleteProgram(this.brush.p);g.deleteProgram(this.view.p);}
}

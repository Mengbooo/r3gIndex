import { stickers as stickerCollection } from '../data/site';
export async function initializeStickers(board){
 const abort=new AbortController();
 const listen=(target,type,listener,options={})=>target.addEventListener(type,listener,{...options,signal:abort.signal});
 const canvas=board.querySelector('.sticker-canvas');
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
 if(!gl)return;
const derivatives=gl.getExtension('OES_standard_derivatives');
const vertex=`
precision highp float;
attribute vec2 aUV;
uniform vec2 uResolution,uCenter,uSize,uGrab,uAxis,uTilt;
uniform float uProgress,uAngle,uShadow,uTime;
varying vec2 vUV;
varying vec3 vPosition;
varying float vLift;
void main(){
 vUV=aUV;
 // A travelling ramp starts at the grab point and crosses the paper.
 float distanceAlong=clamp(abs(dot(aUV-uGrab,uAxis)/max(dot(uAxis,uAxis),.02)),0.,1.);
 float head=uProgress*1.65;
 float lift=1.-smoothstep(head-.65,head,distanceAlong);
 if(uProgress<.0001)lift=0.;
 vLift=lift;
 vec2 direction=normalize(uAxis);
 vec2 local=(aUV-.5)*uSize;
 // Scale the entire sheet uniformly; dragging never stretches an anchored edge.
 local*=1.+smoothstep(0.,1.,uProgress)*.20;
 local-=direction*lift*min(uSize.x,uSize.y)*.065;
 float height=lift*min(uSize.x,uSize.y)*.24;
 height+=sin(lift*3.14159265)*min(uSize.x,uSize.y)*.055;
 height+=dot(aUV-.5,uTilt)*uProgress*min(uSize.x,uSize.y)*.12;
 float c=cos(uAngle),s=sin(uAngle);
 vec2 position=uCenter+mat2(c,s,-s,c)*local;
 if(uShadow>.5){position+=vec2(1.5,2.)+vec2(9.,16.)*lift;height=0.;}
 vPosition=vec3(position,height);
 // A shallow perspective makes the lift legible without turning into a page flip.
 float perspective=950./(950.-height);
 vec2 screen=uCenter+(position-uCenter)*perspective;
 gl_Position=vec4(screen.x/uResolution.x*2.-1.,1.-screen.y/uResolution.y*2.,0.,1.);
}`;
const fragment=`
${derivatives?'#extension GL_OES_standard_derivatives : enable':''}
precision highp float;
uniform sampler2D uArt,uSoftShadow;
uniform float uProgress,uShadow,uTime,uHolo,uPulse;
varying vec2 vUV;
varying vec3 vPosition;
varying float vLift;
void main(){
 vec4 tex=texture2D(uArt,vUV);
 if(uShadow>.5){
  float contact=texture2D(uArt,vUV-vec2(.002,.004)).a;
  float soft=texture2D(uSoftShadow,vUV).a;
  float alpha=mix(contact*.13,soft*.30,smoothstep(0.,.4,uProgress));
  gl_FragColor=vec4(.02,.025,.04,alpha);return;
 }
 if(tex.a<.008)discard;
 vec3 normal=vec3(0.,0.,1.);
 ${derivatives?'normal=normalize(cross(dFdx(vPosition),dFdy(vPosition))); if(normal.z<0.)normal=-normal;':''}
 float bend=length(normal.xy);
 float activity=sin(clamp(uProgress,0.,1.)*3.14159265);
 // A global lift mask illuminates the whole opaque sticker, including flat areas.
 float surface=smoothstep(0.,.65,uProgress);
 float phase=vUV.x*1.2+vUV.y*.65+normal.x*.25+normal.y*.30+uTime*.20+uProgress*.75;
 vec3 foil=.55+.45*cos(6.2831853*(phase+vec3(0.,.34,.67)));
 // Broad travelling reflections supplement an all-over iridescent layer.
 float streak=smoothstep(.25,.95,.5+.5*sin(phase*5.8));
 float shimmer=clamp((.30*surface+.10*activity+.035*bend)*uHolo,0.,.60);
 vec3 color=tex.rgb*(1.-.18*bend);
 color=mix(color,foil,shimmer);
 color+=vec3(1.,.98,.95)*streak*(.10*surface+.08*activity+.05*bend)*uHolo;
 float pulse=pow(max(0.,1.-abs(vUV.x-uPulse)*4.),5.);
 color+=pulse*.10*step(0.,uPulse)*uHolo;
 gl_FragColor=vec4(color,tex.a);
}`;
function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;}
const program=gl.createProgram(),vertexShader=compile(gl.VERTEX_SHADER,vertex),fragmentShader=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vertexShader);gl.attachShader(program,fragmentShader);gl.linkProgram(program);gl.deleteShader(vertexShader);gl.deleteShader(fragmentShader);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const uniforms={};for(const key of ['Resolution','Center','Size','Grab','Axis','Tilt','Progress','Angle','Shadow','Time','Holo','Pulse','Art','SoftShadow'])uniforms[key]=gl.getUniformLocation(program,'u'+key);
const grid=64,vertices=[],indices=[];for(let y=0;y<=grid;y++)for(let x=0;x<=grid;x++)vertices.push(x/grid,y/grid);for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const i=y*(grid+1)+x;indices.push(i,i+1,i+grid+1,i+1,i+grid+2,i+grid+1);}
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'aUV');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1i(uniforms.Art,0);gl.uniform1i(uniforms.SoftShadow,1);
function art(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.lineJoin='round';x.lineCap='round';draw(x,w,h);return c;}

const collection=stickerCollection.map(({file,name})=>[file,name]);
async function loadSticker(file){
 const image=new Image();
 image.src=`/assets/stickers/${file}.webp`;
 await image.decode();
 // Trim the generated transparent margins while keeping room for the soft shadow.
 const source=art(image.width,image.height,x=>x.drawImage(image,0,0));
 const data=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
 let left=source.width,top=source.height,right=0,bottom=0;
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  if(data[(y*source.width+x)*4+3]>12){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 }
 const padding=Math.ceil(Math.max(right-left,bottom-top)*.045);
 left=Math.max(0,left-padding);top=Math.max(0,top-padding);
 right=Math.min(source.width,right+padding+1);bottom=Math.min(source.height,bottom+padding+1);
 const w=right-left,h=bottom-top,scale=Math.min(1,1536/Math.max(w,h));
 return art(Math.round(w*scale),Math.round(h*scale),(x,cw,ch)=>x.drawImage(source,left,top,w,h,0,0,cw,ch));
}

const artwork=await Promise.all(collection.map(([file])=>loadSticker(file)));
function texture(source){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function shadow(source){const black=art(source.width,source.height,(x,w,h)=>{x.drawImage(source,0,0);x.globalCompositeOperation='source-in';x.fillStyle='#000';x.fillRect(0,0,w,h);});return art(source.width,source.height,(x)=>{x.filter='blur(15px)';x.drawImage(black,0,0);});}

const names=collection.map(([,name])=>name);
const stickers=artwork.map((c,i)=>({name:names[i],art:texture(c),shadow:texture(shadow(c)),pixels:c.getContext('2d').getImageData(0,0,c.width,c.height),ratio:c.width/c.height,x:0,y:0,w:0,h:0,angle:0,baseAngle:0,progress:0,startProgress:0,target:0,changed:0,phase:'idle',grab:[.2,.2],axis:[.8,.8],tilt:[0,0],vx:0,vy:0,pulse:-1,holo:1}));

// Sticker centres live in document coordinates. Only this viewport-sized layer
// renders them, so a long page never needs a page-sized WebGL texture.
const layer=document.createElement('div');layer.className='sticker-layer';
canvas.classList.add('sticker-global-canvas');layer.append(canvas);document.body.append(layer);
let width=0,height=0,active=null,pointer=null,order=[...stickers],keyActive=null,previousTime=performance.now();
let frame=0;
const placementStart=document.querySelector('#intro .introduction')||board;
const placementEnd=document.querySelector('footer#contact')||board.closest('.information-panel')||board;
let placementBounds={left:0,right:0,top:0,bottom:0};
const motion=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motion.matches;
const status=board.querySelector('.sticker-status');
const plans=[[.24,.43,330,-.14],[.47,.22,270,.12],[.72,.46,365,.08],[.30,.76,335,-.14],[.74,.77,285,.12]];
function setStatus(value){if(status.textContent!==value)status.textContent=value;}
function pageHeight(){return document.documentElement.scrollHeight;}
function measurePlacementBounds(){
 const start=placementStart.getBoundingClientRect(),end=placementEnd.getBoundingClientRect();
 placementBounds={left:Math.max(start.left,end.left)+scrollX,right:Math.min(start.right,end.right)+scrollX,top:start.top+scrollY,bottom:end.bottom+scrollY};
}
function clampPosition(s){
 // Keep the complete resting sheet, including its rotation, inside the paper.
 const {left,right,top,bottom}=placementBounds;
 const c=Math.abs(Math.cos(s.angle)),n=Math.abs(Math.sin(s.angle));
 const marginX=Math.min((s.w*c+s.h*n)*.5+12,(right-left)*.5);
 const marginY=Math.min((s.h*c+s.w*n)*.5+12,(bottom-top)*.5);
 s.x=Math.max(left+marginX,Math.min(right-marginX,s.x));
 s.y=Math.max(top+marginY,Math.min(bottom-marginY,s.y));
}
// A convex alpha outline keeps transparent corners from blocking page controls.
function silhouette(pixels){
 const {width:w,height:h,data}=pixels,points=[],step=Math.max(1,Math.floor(h/96));
 for(let y=0;y<h;y+=step){
  let left=0,right=w-1;
  while(left<w&&data[(y*w+left)*4+3]<55)left++;
  while(right>=left&&data[(y*w+right)*4+3]<55)right--;
  if(left<=right)points.push([left/w*100,y/h*100],[right/w*100,y/h*100]);
 }
 if(points.length<3)return 'none';
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lower=[],upper=[];
 for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of [...points].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 return `polygon(${lower.slice(0,-1).concat(upper.slice(0,-1)).map(p=>p.map(v=>v.toFixed(2)+'%').join(' ')).join(',')})`;
}
for(const s of stickers){
 s.placed=false;
 s.targetElement=document.createElement('div');s.targetElement.className='sticker-hit-target';
 s.targetElement.setAttribute('aria-hidden','true');s.targetElement.style.clipPath=silhouette(s.pixels);
 layer.append(s.targetElement);
}
function onScreen(s){const y=s.y-scrollY;return y+s.h>0&&y-s.h<height;}
function syncTargets(){
 // Clip the lifted mesh and shadow to the region from the introduction through the footer.
 const {left,right,top,bottom}=placementBounds;
 const insetTop=Math.max(0,Math.min(height,top-scrollY));
 const insetBottom=Math.max(0,Math.min(height,height-bottom+scrollY));
 layer.style.clipPath=`inset(${insetTop}px ${Math.max(0,width-right+scrollX)}px ${insetBottom}px ${Math.max(0,left-scrollX)}px)`;
 order.forEach((s,i)=>{
  const el=s.targetElement;
  el.style.width=s.w+'px';el.style.height=s.h+'px';
  el.style.left=(s.x-scrollX)+'px';el.style.top=(s.y-scrollY)+'px';el.style.zIndex=i+1;
  el.style.transform=`translate(-50%,-50%) rotate(${s.angle}rad) scale(${1+s.progress*.20})`;
  el.style.visibility=onScreen(s)?'visible':'hidden';
 });
}
function layout(){
 const previousWidth=width; width=document.documentElement.clientWidth;height=innerHeight;
 const dpr=Math.min(devicePixelRatio||1,2.5);
 const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(uniforms.Resolution,width,height);
 measurePlacementBounds();
 const rect=board.getBoundingClientRect(),scale=Math.min(rect.width/1260,rect.height/980);
 stickers.forEach((s,i)=>{
  const p=plans[i];s.w=p[2]*scale;s.h=s.w/s.ratio;
  if(!s.placed&&s!==active&&s!==keyActive){s.x=rect.left+scrollX+rect.width*p[0];s.y=rect.top+scrollY+rect.height*p[1];}
  else if(previousWidth&&previousWidth!==width)s.x=s.x/previousWidth*width;
  if(!previousWidth)s.baseAngle=s.angle=p[3];
  clampPosition(s);
 });
 syncTargets();requestRender();
}
function change(s,target,now){s.startProgress=s.progress;s.target=target;s.changed=now;s.phase=target?'picking':'sticking';if(target){order=order.filter(t=>t!==s);order.push(s);}setStatus(target?'PEELING…':'STICKING…');requestRender();}
function localPoint(s,x,y){const c=Math.cos(-s.angle),n=Math.sin(-s.angle),dx=x-s.x,dy=y-s.y,scale=1+s.progress*.20;return[(c*dx-n*dy)/(s.w*scale)+.5,(n*dx+c*dy)/(s.h*scale)+.5];}
function hit(x,y){for(let i=order.length-1;i>=0;i--){const s=order[i],[u,v]=localPoint(s,x,y);if(u<0||v<0||u>=1||v>=1)continue;const a=s.pixels.data[(Math.floor(v*s.pixels.height)*s.pixels.width+Math.floor(u*s.pixels.width))*4+3];if(a>55)return s;}return null;}
function grab(s,x,y){s.queuedRelease=false;s.pulse=-1;s.pulseAt=0;let [u,v]=localPoint(s,x,y);u=Math.max(.04,Math.min(.96,u));v=Math.max(.04,Math.min(.96,v));s.grab=[u,v];let ax=.5-u,ay=.5-v;if(Math.hypot(ax,ay)<.15){ax=.7;ay=.65;}s.axis=[ax*2,ay*2];s.tilt=[0,0];change(s,1,performance.now());}
function point(event){return{x:event.clientX+scrollX,y:event.clientY+scrollY};}
function followPointer(){
 if(!active||!pointer)return;
 active.x=pointer.clientX+scrollX+pointer.offsetX;
 active.y=pointer.clientY+scrollY+pointer.offsetY;
 clampPosition(active);
}
function place(){
 if(!active)return;
 const id=pointer?.id;change(active,0,performance.now());active=null;pointer=null;
 layer.classList.remove('is-dragging');
 if(id!==undefined&&layer.hasPointerCapture(id))layer.releasePointerCapture(id);
 syncTargets();requestRender();
}
listen(layer,'pointerdown',event=>{
 if(event.button!==0||pointer)return;
 const {x,y}=point(event),s=hit(x,y);if(!s)return;
 event.preventDefault();window.siteScroll?.cancel();
 if(keyActive){change(keyActive,0,performance.now());keyActive=null;}
 active=s;pointer={id:event.pointerId,clientX:event.clientX,clientY:event.clientY,startX:x,startY:y,offsetX:s.x-x,offsetY:s.y-y,lastX:x,lastY:y,at:performance.now(),moved:false};
 layer.setPointerCapture(event.pointerId);layer.classList.add('is-dragging');grab(s,x,y);requestRender();
});
listen(layer,'pointermove',event=>{
 if(!pointer||event.pointerId!==pointer.id)return;
 const {x,y}=point(event);pointer.moved ||=Math.hypot(x-pointer.startX,y-pointer.startY)>5;
 if(pointer.moved)active.placed=true;
 const elapsed=Math.max(8,performance.now()-pointer.at);
 active.vx=(x-pointer.lastX)/elapsed;active.vy=(y-pointer.lastY)/elapsed;
 pointer.clientX=event.clientX;pointer.clientY=event.clientY;
 pointer.lastX=x;pointer.lastY=y;pointer.at=performance.now();followPointer();
 active.tilt=[Math.max(-1,Math.min(1,active.vx*.6)),Math.max(-1,Math.min(1,active.vy*.6))];
 requestRender();
});
listen(layer,'pointerup',event=>{
 if(!pointer||event.pointerId!==pointer.id)return;
 pointer.clientX=event.clientX;pointer.clientY=event.clientY;followPointer();
 const id=pointer.id,s=active,now=performance.now();
 s.holdUntil=now+(pointer.moved?0:reduced?50:100);s.queuedRelease=true;
 active=null;pointer=null;layer.classList.remove('is-dragging');
 if(layer.hasPointerCapture(id))layer.releasePointerCapture(id);
 requestRender();
});
listen(layer,'pointercancel',place);
listen(layer,'lostpointercapture',place);
listen(window,'blur',()=>{place();if(keyActive){change(keyActive,0,performance.now());keyActive=null;}});
function edgeVelocity(y){
 const edge=Math.min(120,height*.16);
 const amount=y<edge?-Math.min(1,(edge-y)/edge):y>height-edge?Math.min(1,(y-height+edge)/edge):0;
 return Math.sign(amount)*amount*amount*1200;
}
function autoScroll(delta){
 if(!active||!pointer)return;
 const velocity=edgeVelocity(pointer.clientY);
 if(velocity){
  const minimum=Math.max(0,placementBounds.top);
  const maximum=Math.max(minimum,Math.min(pageHeight()-height,placementBounds.bottom-height));
  const next=scrollY+velocity*delta/1000;
  // Stop edge scrolling at this region without jumping on a manual scroll.
  const top=velocity<0?Math.min(scrollY,Math.max(minimum,next)):Math.max(scrollY,Math.min(maximum,next));
  if(top!==scrollY){
   if(window.siteScroll)window.siteScroll.to(top,{immediate:true});else window.scrollTo({top,behavior:'instant'});
   active.placed=true;pointer.moved=true;
  }
 }
 // Recompute document position even when the physical pointer has not moved.
 followPointer();
}
for(const s of stickers){
 const button=document.createElement('button');button.type='button';button.className='sticker-key-target';
 button.textContent=s.name+' — Space to peel, arrows to move from the introduction through the footer, Space to place';
 board.querySelector('.sticker-keyboard').append(button);
 listen(button,'keydown',event=>{
  if([' ','Enter'].includes(event.key)){
   event.preventDefault();window.siteScroll?.cancel();
   if(keyActive===s){change(s,0,performance.now());keyActive=null;}
   else{if(keyActive)change(keyActive,0,performance.now());keyActive=s;grab(s,s.x-s.w*.23,s.y-s.h*.2);}
  }
  if(keyActive===s&&event.key.startsWith('Arrow')){
   event.preventDefault();s.placed=true;s.x+=event.key==='ArrowLeft'?-24:event.key==='ArrowRight'?24:0;
   s.y+=event.key==='ArrowUp'?-24:event.key==='ArrowDown'?24:0;clampPosition(s);
   if(s.y-scrollY<s.h*.6)window.siteScroll?.to(s.y-s.h*.6,{immediate:true});
   else if(s.y-scrollY>height-s.h*.6)window.siteScroll?.to(s.y-height+s.h*.6,{immediate:true});
   requestRender();
  }
  if(event.key==='Escape'&&keyActive){change(keyActive,0,performance.now());keyActive=null;}
 });
 listen(button,'blur',()=>{if(keyActive===s){change(s,0,performance.now());keyActive=null;}});
}
function drawSticker(s,shadowPass,seconds){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,s.art);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,s.shadow);gl.uniform2f(uniforms.Center,s.x-scrollX,s.y-scrollY);gl.uniform2f(uniforms.Size,s.w,s.h);gl.uniform2fv(uniforms.Grab,s.grab);gl.uniform2fv(uniforms.Axis,s.axis);gl.uniform2fv(uniforms.Tilt,s.tilt);gl.uniform1f(uniforms.Progress,s.progress);gl.uniform1f(uniforms.Angle,s.angle);gl.uniform1f(uniforms.Shadow,shadowPass);gl.uniform1f(uniforms.Time,seconds);gl.uniform1f(uniforms.Holo,s.holo);gl.uniform1f(uniforms.Pulse,s.pulse);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);}
function requestRender(){if(!frame&&!document.hidden){previousTime=performance.now();frame=requestAnimationFrame(render);}}
function render(now){
 frame=0;
 const delta=Math.min(50,now-previousTime);previousTime=now;
 autoScroll(delta);
 for(const s of stickers){
  if(Math.abs(s.progress-s.target)>.00001){
   const duration=s.target?(reduced?130:720):(reduced?80:220),t=Math.min(1,(now-s.changed)/duration);
   const eased=s.target?1-Math.pow(1-t,2):1-Math.pow(1-t,3);
   s.progress=s.startProgress+(s.target-s.startProgress)*eased;
   if(t===1){s.progress=s.target;s.phase=s.target?'held':'idle';if(!s.target){s.pulseAt=now;s.pulse=0;s.queuedRelease=false;if(!active&&!keyActive)setStatus('STUCK. YOUR MOVE.');}else if(active===s||keyActive===s)setStatus('PICKED UP · MOVE ME');}
  }
  if(s.queuedRelease&&s.progress>.999&&now>s.holdUntil){s.queuedRelease=false;change(s,0,now);}
  if(!s.target){s.tilt[0]*=Math.exp(-delta/110);s.tilt[1]*=Math.exp(-delta/110);}
  const targetAngle=s.baseAngle+(s===active?Math.max(-.07,Math.min(.07,s.vx*.035)):0);
  s.angle+=(targetAngle-s.angle)*(1-Math.exp(-delta/140));
  clampPosition(s);
  if(s.pulseAt){s.pulse=(now-s.pulseAt)/400;if(s.pulse>1.4){s.pulse=-1;s.pulseAt=0;}}
 }
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
 for(const s of order)if(onScreen(s)){drawSticker(s,1,now/1000);drawSticker(s,0,now/1000);}
 syncTargets();
 canvas.dataset.active=active?active.name:keyActive?keyActive.name:'none';
 canvas.dataset.phases=stickers.map(s=>s.phase).join(',');
 canvas.dataset.progress=stickers.map(s=>s.progress.toFixed(3)).join(',');
 canvas.dataset.positions=JSON.stringify(stickers.map(s=>({name:s.name,x:s.x,y:s.y,w:s.w,h:s.h})));
 board.dataset.ready='true';
 const moving=active||keyActive||stickers.some(s=>onScreen(s)&&(Math.abs(s.progress-s.target)>.00001||s.queuedRelease||s.pulseAt||Math.abs(s.angle-s.baseAngle)>.0001));
 if(moving&&!frame&&!document.hidden)frame=requestAnimationFrame(render);
}
const boardResize=new ResizeObserver(layout),bodyResize=new ResizeObserver(layout);
boardResize.observe(board);bodyResize.observe(document.body);
listen(window,'resize',layout,{passive:true});
listen(window,'scroll',()=>{followPointer();syncTargets();requestRender();},{passive:true});
listen(document,'visibilitychange',()=>{if(document.hidden){place();if(frame)cancelAnimationFrame(frame);frame=0;}else requestRender();});
listen(motion,'change',()=>{reduced=motion.matches;requestRender();});
listen(canvas,'webglcontextlost',event=>{event.preventDefault();dispose();});
layout();setStatus('Five stickers. Hold to peel and place from the introduction through the footer. Hold near the top or bottom edge to scroll.');
let disposed=false;
function dispose(){
 if(disposed)return;disposed=true;abort.abort();cancelAnimationFrame(frame);frame=0;
 boardResize.disconnect();bodyResize.disconnect();
 stickers.forEach(s=>{gl.deleteTexture(s.art);gl.deleteTexture(s.shadow);});
 gl.deleteBuffer(buffer);gl.deleteBuffer(indexBuffer);gl.deleteProgram(program);
 board.querySelector('.sticker-keyboard').replaceChildren();
 board.dataset.ready='false';board.append(canvas);layer.remove();
}
return dispose;
}

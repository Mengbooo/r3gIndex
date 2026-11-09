import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fetchMediaBuffer } from '../../lib/media';
import {CUT_TIME_SCALE,DURATION,ROTATION_PERIOD} from './timing.js';

export async function createR3gScene(output,{layered=false}={}){
const W=1080,H=1080,TAU=Math.PI*2,BLUE='#1e3fd8';
// Four complete turns per 24-second film; every material shares this transform.
const ANGULAR_SPEED=TAU/ROTATION_PERIOD,BASE_YAW=-.24,MODEL_SCALE=.86;
const validModes=new Set(['solid','track','network','blueprint','spectral']);
const c=output.getContext('2d',{alpha:layered});
if(!c)throw new Error('Canvas 2D is unavailable.');
let viewport={width:W,height:H,left:0,top:0,designWidth:W,designHeight:H,scale:1,pixelRatio:1},lastState=null,disposed=false;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const fract=x=>x-Math.floor(x);
const hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
// Geometry, contour samples and particle seeds are baked once by assets:prepare.
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(await fetchMediaBuffer('r3g-scene'),'');
const baked=gltf.scene.getObjectByName('r3g');
const raw=baked.getObjectByName('r3g-model').geometry;
raw.computeBoundingBox();
const pointGeo=baked.getObjectByName('r3g-points').geometry;
pointGeo.setAttribute('aSeed',pointGeo.getAttribute('_aseed'));
pointGeo.deleteAttribute('_aseed');
const pointCount=pointGeo.getAttribute('position').count;
const bakedOutlines=baked.getObjectByName('r3g-contours');
const contours=bakedOutlines.children.filter(line=>line.name.endsWith('-front')).map(line=>{
 const position=line.geometry.getAttribute('position');
 return Array.from({length:position.count},(_,i)=>new THREE.Vector2(position.getX(i),position.getY(i)));
});
const anchors=baked.userData.anchors.map(position=>new THREE.Vector3(...position));
const placeholders=new Set();
gltf.scene.traverse(object=>{if(object.material)for(const material of [].concat(object.material))placeholders.add(material);});
placeholders.forEach(material=>material.dispose());
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,0,10.2);
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:!layered,powerPreference:'high-performance'});renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
if(layered){renderer.domElement.className='reel-webgl';renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';renderer.domElement.setAttribute('aria-hidden','true');output.before(renderer.domElement);}
const group=new THREE.Group();scene.add(group);
const material=new THREE.MeshPhysicalMaterial({color:0x1e3fd8,metalness:.28,roughness:.3,clearcoat:1,clearcoatRoughness:.2,emissive:0x08185c,emissiveIntensity:.04});
const mesh=new THREE.Mesh(raw,material);group.add(mesh);
scene.add(new THREE.AmbientLight(0xffffff,.95));
const key=new THREE.DirectionalLight(0xffffff,4.3);key.position.set(-3,5,5);scene.add(key);
const rim=new THREE.DirectionalLight(0x6888ff,3.4);rim.position.set(4,1,-4);scene.add(rim);
const fill=new THREE.DirectionalLight(0xffffff,1.0);fill.position.set(2,-4,4);scene.add(fill);
const outline=new THREE.Group();group.add(outline);
const outlineMat=new THREE.LineBasicMaterial({color:0x1e3fd8,transparent:true,opacity:.9});
for(const line of bakedOutlines.children)outline.add(new THREE.LineLoop(line.geometry,outlineMat));
const pointMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,uniforms:{uTime:{value:0},uMode:{value:0},uPixelScale:{value:1}},vertexShader:`attribute float aSeed; varying float vLight; uniform float uTime;uniform float uMode;uniform float uPixelScale; void main(){vec3 p=position;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=(1.4+aSeed*1.4)*(10./-view.z)*uPixelScale;vLight=.2+.8*pow(max(0.,sin(p.y*2.2+uTime*3.5)),4.);vLight+=.3*step(.92,fract(aSeed*17.+floor(uTime*12.)*.17));}`,fragmentShader:`varying float vLight;uniform float uMode;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;vec3 col=mix(vec3(.035,.075,.22),vec3(.118,.247,.847),clamp(vLight,0.,1.));gl_FragColor=vec4(col,(1.-smoothstep(.2,.5,d))*(.65+vLight*.3));}`});
const points=new THREE.Points(pointGeo,pointMat);group.add(points);
const grid=new THREE.GridHelper(22,38,0x575d68,0xabb0b8);grid.position.y=-1.9;grid.material.transparent=true;grid.material.opacity=.28;scene.add(grid);
const box=new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(-2.27,-1.45,-.25),new THREE.Vector3(2.27,1.45,.25)),0x242730);group.add(box);box.material.transparent=true;box.material.opacity=.45;
const noise=document.createElement('canvas');noise.width=360;noise.height=360;const nc=noise.getContext('2d');const noiseData=nc.createImageData(360,360);
const scratch=document.createElement('canvas');scratch.width=W;scratch.height=H;const sc=scratch.getContext('2d');
const glow=document.createElement('canvas');glow.width=W;glow.height=H;const gc=glow.getContext('2d');
const schedule=[
[0,.72,'solid'],[.72,1.19,'track'],[1.19,1.88,'network'],[1.88,2.28,'solid'],[2.28,3.12,'blueprint'],[3.12,3.66,'spectral'],[3.66,4.28,'track'],[4.28,4.94,'solid'],[4.94,5.47,'track'],[5.47,6.08,'spectral'],[6.08,6.78,'network'],[6.78,7.44,'blueprint'],[7.44,8.16,'spectral'],[8.16,8.76,'network'],[8.76,9.4,'solid'],[9.4,9.94,'track'],[9.94,10.56,'solid'],[10.56,11.29,'network'],[11.29,12,'solid']].map(([start,end,mode])=>[start*CUT_TIME_SCALE,end*CUT_TIME_SCALE,mode]);
function line(x1,y1,x2,y2,col='#444a55',alpha=.45,width=.75){c.globalAlpha=alpha;c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.globalAlpha=1;}
function label(text,x,y,color='#252a34',size=10,align='left'){c.font=`${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;c.textAlign=align;c.fillStyle=color;c.fillText(text,x,y);c.textAlign='left';}
function corners(x,y,w,h,color='#3a55c7',len=9){for(const [a,b,sx,sy]of[[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){line(a,b,a+len*sx,b,color,.65);line(a,b,a,b+len*sy,color,.65);}}
function project(v){const q=v.clone().applyMatrix4(group.matrixWorld).project(camera);return{x:viewport.left+(q.x*.5+.5)*viewport.designWidth,y:viewport.top+(-.5*q.y+.5)*viewport.designHeight,z:q.z};}
function getBounds(){const ps=[[-2.25,-1.4,0],[2.25,-1.4,0],[-2.25,1.4,0],[2.25,1.4,0]].map(p=>project(new THREE.Vector3(...p)));return{x:Math.min(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),w:Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)),h:Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y))};}
function blueGrid(){for(let x=40;x<=1040;x+=15){line(x,40,x,1040,'#707987',x%75===40?.28:.1);}for(let y=40;y<=1040;y+=15){line(40,y,1040,y,'#707987',y%75===40?.28:.1);}}
function blueprint(t){blueGrid();c.strokeStyle='#4858b3';c.lineWidth=1.1;c.strokeRect(20,20,1040,1040);c.strokeRect(38,38,1004,1004);for(let i=0;i<6;i++){label(''+(i+1),125+i*168,31,'#454b56',9);label(''+(i+1),125+i*168,1055,'#454b56',9);line(125+i*168,38,125+i*168,45,'#8b98b2');}for(let i=0;i<4;i++)label(String.fromCharCode(65+i),25,200+i*230,'#454b56',9);
label('ISO · LIVE',1009,85,'#202531',10,'right');label(`YAW ${(((BASE_YAW+t*ANGULAR_SPEED)*180/Math.PI%360+360)%360).toFixed(1)}°  PITCH −7.4°`,1009,102,'#4e5562',9,'right');
// Small front orthographic view.
c.save();c.translate(174,177);c.scale(23,-23);c.lineWidth=.035;c.strokeStyle='#5b69bd';for(const pts of contours){c.beginPath();pts.forEach((v,j)=>{const x=v.x,y=v.y;j?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.stroke();}c.restore();corners(105,120,138,116,'#7186db',5);label('FRONT / 01',174,255,'#343a46',8,'center');line(105,110,243,110,'#6577c1',.7);label('43.50',174,105,'#292f3c',8,'center');
const b=getBounds();const y=b.y+b.h+52;line(b.x,y,b.x+b.w,y,'#6075be',.55);line(b.x,y-7,b.x,y+7,'#6075be');line(b.x+b.w,y-7,b.x+b.w,y+7,'#6075be');label('X 43.50',b.x+b.w*.5,y-7,'#303744',9,'center');label('Y 21.00',b.x-24,b.y+b.h*.5,'#303744',9,'right');label('Z 2.80',b.x+b.w+18,y-25,'#303744',9);
for(let i=0;i<3;i++){c.strokeStyle='#4654a1';c.strokeRect(135+i*58,918,32,42);for(let j=0;j<6;j++)line(135+i*58+j*5,958,160+i*58,918+j*6,'#455abb',.3);}
label('SECTION A–A',180,985,'#454b56',8);label('Ø 17.00   COUNTER 6.90',75,885,'#454b56',8);
c.strokeStyle='#4858b3';c.strokeRect(720,929,322,113);line(720,970,1042,970,'#5364bb',.7);line(876,970,876,1042,'#5364bb',.7);label('R3G · IDENTITY',735,956,'#171c27',12);label('SCALE 1:1   DEPTH 2.80',735,991,'#424955',8);label('THIRD-ANGLE   SHEET 01',891,991,'#424955',8);label('UNITS SYMBOL / 2026',735,1025,'#424955',8);label('DRAWN r3g  /  REV A',891,1025,'#424955',8);
}
function tracking(t){const chosen=[0,8,17,29,38,52,65,78,90];chosen.forEach((j,i)=>{const a=project(anchors[j%anchors.length]);const col=i%3===0?'#252b36':'#1e3fd8';corners(a.x-6,a.y-6,12,12,col,4);if(i%2===0){c.fillStyle=i%3===0?'#252b36':'#5874ef';c.globalAlpha=.72;c.fillRect(a.x-4,a.y-3,8,6);c.globalAlpha=1;}label(`X: ${Math.round(a.x)} Y: ${Math.round(a.y)}`,a.x+9,a.y-10,'#2e3542',9);if(i===2||i===6){const end=i===2?{x:1040,y:800}:{x:280,y:0};line(a.x,a.y,end.x,end.y,'#464e5b',.4,.7);}});}
function histogram(t){const x=830,y=991;line(x,y,1018,y,'#565f6d',.4);for(let i=0;i<31;i++){const v=Math.exp(-Math.pow((i-16-Math.sin(t*2)*5)/7,2));const h=6+v*(30+hash(i+Math.floor(t*14))*48);c.fillStyle=`rgba(30,63,216,${.55+v*.35})`;c.fillRect(x+i*5.6,y-h,3.5,h);}label('SPECTRUM / SURFACE',830,1008,'#4d5663',7);}
function spectral(t){label('LIDAR · OBJECT SYMBOL',53,61,'#202632',9);for(const [i,txt]of['MODE      PT CLOUD','POINTS    024.576','NORMAL    XYZ','SAMPLE    60.00 HZ','DEPTH     02.80','STATUS    RESOLVED'].entries())label(txt,53,81+i*12,'#4a5260',8);corners(120,280,840,498,'#3c4350',12);label(`◎  SCAN ${String(Math.floor(t*60)).padStart(4,'0')} / R3G`,115,223,'#3c4350',9);histogram(t);}
function network(t){const positions=[];for(let i=0;i<12;i++){const a=i/12*TAU+t*.13;const rx=350+hash(i)*100,ry=390+hash(i+50)*80;positions.push({x:540+Math.cos(a)*rx,y:540+Math.sin(a)*ry,w:22+hash(i+20)*58,h:35+hash(i+30)*88});}
for(let i=0;i<positions.length;i++){const a=positions[i],b=positions[(i+4)%positions.length];c.strokeStyle='rgba(35,42,56,.22)';c.lineWidth=.8;c.beginPath();c.moveTo(a.x,a.y);c.bezierCurveTo(540+Math.sin(t+i)*240,540-260*Math.cos(t*.4+i),540+Math.cos(i)*220,540+Math.sin(t+i)*300,b.x,b.y);c.stroke();const target=project(anchors[(i*9)%anchors.length]);line(a.x,a.y,target.x,target.y,'#485261',.15,.6);}
for(const [i,a]of positions.entries()){c.fillStyle='rgba(30,63,216,.025)';c.fillRect(a.x-a.w/2,a.y-a.h/2,a.w,a.h);c.strokeStyle='rgba(30,40,65,.45)';c.lineWidth=.65;c.strokeRect(a.x-a.w/2,a.y-a.h/2,a.w,a.h);label(`X: ${Math.round(a.x)} Y: ${Math.round(a.y)} Z: ${940+i*17}`,a.x-a.w/2,a.y-a.h/2-7,'#333c4b',7.5);for(let j=0;j<90;j++){const x=a.x+(hash(j*7+i*21)-.5)*a.w*.85,y=a.y+(hash(j*3+i*49)-.5)*a.h*.9;const v=hash(j+i+Math.floor(t*5));c.fillStyle=v>.8?'#242c38':v>.5?'#435dce':'#69717e';c.globalAlpha=.3+v*.5;c.fillRect(x,y,1+v,1);}c.globalAlpha=1;line(a.x-4,a.y,a.x+4,a.y,'#7c8cda',.8);line(a.x,a.y-4,a.x,a.y+4,'#7c8cda',.8);}
const b=getBounds();corners(b.x-12,b.y-10,b.w+24,b.h+20,'#626dba',10);label('obj: 00  r3g identity  conf: 0.97',b.x-10,b.y-20,'#2f3745',9);
}
function texture(t,mode){const f=Math.floor(t*60);if(!layered){for(let i=0;i<noiseData.data.length;i+=4){const v=hash(i*.17+f*13.1)*255;noiseData.data[i]=v;noiseData.data[i+1]=v;noiseData.data[i+2]=v;noiseData.data[i+3]=255;}nc.putImageData(noiseData,0,0);c.globalAlpha=mode==='network'?.02:.01;c.drawImage(noise,0,0,W,H);c.globalAlpha=1;
c.fillStyle='rgba(0,0,0,.022)';for(let y=0;y<H;y+=3)c.fillRect(0,y,W,1);
const vignette=c.createRadialGradient(540,520,150,540,540,740);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.025)');c.fillStyle=vignette;c.fillRect(0,0,W,H);}
if(mode==='solid'){corners(96,95,888,890,'#5a606b',8);}if(f%113===0){c.fillStyle='rgba(110,138,220,.025)';c.fillRect(0,hash(f)*1000,W,1);}}
function renderAt(time,{mode:modeOverride}={}){
const elapsed=Number.isFinite(time)?time:0,t=((elapsed%DURATION)+DURATION)%DURATION;
const entry=schedule.find(s=>t>=s[0]&&t<s[1])||schedule[0];
const mode=validModes.has(modeOverride)?modeOverride:entry[2];
if(disposed)return lastState;
c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,output.width,output.height);
const s=viewport.pixelRatio*viewport.scale;c.setTransform(s,0,0,s,-viewport.left*s,-viewport.top*s);
if(!layered){c.fillStyle='#ffffff';c.fillRect(0,0,W,H);}
const isBlueprint=mode==='blueprint',isNetwork=mode==='network',isScan=mode==='spectral',isTrack=mode==='track';
mesh.visible=!isBlueprint&&!isScan&&!isNetwork;points.visible=isScan||isNetwork||isTrack;outline.visible=isBlueprint;grid.visible=isScan||isNetwork;box.visible=isScan;
// A single clock drives the model. Cuts change representation only, never pose or framing.
group.rotation.set(-.13,BASE_YAW+elapsed*ANGULAR_SPEED,0);
group.scale.setScalar(MODEL_SCALE);group.position.set(0,0,0);camera.position.z=10.2;
pointMat.uniforms.uTime.value=t;
material.emissiveIntensity=isTrack?.12:.04;key.intensity=4.3;
scene.updateMatrixWorld(true);camera.updateMatrixWorld();renderer.render(scene,camera);
if(!isBlueprint){gc.clearRect(0,0,W,H);gc.filter=`blur(${isTrack?5:2}px)`;gc.drawImage(renderer.domElement,viewport.left,viewport.top,viewport.designWidth,viewport.designHeight);gc.filter='none';c.globalAlpha=isTrack?.18:isNetwork?.1:.06;c.drawImage(glow,0,0);c.globalAlpha=1;}
if(!layered)c.drawImage(renderer.domElement,viewport.left,viewport.top,viewport.designWidth,viewport.designHeight);
if(isBlueprint)blueprint(t);if(isTrack)tracking(t);if(isScan)spectral(t);if(isNetwork)network(t);
texture(t,mode);
lastState={elapsed,t,mode,points:pointCount,rotation:{x:group.rotation.x,y:group.rotation.y,z:group.rotation.z},scale:group.scale.x,position:{x:group.position.x,y:group.position.y,z:group.position.z},cameraZ:camera.position.z};
return lastState;
}

// Crop the original square composition exactly like object-fit: cover. Resize the
// render buffers, never the model, so changing aspect ratio cannot distort r3g.
function resize(width,height,pixelRatio=1){
 if(disposed)return;
 width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
 pixelRatio=Math.max(1,Math.min(2,pixelRatio||1));
 const square=Math.max(width,height),scale=square/W;
 viewport={width,height,scale,pixelRatio,left:(W-width/scale)/2,top:(H-height/scale)/2,designWidth:width/scale,designHeight:height/scale};
 output.width=Math.round(width*pixelRatio);output.height=Math.round(height*pixelRatio);
 renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height,false);
 camera.setViewOffset(square,square,(square-width)/2,(square-height)/2,width,height);
 camera.updateProjectionMatrix();
 pointMat.uniforms.uPixelScale.value=pixelRatio*scale;
}
function getDiagnostics(){
 const size=renderer.getDrawingBufferSize(new THREE.Vector2());
 return{renderer:'Three.js',layered,viewport:{...viewport},buffer:{width:size.x,height:size.y},vertices:raw.attributes.position.count,points:pointCount,modelSize:raw.boundingBox.getSize(new THREE.Vector3()).toArray(),disposed};
}
function dispose(){
 if(disposed)return;disposed=true;
 const geometries=new Set([raw,pointGeo]),materials=new Set([material,pointMat,outlineMat]);
 scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material){for(const m of [].concat(object.material))materials.add(m);}});
 geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
 renderer.dispose();if(layered)renderer.domElement.remove();
}
resize(W,H,1);
return{renderAt,resize,dispose,getState:()=>lastState,getDiagnostics};
}

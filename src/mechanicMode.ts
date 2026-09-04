import Phaser from 'phaser';
import {MECHANIC_LEVELS,getMechanicLevel,type MechanicLevel} from './mechanicLevels';
import {chooseMotherCell} from './core2048';

const W=1080,H=1920,VERSION='v0.14.0-full-board-goals',SVG_CONFIG={width:256,height:256};
const svgAsset=(name:string)=>`./assets/${name}.svg?v=0.12.1`;
type Dir='left'|'right'|'up'|'down';
type LabMotion={fromR:number;fromC:number;toR:number;toC:number;value:number};
type LabSpawn={r:number;c:number;value:number};
const K=(r:number,c:number)=>r+','+c;
const parse=(k:string)=>k.split(',').map(Number) as [number,number];
const clone=(g:number[][])=>g.map(r=>[...r]);
const empty=(r=5,c=5)=>Array.from({length:r},()=>Array(c).fill(0));
const colors:Record<number,number>={0:0xcfc4b5,2:0xeee4da,4:0xe6d2b5,8:0xf2b179,16:0xf59563,32:0xf67c5f,64:0xe84a35,128:0xedcf72,256:0xe8bd48,512:0xd99b32,1024:0xc97932,2048:0xb85d2c,4096:0x9b5de5,8192:0x4f86d9,16384:0x28a99e};

function text(s:Phaser.Scene,x:number,y:number,value:string,size:number,color='#5f574d'){
  return s.add.text(x,y,value,{fontFamily:'Arial,sans-serif',fontSize:size+'px',fontStyle:'bold',color,align:'center',wordWrap:{width:920}}).setOrigin(.5);
}
function btn(s:Phaser.Scene,x:number,y:number,w:number,label:string,fn:()=>void,enabled=true){
  const b=s.add.rectangle(x,y,w,82,enabled?0x75685b:0xc8bfb4).setInteractive(enabled?{useHandCursor:true}:undefined);
  const t=text(s,x,y,label,29,enabled?'#fff':'#91877b');if(enabled)b.on('pointerup',fn);return[b,t];
}
function mergeLine(values:number[],id:number){
  const a=values.filter(v=>v!==0),out:number[]=[],groups:number[][]=[];let gained=0,merges=0;
  if(id===31){
    for(let i=0;i<a.length;){
      if(a[i]>0&&a[i]===a[i+1]&&a[i]===a[i+2]){out.push(a[i]*2);groups.push([i,i+1,i+2]);gained+=a[i]*2;merges++;i+=3}
      else{out.push(a[i]);groups.push([i]);i++}
    }
    return{out,groups,gained,merges};
  }
  for(let i=0;i<a.length;i++){
    const x=a[i],y=a[i+1],wildcard=id===25&&(x===-1||y===-1)&&y!==undefined;
    const adjacent=id===36&&x>0&&y>0&&(x===y*2||y===x*2);
    const parity=id===35&&x>0&&y>0&&x===y&&Math.log2(x)%2===Math.log2(y)%2;
    const normal=x>0&&x===y&&id!==35;
    if(wildcard||adjacent||parity||normal){
      const v=wildcard?Math.max(x,y)*2:adjacent?Math.max(x,y)*2:id===37?x:x*2;
      out.push(v);groups.push([i,i+1]);gained+=Math.max(0,v);merges++;i++;
    }else{out.push(x);groups.push([i])}
  }
  return{out,groups,gained,merges};
}
function moveBoard(grid:number[][],dir:Dir,voids:Set<string>,fixed:Set<string>,id:number){
  const rows=grid.length,cols=grid[0].length,next=clone(grid),motions:LabMotion[]=[];
  const horizontal=dir==='left'||dir==='right',reverse=dir==='right'||dir==='down';
  const count=horizontal?rows:cols,length=horizontal?cols:rows;let gained=0,merges=0;
  for(let li=0;li<count;li++){
    const ps:Array<[number,number]>=Array.from({length},(_,i)=>horizontal?[li,i]:[i,li]);let start=0;
    for(let finish=0;finish<=length;finish++){
      const boundary=finish===length||voids.has(K(...ps[finish]))||fixed.has(K(...ps[finish]));
      if(!boundary)continue;
      const seg=ps.slice(start,finish),oriented=reverse?[...seg].reverse():seg;
      const sourceItems=oriented.map(([r,c])=>({value:grid[r][c],r,c})).filter(x=>x.value!==0);
      const m=mergeLine(sourceItems.map(x=>x.value),id);gained+=m.gained;merges+=m.merges;
      seg.forEach(([r,c])=>next[r][c]=0);
      m.out.forEach((value,outIndex)=>{const dest=oriented[outIndex];next[dest[0]][dest[1]]=value;
        for(const sourceIndex of m.groups[outIndex]){const source=sourceItems[sourceIndex];motions.push({fromR:source.r,fromC:source.c,toR:dest[0],toC:dest[1],value:source.value})}
      });
      start=finish+1;
    }
  }
  return{grid:next,gained,merges,motions,moved:JSON.stringify(grid)!==JSON.stringify(next)};
}

export class HomeScene extends Phaser.Scene{
  constructor(){super('home')}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');text(this,W/2,260,'2048 关卡实验室',82);text(this,W/2,360,'选择要进入的游戏模式',32,'#887e72');
    const a=this.add.rectangle(W/2,580,760,190,0x826f5d).setInteractive({useHandCursor:true});text(this,W/2,555,'机制测试关卡',44,'#fff');text(this,W/2,620,'50种机制 · 每种一关',27,'#eadfd2');a.on('pointerup',()=>this.scene.start('mechanic-select'));
    const b=this.add.rectangle(W/2,840,760,190,0x647f88).setInteractive({useHandCursor:true});text(this,W/2,815,'障碍物实验室',44,'#fff');text(this,W/2,880,'4类障碍 · 16个可操作测试关',27,'#e0edf0');b.on('pointerup',()=>this.scene.start('obstacle-select'));
    const c=this.add.rectangle(W/2,1100,760,190,0xb17a4b).setInteractive({useHandCursor:true});text(this,W/2,1075,'现有关卡模式',44,'#fff');text(this,W/2,1140,'保留原来的50关进度',27,'#f7e5d4');c.on('pointerup',()=>this.scene.start('levels'));
    text(this,W/2,1810,VERSION,23,'#aaa095');
  }
}

export class MechanicSelectScene extends Phaser.Scene{
  constructor(){super('mechanic-select')}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');btn(this,105,82,170,'‹ 主页',()=>this.scene.start('home'));text(this,W/2,85,'机制测试',60);
    for(let i=0;i<50;i++){
      const m=MECHANIC_LEVELS[i],col=i%5,row=Math.floor(i/5),x=130+col*205,y=280+row*145;
      const b=this.add.rectangle(x,y,170,112,[0x998371,0x7d9282,0x8296aa,0xaa856f,0x9d875f][Math.floor(i/10)]).setInteractive({useHandCursor:true});
      text(this,x,y-18,String(m.id),31,'#fff');this.add.text(x,y+24,m.title,{fontSize:'19px',color:'#fff',align:'center',wordWrap:{width:155}}).setOrigin(.5);b.on('pointerup',()=>this.scene.start('mechanic-test',{id:m.id}));
    }
    text(this,W/2,1815,VERSION,22,'#aaa095');
  }
}

export class MechanicTestScene extends Phaser.Scene{
  level!:MechanicLevel;grid=empty();voids=new Set<string>();blockers=new Set<string>();ice=new Map<string,number>();
  special=new Map<string,string>();timeLeft=0;score=0;combo=0;turn=0;gateTimer=0;nextValue=2;failed=false;timeExpired=false;countdown?:Phaser.Time.TimerEvent;
  board!:Phaser.GameObjects.Container;status!:Phaser.GameObjects.Text;touch?:Phaser.Math.Vector2;lastDir:Dir='left';animating=false;mother={r:0,c:0};
  constructor(){super('mechanic-test')}
  preload(){
    this.load.svg('lab-stump',svgAsset('stump'),SVG_CONFIG);
    this.load.svg('lab-ice',svgAsset('ice'),SVG_CONFIG);
    this.load.svg('lab-ant',svgAsset('ant'),SVG_CONFIG);
    this.load.svg('lab-portal',svgAsset('portal'),SVG_CONFIG);
    this.load.svg('lab-bomb',svgAsset('bomb'),SVG_CONFIG);
    this.load.svg('lab-stone',svgAsset('stone'),SVG_CONFIG);
    this.load.svg('lab-chain',svgAsset('chain'),SVG_CONFIG);
    this.load.svg('lab-slime',svgAsset('slime'),SVG_CONFIG);
  }
  init(d:{id?:number}){this.level=getMechanicLevel(d.id||1)}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');
    btn(this,90,65,145,'列表',()=>this.scene.start('mechanic-select'));btn(this,735,65,145,'上一关',()=>this.scene.restart({id:this.level.id-1}),this.level.id>1);btn(this,930,65,145,'下一关',()=>this.scene.restart({id:this.level.id+1}),this.level.id<50);
    text(this,W/2,145,`${this.level.id}. ${this.level.title}`,50);text(this,W/2,215,this.level.description,27,'#81766a');
    btn(this,160,350,260,'重新测试',()=>this.reset());
    if(this.level.id===49)btn(this,480,350,300,'切换生成数字',()=>{this.nextValue=this.nextValue===2?4:2;this.render()});
    this.status=this.add.text(820,315,'',{fontSize:'27px',fontStyle:'bold',color:'#655b51',align:'right'}).setOrigin(1,0);
    this.board=this.add.container();this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.touch=new Phaser.Math.Vector2(p.x,p.y));
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{if(!this.touch)return;const dx=p.x-this.touch.x,dy=p.y-this.touch.y;this.touch=undefined;if(Math.max(Math.abs(dx),Math.abs(dy))<40)return;this.act(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'))});
    this.input.keyboard?.on('keydown',(e:KeyboardEvent)=>{const m:Record<string,Dir>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(m[e.key])this.act(m[e.key])});
    this.reset();
  }
  reset(){
    this.countdown?.remove(false);this.grid=empty();this.voids.clear();this.blockers.clear();this.ice.clear();this.special.clear();this.timeLeft=this.level.timeLimit;this.score=0;this.combo=0;this.turn=0;this.gateTimer=0;this.failed=false;this.timeExpired=false;this.nextValue=2;
    this.setup();
    const unavailable=new Set([...this.voids,...this.blockers,...this.ice.keys(),...this.special.keys()]);
    for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(this.grid[r][c])unavailable.add(K(r,c));
    if(this.level.id===8)for(let c=0;c<5;c++)unavailable.add(K(2,c));
    if(this.level.id===9)for(let r=1;r<=3;r++)for(let c=1;c<=3;c++)unavailable.add(K(r,c));
    if(this.level.id===43)[[1,2],[2,1],[2,3],[3,2]].forEach(([r,c])=>unavailable.add(K(r,c)));
    this.mother=chooseMotherCell(5,5,unavailable);this.render();this.startCountdown();
  }
  startCountdown(){
    this.updateStatus();
    this.countdown=this.time.addEvent({delay:1000,loop:true,callback:()=>{
      if(this.timeExpired)return;
      this.timeLeft=Math.max(0,this.timeLeft-1);this.updateStatus();
      if(this.timeLeft===0){this.timeExpired=true;this.animating=false;this.countdown?.remove(false);this.countdown=undefined;this.updateStatus()}
    }});
  }
  updateStatus(){
    const minutes=Math.floor(this.timeLeft/60),seconds=this.timeLeft%60,max=Math.max(...this.grid.flat()),done=this.level.id===33?max===this.level.target:max>=this.level.target;
    const time=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    this.status?.setText(`剩余时间 ${time}\n分数 ${this.score}\n目标 ${this.level.target}\n${this.timeExpired?'时间到 · 测试失败':this.failed?'规则失败':done?'目标完成':''}${this.level.id===40?'\n连击 ×'+this.combo:''}${this.level.id===49?'\n下一个 '+this.nextValue:''}`);
    this.status?.setColor(this.timeLeft<=10?'#b94a3b':'#655b51');
  }
  setup(){
    const id=this.level.id;
    this.grid[1][1]=2;this.grid[1][2]=2;this.grid[3][2]=4;this.grid[3][3]=4;
    if(id===1)this.blockers.add(K(2,2));
    if(id===2)[[0,0],[0,4],[4,0],[4,4]].forEach(p=>this.voids.add(K(p[0],p[1])));
    if(id===3)for(let r=0;r<5;r++)this.voids.add(K(r,2));
    if(id===4)for(let r=0;r<5;r++)if(r!==2)this.voids.add(K(r,2));
    if(id===5)for(let r=0;r<5;r++)this.voids.add(K(r,2));
    if(id===6||id===7)[[0,0],[0,1],[0,3],[0,4],[4,0],[4,1],[4,3],[4,4]].forEach(p=>this.voids.add(K(p[0],p[1])));
    if(id===8){this.special.set(K(2,1),'平台');this.grid[2][1]=8}
    if(id===9)this.special.set(K(2,2),'旋转');
    if(id===10)for(let c=0;c<5;c++)this.special.set(K(2,c),'滑轨');
    if(id>=11&&id<=13){this.special.set(K(0,0),'入口');this.special.set(K(4,4),'出口')}
    if(id>=14&&id<=18){for(let r=0;r<5;r++)this.blockers.add(K(r,2));this.special.set(K(2,2),'门')}
    if(id===19||id===20){this.grid[2][2]=8;this.ice.set(K(2,2),id===19?1:2)}
    if(id===21){this.grid[2][2]=8;this.special.set(K(2,2),'锁链')}
    if(id===22){this.grid[2][2]=8;this.special.set(K(2,2),'黏液')}
    if(id===23){this.grid[2][2]=8;this.special.set(K(2,2),'重型')}
    if(id===24){this.grid[2][2]=-5;this.special.set(K(2,2),'幽灵')}
    if(id===25)this.grid[2][2]=-1;
    if(id===26)this.grid[2][2]=16;
    if(id===27){this.grid[2][2]=16;this.special.set(K(2,2),'不稳')}
    if(id===28){this.grid[2][2]=8;this.special.set(K(2,2),'3')}
    if(id===29)this.grid[2][2]=-2;
    if(id===30){this.grid[2][2]=-4;this.special.set(K(2,2),'石化')}
    if(id===31){this.grid[1][3]=2}
    if(id===33||id===34)this.level.target=16;
    if(id===39)this.special.set(K(2,2),'落点');
    if(id===41)this.nextValue=2;
    if(id===42)this.special.set(K(4,2),'入口');
    if(id===43)this.special.set(K(2,2),'生成器');
    if(id===48){this.grid[2][2]=-3;this.blockers.add(K(2,2))}
    if(id===50)this.special.set(K(0,2),'3步后障碍');
  }
  fixed(){
    const f=new Set([...this.blockers,...this.ice.keys(),K(this.mother.r,this.mother.c)]);
    if(this.level.id===21||this.level.id===30||this.level.id===48)f.add(K(2,2));
    if(this.level.id===22&&this.turn%2===1)f.add(K(2,2));
    if(this.level.id===23&&this.turn%2===0)f.add(K(2,2));
    if(this.level.id===10&&(this.lastDir==='up'||this.lastDir==='down'))for(let c=0;c<5;c++)f.add(K(2,c));
    return f;
  }
  act(dir:Dir){
    if(this.timeExpired||this.animating)return;this.lastDir=dir;const before=clone(this.grid),m=moveBoard(this.grid,dir,this.voids,this.fixed(),this.level.id);if(!m.moved)return;
    this.animating=true;this.grid=m.grid;this.turn++;this.score+=m.gained;this.combo=m.merges?this.combo+1:0;this.effects(before,m.gained,m.merges,dir);
    const spawned:LabSpawn[]=[];const shouldSpawn=this.level.id!==45||m.merges>0;
    if(shouldSpawn){const tile=this.spawn(dir);if(tile)spawned.push(tile)}
    if(this.level.id===46){const tile=this.spawn(dir);if(tile)spawned.push(tile)}
    this.render(m.motions,spawned);
  }
  effects(before:number[][],gained:number,merges:number,dir:Dir){
    const id=this.level.id,max=Math.max(...this.grid.flat());
    if(id===5&&max>=8)this.blockers.delete(K(2,2)),this.voids.delete(K(2,2));
    if(id===6)for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(before[r][c]&&!this.grid[r][c])this.voids.add(K(r,c));
    if(id===7&&max>=8)this.voids.clear();
    if(id===8){const old=[...this.special].find(([,v])=>v==='平台');if(old){const[r,c]=parse(old[0]),v=this.grid[r][c];this.grid[r][c]=0;this.special.delete(old[0]);const nc=(c+1)%5;this.grid[r][nc]=v;this.special.set(K(r,nc),'平台')}}
    if(id===9&&this.turn%3===0)this.rotateCenter();
    if(id>=11&&id<=13){const exits=id===13?[[4,4],[0,4],[4,0]][this.turn%3]:[4,4];if(this.grid[0][0]){this.grid[exits[0]][exits[1]]=this.grid[0][0];this.grid[0][0]=0}}
    if(id>=14&&id<=18){const sum=this.grid.flat().reduce((a,b)=>a+Math.max(0,b),0);const open=id===14?max>=16:id===15?max>=8:id===16?max>=8:id===17?sum>=24:merges>0;if(open){this.blockers.delete(K(2,2));if(id===18)this.gateTimer=3}if(id===18&&this.gateTimer>0&&--this.gateTimer===0)this.blockers.add(K(2,2))}
    if((id===19||id===20)&&gained){for(const[k,l]of[...this.ice])l<=1?this.ice.delete(k):this.ice.set(k,l-1)}
    if(id===24){const pos=this.find(-5);if(pos){this.grid[pos[0]][pos[1]]=0;const r=dir==='down'?4:dir==='up'?0:pos[0],c=dir==='right'?4:dir==='left'?0:pos[1];if(!this.grid[r][c])this.grid[r][c]=-5}}
    if(id===26&&max>=16){const p=this.find(16);if(p){this.grid[p[0]][p[1]]=8;const q=this.firstEmpty();if(q)this.grid[q[0]][q[1]]=8}}
    if(id===27&&this.turn%3===0&&this.grid[2][2]>2)this.grid[2][2]/=2;
    if(id===28){const left=3-this.turn;if(left<=0){this.blockers.add(K(2,2));this.grid[2][2]=0;this.special.set(K(2,2),'障碍')}else this.special.set(K(2,2),String(left))}
    if(id===29&&gained){const p=this.find(-2);if(p)for(let r=p[0]-1;r<=p[0]+1;r++)for(let c=p[1]-1;c<=p[1]+1;c++)if(this.grid[r]?.[c]!==undefined)this.grid[r][c]=0}
    if(id===30&&gained){this.blockers.delete(K(2,2));this.grid[2][2]=8;this.special.delete(K(2,2))}
    if(id===32&&merges>1)this.score+=movedBonus(merges);
    if(id===33&&max>this.level.target)this.failed=true;
    if(id===34&&max>this.level.target)this.failed=true;
    if(id===38&&gained){const p=this.find(max);if(p&&max>=8){this.grid[p[0]][p[1]]=max/2;const q=this.firstEmpty();if(q)this.grid[q[0]][q[1]]=max/2}}
    if(id===39&&gained){const p=this.find(max);if(p&&!this.grid[2][2]){this.grid[p[0]][p[1]]=0;this.grid[2][2]=max}}
    if(id===43&&this.turn%2===0){const q=[[1,2],[2,1],[2,3],[3,2]].find(([r,c])=>!this.grid[r][c]);if(q)this.grid[q[0]][q[1]]=2}
    if(id===50&&this.turn===3){this.blockers.add(K(0,2));this.special.set(K(0,2),'障碍')}
  }
  rotateCenter(){const a=clone(this.grid);for(let r=1;r<=3;r++)for(let c=1;c<=3;c++)this.grid[r][c]=a[4-c][r]}
  find(v:number){for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(this.grid[r][c]===v)return[r,c] as[number,number]}
  firstEmpty(){for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(!this.grid[r][c]&&K(r,c)!==K(this.mother.r,this.mother.c)&&!this.voids.has(K(r,c))&&!this.blockers.has(K(r,c)))return[r,c] as[number,number]}
  spawn(dir:Dir){
    const spots:Array<[number,number]>=[];for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(!this.grid[r][c]&&K(r,c)!==K(this.mother.r,this.mother.c)&&!this.voids.has(K(r,c))&&!this.blockers.has(K(r,c))){
      if(this.level.id===42&&!(r===4&&c===2))continue;
      if(this.level.id===44){if(dir==='left'&&c!==4||dir==='right'&&c!==0||dir==='up'&&r!==4||dir==='down'&&r!==0)continue}
      spots.push([r,c]);
    }
    if(!spots.length)return null;const p=spots[(this.turn*7+this.level.id)%spots.length];
    const seq=this.level.id===47?[8,16,8,4]:this.level.id===41?[2,2,4,2]:[this.nextValue],value=this.level.id===48?-3:seq[this.turn%seq.length];this.grid[p[0]][p[1]]=value;
    if(this.level.id===48)this.blockers.add(K(p[0],p[1]));
    return{r:p[0],c:p[1],value};
  }
  render(motions:LabMotion[]=[],spawned:LabSpawn[]=[]){
    this.board.removeAll(true);const cell=154,gap=0,ox=155,oy=520;
    const center=(r:number,c:number)=>({x:ox+c*(cell+gap)+cell/2,y:oy+r*(cell+gap)+cell/2});
    const addPiece=(v:number,x:number,y:number)=>{
      const piece=this.add.container(x,y);
      piece.add(this.add.rectangle(0,0,cell,cell,colors[v]||0xb39e87));
      if(v===-2)piece.add(this.add.image(0,0,'lab-bomb').setDisplaySize(cell*.72,cell*.72));
      else if(v===-4)piece.add(this.add.image(0,0,'lab-stone').setDisplaySize(cell*.72,cell*.72));
      else{const name=v===-1?'万能':v===-3?'污染':v===-5?'幽灵':String(v);piece.add(text(this,0,0,name,v<0?22:43,v>4?'#fff':'#655b51'))}
      return piece;
    };
    const motherPos=center(this.mother.r,this.mother.c),motherPiece=this.add.container(motherPos.x,motherPos.y);
    motherPiece.add(this.add.rectangle(0,0,cell,cell,0x72549a));
    motherPiece.add(this.add.circle(0,0,cell*.29,0xf3d58f));
    motherPiece.add(this.add.circle(-cell*.15,-cell*.12,cell*.07,0xfff2c7));
    motherPiece.add(this.add.circle(cell*.15,-cell*.12,cell*.07,0xfff2c7));
    motherPiece.add(text(this,0,cell*.08,'母',43,'#5b3e77'));
    const finalPieces=new Map<string,Phaser.GameObjects.Container>();
    for(let r=0;r<5;r++)for(let c=0;c<5;c++){
      const k=K(r,c),x=ox+c*(cell+gap),y=oy+r*(cell+gap),cx=x+cell/2,cy=y+cell/2;if(this.voids.has(k))continue;
      const floorColor=(r+c)%2===0?0xc8bdae:0xaea295;
      this.board.add(this.add.rectangle(cx,cy,cell,cell,floorColor));
      if(this.blockers.has(k)){
        const obstacle=this.add.container(cx,cy);obstacle.add(this.add.rectangle(0,0,cell,cell,0x76543c));
        if(this.level.id===1)obstacle.add(this.add.image(0,0,'lab-stump').setDisplaySize(cell*.82,cell*.82));
        else if(this.level.id===48)obstacle.add(this.add.image(0,0,'lab-slime').setDisplaySize(cell*.76,cell*.76));
        else obstacle.add(text(this,0,0,this.special.get(k)||'障碍',22,'#fff'));this.board.add(obstacle);continue;
      }
      if(k===K(this.mother.r,this.mother.c)){this.board.add(motherPiece);continue}
      const v=this.grid[r][c];
      if(v){const piece=addPiece(v,cx,cy);finalPieces.set(k,piece);if(motions.length)piece.setAlpha(0);this.board.add(piece)}
      if(this.ice.has(k))this.board.add(this.add.image(cx,cy,'lab-ice').setDisplaySize(cell,cell).setAlpha(.9));
      const s=this.special.get(k);
      if(s==='锁链')this.board.add(this.add.image(cx,cy,'lab-chain').setDisplaySize(cell*.84,cell*.84));
      else if(s==='黏液')this.board.add(this.add.image(cx,cy,'lab-slime').setDisplaySize(cell*.72,cell*.72).setAlpha(.8));
      else if((s==='入口'||s==='出口')&&this.level.id>=11&&this.level.id<=13)this.board.add(this.add.image(cx,cy,'lab-portal').setDisplaySize(cell*.55,cell*.55).setAlpha(.75));
      else if(s)this.board.add(this.add.text(cx,cy-cell*.36,s,{fontSize:'16px',color:'#4b4037',backgroundColor:'#ffffffcc'}).setOrigin(.5));
    }
    if(motions.length){
      const spawnKeys=new Set(spawned.map(s=>K(s.r,s.c)));
      let remaining=motions.length,finished=false;const ghosts:Phaser.GameObjects.Container[]=[];
      const spray=(index=0)=>{
        if(index>=spawned.length){this.animating=false;return}
        const item=spawned[index],target=center(item.r,item.c),seed=addPiece(item.value,motherPos.x,motherPos.y).setScale(.35);
        this.board.add(seed);this.tweens.add({targets:motherPiece,scaleX:1.08,scaleY:.92,duration:90,yoyo:true,ease:'Sine.InOut'});
        const flight={t:0},controlX=(motherPos.x+target.x)/2,controlY=Math.min(motherPos.y,target.y)-cell*.65;
        this.tweens.add({targets:flight,t:1,duration:280,ease:'Sine.Out',onUpdate:()=>{
          const t=flight.t,u=1-t;seed.setPosition(u*u*motherPos.x+2*u*t*controlX+t*t*target.x,u*u*motherPos.y+2*u*t*controlY+t*t*target.y);seed.setScale(.35+.65*t);
        },onComplete:()=>{seed.destroy();finalPieces.get(K(item.r,item.c))?.setAlpha(1);spray(index+1)}});
      };
      const arrive=()=>{
        if(--remaining>0||finished)return;finished=true;finalPieces.forEach((piece,k)=>{if(!spawnKeys.has(k))piece.setAlpha(1)});
        this.tweens.add({targets:ghosts,alpha:0,duration:48,ease:'Linear',onComplete:()=>{ghosts.forEach(g=>g.destroy());spray()}});
      };
      const leading=(m:LabMotion)=>this.lastDir==='left'?m.fromC:this.lastDir==='right'?4-m.fromC:this.lastDir==='up'?m.fromR:4-m.fromR;
      for(const motion of motions){
        const from=center(motion.fromR,motion.fromC),ghost=addPiece(motion.value,from.x,from.y);ghosts.push(ghost);this.board.add(ghost);
        const path:Array<{x:number;y:number}>=[];let r=motion.fromR,c=motion.fromC;
        while(r!==motion.toR||c!==motion.toC){
          if(r<motion.toR)r++;else if(r>motion.toR)r--;else if(c<motion.toC)c++;else if(c>motion.toC)c--;
          path.push(center(r,c));
        }
        if(!path.length){arrive();continue}
        let index=0;const step=()=>{const point=path[index++];this.tweens.add({targets:ghost,x:point.x,y:point.y,duration:82,ease:'Sine.InOut',onComplete:()=>{if(index<path.length)step();else arrive()}})};
        this.time.delayedCall(leading(motion)*18,step);
      }
    }else this.animating=false;
    this.updateStatus();
    textCleanup(this);this.add.text(W/2,1425,'滑动棋盘观察机制变化',{fontSize:'28px',color:'#887e72'}).setOrigin(.5).setName('lab-hint');
    this.add.text(W/2,1815,VERSION,{fontSize:'22px',color:'#aaa095'}).setOrigin(.5).setName('lab-version');
  }
}
function movedBonus(n:number){return n*50}
function textCleanup(scene:Phaser.Scene){scene.children.getAll().filter(x=>x.name==='lab-hint'||x.name==='lab-version').forEach(x=>x.destroy())}

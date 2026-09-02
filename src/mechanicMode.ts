import Phaser from 'phaser';
import {MECHANIC_LEVELS,getMechanicLevel,type MechanicLevel} from './mechanicLevels';

const W=1080,H=1920,VERSION='v0.7.0-mechanic-lab';
type Dir='left'|'right'|'up'|'down';
const K=(r:number,c:number)=>r+','+c;
const parse=(k:string)=>k.split(',').map(Number) as [number,number];
const clone=(g:number[][])=>g.map(r=>[...r]);
const empty=(r=5,c=5)=>Array.from({length:r},()=>Array(c).fill(0));
const colors:Record<number,number>={0:0xcfc4b5,2:0xeee4da,4:0xede0c8,8:0xf2b179,16:0xf59563,32:0xf67c5f,64:0xf65e3b,128:0xedcf72,256:0xedcc61};

function text(s:Phaser.Scene,x:number,y:number,value:string,size:number,color='#5f574d'){
  return s.add.text(x,y,value,{fontFamily:'Arial,sans-serif',fontSize:size+'px',fontStyle:'bold',color,align:'center',wordWrap:{width:920}}).setOrigin(.5);
}
function btn(s:Phaser.Scene,x:number,y:number,w:number,label:string,fn:()=>void,enabled=true){
  const b=s.add.rectangle(x,y,w,82,enabled?0x75685b:0xc8bfb4).setInteractive(enabled?{useHandCursor:true}:undefined);
  const t=text(s,x,y,label,29,enabled?'#fff':'#91877b');if(enabled)b.on('pointerup',fn);return[b,t];
}
function mergeLine(values:number[],id:number){
  const a=values.filter(v=>v!==0),out:number[]=[];let gained=0,merges=0;
  if(id===31){
    for(let i=0;i<a.length;){if(a[i]>0&&a[i]===a[i+1]&&a[i]===a[i+2]){out.push(a[i]*2);gained+=a[i]*2;merges++;i+=3}else{out.push(a[i]);i++}}
    return{out,gained,merges};
  }
  for(let i=0;i<a.length;i++){
    const x=a[i],y=a[i+1];
    const wildcard=id===25&&(x===-1||y===-1)&&y!==undefined;
    const adjacent=id===36&&x>0&&y>0&&(x===y*2||y===x*2);
    const parity=id===35&&x>0&&y>0&&x===y&&Math.log2(x)%2===Math.log2(y)%2;
    const normal=x>0&&x===y&&id!==35;
    if(wildcard||adjacent||parity||normal){
      let v=wildcard?Math.max(x,y)*2:adjacent?Math.max(x,y)*2:id===37?x:x*2;
      out.push(v);gained+=Math.max(0,v);merges++;i++;
    }else out.push(x);
  }
  return{out,gained,merges};
}
function moveBoard(grid:number[][],dir:Dir,voids:Set<string>,fixed:Set<string>,id:number){
  const rows=grid.length,cols=grid[0].length,next=clone(grid),horizontal=dir==='left'||dir==='right',reverse=dir==='right'||dir==='down';
  const count=horizontal?rows:cols,length=horizontal?cols:rows;let gained=0,merges=0;
  for(let li=0;li<count;li++){
    const ps:Array<[number,number]>=Array.from({length},(_,i)=>horizontal?[li,i]:[i,li]);let start=0;
    for(let end=0;end<=length;end++){
      const boundary=end===length||voids.has(K(...ps[end]))||fixed.has(K(...ps[end]));
      if(!boundary)continue;const seg=ps.slice(start,end);let vals=seg.map(([r,c])=>grid[r][c]);if(reverse)vals.reverse();
      const m=mergeLine(vals,id);gained+=m.gained;merges+=m.merges;while(m.out.length<seg.length)m.out.push(0);if(reverse)m.out.reverse();
      seg.forEach(([r,c],i)=>next[r][c]=m.out[i]);start=end+1;
    }
  }
  return{grid:next,gained,merges,moved:JSON.stringify(grid)!==JSON.stringify(next)};
}

export class HomeScene extends Phaser.Scene{
  constructor(){super('home')}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');text(this,W/2,260,'2048 关卡实验室',82);text(this,W/2,360,'选择要进入的游戏模式',32,'#887e72');
    const a=this.add.rectangle(W/2,650,760,230,0x826f5d).setInteractive({useHandCursor:true});text(this,W/2,620,'机制测试关卡',48,'#fff');text(this,W/2,690,'50种机制 · 每种一关',29,'#eadfd2');a.on('pointerup',()=>this.scene.start('mechanic-select'));
    const b=this.add.rectangle(W/2,970,760,230,0xb17a4b).setInteractive({useHandCursor:true});text(this,W/2,940,'现有关卡模式',48,'#fff');text(this,W/2,1010,'保留原来的50关进度',29,'#f7e5d4');b.on('pointerup',()=>this.scene.start('levels'));
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
  special=new Map<string,string>();moves=0;score=0;combo=0;turn=0;gateTimer=0;nextValue=2;failed=false;
  board!:Phaser.GameObjects.Container;status!:Phaser.GameObjects.Text;touch?:Phaser.Math.Vector2;lastDir:Dir='left';
  constructor(){super('mechanic-test')}
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
    this.grid=empty();this.voids.clear();this.blockers.clear();this.ice.clear();this.special.clear();this.moves=this.level.moves;this.score=0;this.combo=0;this.turn=0;this.gateTimer=0;this.failed=false;this.nextValue=2;
    this.setup();this.render();
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
    const f=new Set([...this.blockers,...this.ice.keys()]);
    if(this.level.id===21||this.level.id===30||this.level.id===48)f.add(K(2,2));
    if(this.level.id===22&&this.turn%2===1)f.add(K(2,2));
    if(this.level.id===23&&this.turn%2===0)f.add(K(2,2));
    if(this.level.id===10&&(this.lastDir==='up'||this.lastDir==='down'))for(let c=0;c<5;c++)f.add(K(2,c));
    return f;
  }
  act(dir:Dir){
    if(this.moves<=0)return;this.lastDir=dir;const before=clone(this.grid),m=moveBoard(this.grid,dir,this.voids,this.fixed(),this.level.id);if(!m.moved)return;
    this.grid=m.grid;this.moves--;this.turn++;this.score+=m.gained;this.combo=m.merges?this.combo+1:0;this.effects(before,m.gained,m.merges,dir);
    const shouldSpawn=this.level.id!==45||m.merges>0;if(shouldSpawn)this.spawn(dir);if(this.level.id===46)this.spawn(dir);this.render();
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
  firstEmpty(){for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(!this.grid[r][c]&&!this.voids.has(K(r,c))&&!this.blockers.has(K(r,c)))return[r,c] as[number,number]}
  spawn(dir:Dir){
    const spots:Array<[number,number]>=[];for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(!this.grid[r][c]&&!this.voids.has(K(r,c))&&!this.blockers.has(K(r,c))){
      if(this.level.id===42&&!(r===4&&c===2))continue;
      if(this.level.id===44){if(dir==='left'&&c!==4||dir==='right'&&c!==0||dir==='up'&&r!==4||dir==='down'&&r!==0)continue}
      spots.push([r,c]);
    }
    if(!spots.length)return;const p=spots[(this.turn*7+this.level.id)%spots.length];
    const seq=this.level.id===47?[8,16,8,4]:this.level.id===41?[2,2,4,2]:[this.nextValue];this.grid[p[0]][p[1]]=this.level.id===48?-3:seq[this.turn%seq.length];
    if(this.level.id===48)this.blockers.add(K(p[0],p[1]));
  }
  render(){
    this.board.removeAll(true);const cell=142,gap=14,ox=115,oy=520;
    for(let r=0;r<5;r++)for(let c=0;c<5;c++){const k=K(r,c),x=ox+c*(cell+gap),y=oy+r*(cell+gap);if(this.voids.has(k))continue;
      const box=this.add.container(x+cell/2,y+cell/2);box.add(this.add.rectangle(0,0,cell,cell,0x9c8f80));
      if(this.blockers.has(k)){box.add(this.add.rectangle(0,0,cell-12,cell-12,0x76543c));box.add(text(this,0,0,this.special.get(k)||'障碍',22,'#fff'))}
      else{const v=this.grid[r][c];box.add(this.add.rectangle(0,0,cell-12,cell-12,colors[v]||0xb39e87));if(v){const name=v===-1?'万能':v===-2?'炸弹':v===-3?'污染':v===-4?'石化':v===-5?'幽灵':String(v);box.add(text(this,0,0,name,v<0?22:43,v>4?'#fff':'#655b51'))}
        if(this.ice.has(k))box.add(this.add.rectangle(0,0,cell-18,cell-18,0x8edcf2,.5).setStrokeStyle(6,0xe5fbff));
        const s=this.special.get(k);if(s&&!this.blockers.has(k))box.add(this.add.text(0,-cell*.36,s,{fontSize:'16px',color:'#4b4037',backgroundColor:'#ffffffcc'}).setOrigin(.5));
      }this.board.add(box);
    }
    const max=Math.max(...this.grid.flat());const done=this.level.id===33?max===this.level.target:max>=this.level.target;
    this.status.setText(`剩余 ${this.moves} 步\n分数 ${this.score}\n目标 ${this.level.target}\n${this.failed?'规则失败':done?'目标完成':''}${this.level.id===40?'\n连击 ×'+this.combo:''}${this.level.id===49?'\n下一个 '+this.nextValue:''}`);
    textCleanup(this);this.add.text(W/2,1425,'滑动棋盘观察机制变化',{fontSize:'28px',color:'#887e72'}).setOrigin(.5).setName('lab-hint');
    this.add.text(W/2,1815,VERSION,{fontSize:'22px',color:'#aaa095'}).setOrigin(.5).setName('lab-version');
  }
}
function movedBonus(n:number){return n*50}
function textCleanup(scene:Phaser.Scene){scene.children.getAll().filter(x=>x.name==='lab-hint'||x.name==='lab-version').forEach(x=>x.destroy())}

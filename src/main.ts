import Phaser from 'phaser';
import './style.css';
import {LEVELS,getLevel,type LevelConfig,type Pos} from './levels';
import {HomeScene,MechanicSelectScene,MechanicTestScene} from './mechanicMode';
import {move2048,hasLegalMove,chooseMotherCell,type TileTransition} from './core2048';

const APP_VERSION='v0.10.0-mother-spawn';
const TEST_UNLOCK_ALL=true;
const W=1080,H=1920;
type Direction='left'|'right'|'up'|'down';
type Motion=TileTransition;
type SpawnedTile=Pos&{value:number};
type AntState={revealed:boolean;rescued:boolean};
type Snapshot={
  grid:number[][];score:number;movesLeft:number;rngState:number;
  ice:[string,number][];orders:number[];ants:[string,AntState][];rescued:number;targetDone:boolean;
};
interface Progress{unlocked:number;stars:Record<number,number>}
const COLORS:Record<number,number>={0:0xcfc4b5,2:0xeee4da,4:0xe6d2b5,8:0xf2b179,16:0xf59563,32:0xf67c5f,64:0xe84a35,128:0xedcf72,256:0xe8bd48,512:0xd99b32,1024:0xc97932,2048:0xb85d2c,4096:0x9b5de5,8192:0x4f86d9,16384:0x28a99e};
const key=(r:number,c:number)=>r+','+c;
const parseKey=(k:string)=>k.split(',').map(Number) as [number,number];
const empty=(rows:number,cols=rows)=>Array.from({length:rows},()=>Array(cols).fill(0));
const clone=(g:number[][])=>g.map(r=>[...r]);
const loadProgress=():Progress=>{try{return {...{unlocked:1,stars:{}},...JSON.parse(localStorage.getItem('phaser2048-level-progress')||'{}')}}catch{return {unlocked:1,stars:{}}}};
const saveProgress=(p:Progress)=>localStorage.setItem('phaser2048-level-progress',JSON.stringify(p));


function label(scene:Phaser.Scene,x:number,y:number,text:string,size:number,color='#5f574d'){
  return scene.add.text(x,y,text,{fontFamily:'Arial, sans-serif',fontSize:size+'px',fontStyle:'bold',color,align:'center'}).setOrigin(.5);
}
function button(scene:Phaser.Scene,x:number,y:number,w:number,h:number,text:string,action:()=>void,enabled=true){
  const bg=scene.add.rectangle(x,y,w,h,enabled?0x75685b:0xc7bdb1).setInteractive(enabled?{useHandCursor:true}:undefined);
  const tx=label(scene,x,y,text,34,enabled?'#fff':'#8f8579');
  if(enabled){bg.on('pointerdown',()=>scene.tweens.add({targets:[bg,tx],scale:.95,duration:60}));bg.on('pointerup',()=>{bg.setScale(1);tx.setScale(1);action()});bg.on('pointerout',()=>{bg.setScale(1);tx.setScale(1)})}
  return [bg,tx];
}

class LevelScene extends Phaser.Scene{
  constructor(){super('levels')}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');const p=loadProgress();
    button(this,105,78,170,78,'‹ 主页',()=>this.scene.start('home'));
    label(this,W/2,100,'关卡',76);this.add.text(W/2,170,'每十关解锁一种新机制',{fontSize:'29px',color:'#887e72'}).setOrigin(.5);
    for(let chapter=0;chapter<5;chapter++)for(let i=0;i<10;i++){
      const level=LEVELS[chapter*10+i],col=i%5,row=Math.floor(i/5)+chapter*2,x=130+col*205,y=320+row*150;
      const open=TEST_UNLOCK_ALL||level.id<=p.unlocked,bg=this.add.rectangle(x,y,154,118,open?0x9b8b7a:0xd3cbc1).setInteractive(open?{useHandCursor:true}:undefined);
      label(this,x,y-15,open?String(level.id):'锁',38,open?'#fff':'#90877e');
      const stars=p.stars[level.id]||0;this.add.text(x,y+32,open?'★'.repeat(stars)+'☆'.repeat(3-stars):'',{fontSize:'22px',color:'#ffe08a'}).setOrigin(.5);
      if(open)bg.on('pointerup',()=>this.scene.start('game',{levelId:level.id}));
    }
    this.add.text(W/2,1785,'测试模式 · 全部关卡已解锁',{fontSize:'30px',color:'#887e72'}).setOrigin(.5);
    this.add.text(W/2,1850,APP_VERSION,{fontSize:'24px',color:'#aaa095'}).setOrigin(.5);
  }
}

class GameScene extends Phaser.Scene{
  config!:LevelConfig;grid:number[][]=[];score=0;movesLeft=0;rngState=1;previous:Snapshot|null=null;
  blockers=new Set<string>();voids=new Set<string>();ice=new Map<string,number>();orders:number[]=[];ants=new Map<string,AntState>();
  rescued=0;targetDone=false;board!:Phaser.GameObjects.Container;movesText!:Phaser.GameObjects.Text;scoreText!:Phaser.GameObjects.Text;
  objectiveText!:Phaser.GameObjects.Text;start?:Phaser.Math.Vector2;overlay?:Phaser.GameObjects.Container;lastDir:Direction='left';animating=false;mother:Pos={r:0,c:0};
  readonly bx=90;readonly by=600;readonly boardSize=900;readonly gap=0;
  constructor(){super('game')}
  preload(){
    this.load.svg('art-stump','./assets/stump.svg');
    this.load.svg('art-ice','./assets/ice.svg');
    this.load.svg('art-ant','./assets/ant.svg');
  }
  init(data:{levelId?:number}){this.config=getLevel(data.levelId||1)}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');this.add.text(W-35,H-25,APP_VERSION,{fontSize:'21px',color:'#aaa095'}).setOrigin(1,.5);
    button(this,90,75,150,86,'‹ 关卡',()=>this.scene.start('levels'));
    label(this,430,96,`第 ${this.config.id} 关`,48);
    button(this,775,75,150,82,'上一关',()=>this.scene.restart({levelId:this.config.id-1}),this.config.id>1);
    button(this,950,75,150,82,'下一关',()=>this.scene.restart({levelId:this.config.id+1}),this.config.id<50);
    this.add.text(W/2,150,this.config.title,{fontSize:'27px',color:'#8b8175'}).setOrigin(.5);
    this.card(90,235,280,'机制',this.mechanicName());this.card(400,235,280,'剩余步数','0',true);this.card(710,235,280,'分数','0',false,true);
    button(this,90,420,260,95,'↶ 撤销',()=>this.undo());button(this,730,420,260,95,'重新开始',()=>this.restart());
    this.board=this.add.container();this.objectiveText=this.add.text(W/2,1560,'',{fontSize:'31px',fontStyle:'bold',color:'#6f655a',align:'center',lineSpacing:12,wordWrap:{width:900}}).setOrigin(.5,0);
    this.input.keyboard?.on('keydown',(e:KeyboardEvent)=>{
      const m:Record<string,Direction>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
      if(m[e.key]){e.preventDefault();this.move(m[e.key])}
    });
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.start=new Phaser.Math.Vector2(p.x,p.y));
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{
      if(!this.start||this.overlay||this.animating)return;const dx=p.x-this.start.x,dy=p.y-this.start.y;this.start=undefined;if(Math.max(Math.abs(dx),Math.abs(dy))<45)return;
      this.move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
    });this.restart();
  }
  card(x:number,y:number,w:number,title:string,value:string,moves=false,score=false){
    this.add.rectangle(x,y,w,135,0x938575).setOrigin(0);this.add.text(x+w/2,y+22,title,{fontSize:'26px',fontStyle:'bold',color:'#ded5c9'}).setOrigin(.5,0);
    const t=this.add.text(x+w/2,y+61,value,{fontSize:value.length>5?'29px':'42px',fontStyle:'bold',color:'#fff'}).setOrigin(.5,0);
    if(moves)this.movesText=t;if(score)this.scoreText=t;
  }
  mechanicName(){let name=this.config.ants?'蚂蚁':this.config.orders?'订单':this.config.ice?'冰块':this.config.blockers?'树桩':'合成';if(this.config.voids)name+='·异形';return (this.config.boardCols||this.config.boardSize)+'×'+(this.config.boardRows||this.config.boardSize)+' '+name}
  fixed(){return new Set([...this.blockers,...this.voids,...this.ice.keys(),key(this.mother.r,this.mother.c)])}
  random(){let t=this.rngState+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
  restart(){
    this.hideOverlay();const rows=this.config.boardRows||this.config.boardSize,cols=this.config.boardCols||this.config.boardSize;this.grid=empty(rows,cols);this.score=0;this.movesLeft=this.config.moveLimit;this.rngState=this.config.seed;this.previous=null;
    this.blockers=new Set((this.config.blockers||[]).map(p=>key(p.r,p.c)));this.voids=new Set((this.config.voids||[]).map(p=>key(p.r,p.c)));this.ice=new Map();this.orders=[...(this.config.orders||[])];this.ants=new Map();this.rescued=0;this.targetDone=false;
    for(const p of this.config.ice||[]){this.grid[p.r][p.c]=p.value;this.ice.set(key(p.r,p.c),p.layers)}
    for(const p of this.config.ants||[])this.ants.set(key(p.r,p.c),{revealed:false,rescued:false});
    this.mother=chooseMotherCell(rows,cols,new Set([...this.blockers,...this.voids,...this.ice.keys(),...this.ants.keys()]));
    this.addRandom();this.addRandom();
    for(const [k,a] of this.ants){const [r,c]=parseKey(k);if(!this.grid[r][c]&&!this.blockers.has(k)&&!this.voids.has(k)&&!this.ice.has(k))this.grid[r][c]=2}
    this.render(false);
  }
  addRandom():SpawnedTile|null{
    const spots:Pos[]=[];this.grid.forEach((row,r)=>row.forEach((v,c)=>{
      const k=key(r,c),ant=this.ants.get(k);if(!v&&k!==key(this.mother.r,this.mother.c)&&!this.blockers.has(k)&&!this.voids.has(k)&&!this.ice.has(k)&&!(ant?.revealed&&!ant.rescued))spots.push({r,c});
    }));
    if(!spots.length)return null;
    const p=spots[Math.floor(this.random()*spots.length)],value=this.random()<.9?2:4;this.grid[p.r][p.c]=value;return {...p,value};
  }
  snapshot():Snapshot{return {grid:clone(this.grid),score:this.score,movesLeft:this.movesLeft,rngState:this.rngState,ice:[...this.ice],orders:[...this.orders],ants:[...this.ants].map(([k,v])=>[k,{...v}]),rescued:this.rescued,targetDone:this.targetDone}}
  move(dir:Direction){
    if(this.overlay||this.animating)return;const before=clone(this.grid),result=move2048(this.grid,dir,this.fixed());if(!result.moved)return;
    this.animating=true;
    this.lastDir=dir;
    this.previous=this.snapshot();this.grid=result.grid;this.score+=result.score;this.movesLeft--;
    if(this.config.target&&this.grid.some(r=>r.some(v=>v>=this.config.target!)))this.targetDone=true;
    this.thawIce(before,result.score);this.collectOrders();this.updateAnts(before);
    const spawned=this.addRandom(),complete=this.isComplete(),lost=this.movesLeft<=0||!hasLegalMove(this.grid,this.fixed());
    this.render(true,result.transitions,spawned,result.mergedCells,()=>{if(complete)this.complete();else if(lost)this.showResult(false,0)});
  }
  thawIce(before:number[][],gained:number){
    if(!gained)return;const changed=(r:number,c:number)=>before[r]?.[c]!==this.grid[r]?.[c];
    for(const [k,layers] of [...this.ice]){const [r,c]=parseKey(k),near=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].some(([a,b])=>a>=0&&b>=0&&a<this.grid.length&&b<this.grid[0].length&&changed(a,b));
      if(near){if(layers<=1)this.ice.delete(k);else this.ice.set(k,layers-1)}
    }
  }
  collectOrders(){
    for(let i=0;i<this.orders.length;){const wanted=this.orders[i];let found=false;
      for(let r=0;r<this.grid.length&&!found;r++)for(let c=0;c<this.grid.length;c++)if(this.grid[r][c]===wanted&&!this.ice.has(key(r,c))){
        this.grid[r][c]=0;this.orders.splice(i,1);found=true;break;
      }
      if(!found)i++;
    }
  }
  updateAnts(before:number[][]){
    for(const [k,state] of this.ants){if(state.rescued)continue;const [r,c]=parseKey(k);
      if(!state.revealed&&before[r][c]>0&&this.grid[r][c]===0)state.revealed=true;
      if(state.revealed&&this.hasExit(r,c)){state.rescued=true;this.rescued++}
    }
  }
  hasExit(r:number,c:number){
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    return dirs.some(([dr,dc])=>{let a=r,b=c;while(true){a+=dr;b+=dc;if(a<0||b<0||a>=this.grid.length||b>=this.grid[0].length)return true;const k=key(a,b);if(k===key(this.mother.r,this.mother.c)||this.grid[a][b]||this.blockers.has(k)||this.voids.has(k)||this.ice.has(k))return false}});
  }
  isComplete(){
    const targetOk=!this.config.target||this.targetDone,ordersOk=!this.config.orders||this.orders.length===0,iceOk=!this.config.clearIce||this.ice.size===0,antsOk=!this.config.rescueAnts||this.rescued>=this.config.rescueAnts;
    return targetOk&&ordersOk&&iceOk&&antsOk;
  }
  undo(){
    if(!this.previous||this.overlay)return;const s=this.previous;this.grid=clone(s.grid);this.score=s.score;this.movesLeft=s.movesLeft;this.rngState=s.rngState;
    this.ice=new Map(s.ice);this.orders=[...s.orders];this.ants=new Map(s.ants.map(([k,v])=>[k,{...v}]));this.rescued=s.rescued;this.targetDone=s.targetDone;this.previous=null;this.render(true);
  }
  objectiveLines(){
    const lines:string[]=[];
    if(this.config.target)lines.push(`${this.targetDone?'✓':'○'} 合成 ${this.config.target}`);
    if(this.config.orders){const done=this.config.orders.length-this.orders.length;lines.push(`${!this.orders.length?'✓':'○'} 完成订单 ${done}/${this.config.orders.length}　剩余：${this.orders.join('、')||'无'}`)}
    if(this.config.clearIce)lines.push(`${!this.ice.size?'✓':'○'} 清除全部冰块（剩余 ${this.ice.size}）`);
    if(this.config.rescueAnts)lines.push(`${this.rescued>=this.config.rescueAnts?'✓':'○'} 放出蚂蚁 ${this.rescued}/${this.config.rescueAnts}`);
    return lines.join('\n');
  }
  render(animate:boolean,motions:Motion[]=[],spawned:SpawnedTile|null=null,mergedCells:Array<{r:number;c:number;value:number}>=[],onDone?:()=>void){
    this.board.removeAll(true);
    const rows=this.grid.length,cols=this.grid[0].length;
    const cell=Math.min((this.boardSize-this.gap*(cols+1))/cols,(this.boardSize-this.gap*(rows+1))/rows);
    const actualW=cols*cell+(cols+1)*this.gap,actualH=rows*cell+(rows+1)*this.gap;
    const ox=this.bx+(this.boardSize-actualW)/2,oy=this.by+(this.boardSize-actualH)/2;
    const center=(r:number,c:number)=>({x:ox+this.gap+c*(cell+this.gap)+cell/2,y:oy+this.gap+r*(cell+this.gap)+cell/2});
    const makePiece=(v:number,x:number,y:number)=>{
      const piece=this.add.container(x,y);
      piece.add(this.add.rectangle(0,0,cell,cell,COLORS[v]||0x3c3a32));
      const digits=String(v).length;
      piece.add(this.add.text(0,2,String(v),{fontFamily:'Arial Black',fontSize:(digits<3?Math.min(88,cell*.38):Math.min(70,cell*.3))+'px',color:v<=4?'#776e65':'#fff'}).setOrigin(.5));
      return piece;
    };
    const motherPos=center(this.mother.r,this.mother.c),motherPiece=this.add.container(motherPos.x,motherPos.y);
    motherPiece.add(this.add.rectangle(0,0,cell,cell,0x72549a));
    motherPiece.add(this.add.circle(0,0,cell*.29,0xf3d58f));
    motherPiece.add(this.add.circle(-cell*.15,-cell*.12,cell*.07,0xfff2c7));
    motherPiece.add(this.add.circle(cell*.15,-cell*.12,cell*.07,0xfff2c7));
    motherPiece.add(this.add.text(0,cell*.08,'母',{fontFamily:'Arial,sans-serif',fontSize:Math.min(54,cell*.28)+'px',fontStyle:'bold',color:'#5b3e77'}).setOrigin(.5));
    const finalPieces=new Map<string,Phaser.GameObjects.Container>();
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const k=key(r,c),p=center(r,c);if(this.voids.has(k))continue;
      const floorColor=(r+c)%2===0?0xc8bdae:0xaea295;
      this.board.add(this.add.rectangle(p.x,p.y,cell,cell,floorColor));
      if(this.blockers.has(k)){
        const stump=this.add.container(p.x,p.y);
        stump.add(this.add.rectangle(0,0,cell,cell,0x79543a));
        stump.add(this.add.image(0,0,'art-stump').setDisplaySize(cell*.88,cell*.88));this.board.add(stump);continue;
      }
      if(k===key(this.mother.r,this.mother.c)){this.board.add(motherPiece);continue}
      const ant=this.ants.get(k);
      if(ant?.revealed&&!ant.rescued&&!this.grid[r][c])this.board.add(this.add.image(p.x,p.y,'art-ant').setDisplaySize(cell*.62,cell*.62));
      const v=this.grid[r][c];
      if(v){const piece=makePiece(v,p.x,p.y);finalPieces.set(k,piece);this.board.add(piece)}
      if(this.ice.has(k)){
        const ice=this.add.image(p.x,p.y,'art-ice').setDisplaySize(cell-7,cell-7).setAlpha(.9);this.board.add(ice);
        if(this.ice.get(k)===2)this.board.add(label(this,p.x+cell*.3,p.y-cell*.31,'2',Math.min(30,cell*.15),'#fff'));
      }
    }
    if(animate&&motions.length){
      const spawnKey=spawned?key(spawned.r,spawned.c):null;
      const hidden=new Set(motions.map(m=>key(m.toR,m.toC)));if(spawnKey)hidden.add(spawnKey);
      hidden.forEach(k=>finalPieces.get(k)?.setAlpha(0));
      const ghosts:Phaser.GameObjects.Container[]=[];let remaining=0,finished=false;
      const finish=()=>{this.animating=false;onDone?.()};
      const spray=()=>{
        if(!spawned){finish();return}
        const target=center(spawned.r,spawned.c),seed=makePiece(spawned.value,motherPos.x,motherPos.y).setScale(.35);
        this.board.add(seed);this.tweens.add({targets:motherPiece,scaleX:1.08,scaleY:.92,duration:90,yoyo:true,ease:'Sine.InOut'});
        const flight={t:0},controlX=(motherPos.x+target.x)/2,controlY=Math.min(motherPos.y,target.y)-cell*.65;
        this.tweens.add({targets:flight,t:1,duration:280,ease:'Sine.Out',onUpdate:()=>{
          const t=flight.t,u=1-t;seed.setPosition(u*u*motherPos.x+2*u*t*controlX+t*t*target.x,u*u*motherPos.y+2*u*t*controlY+t*t*target.y);seed.setScale(.35+.65*t);
        },onComplete:()=>{seed.destroy();finalPieces.get(spawnKey!)?.setAlpha(1);finish()}});
      };
      const reveal=()=>{
        if(finished)return;finished=true;
        hidden.forEach(k=>{if(k!==spawnKey)finalPieces.get(k)?.setAlpha(1)});
        for(const m of mergedCells)finalPieces.get(key(m.r,m.c))?.setAlpha(1);
        this.tweens.add({targets:ghosts,alpha:0,duration:48,ease:'Linear',onComplete:()=>{
          ghosts.forEach(g=>g.destroy());spray();
        }});
      };
      for(const motion of motions){
        const from=center(motion.fromR,motion.fromC),to=center(motion.toR,motion.toC),ghost=makePiece(motion.value,from.x,from.y);ghosts.push(ghost);this.board.add(ghost);
        const distance=Math.abs(motion.toR-motion.fromR)+Math.abs(motion.toC-motion.fromC);
        if(!distance)continue;remaining++;
        this.tweens.add({targets:ghost,x:to.x,y:to.y,duration:Math.min(360,75+distance*48),ease:'Sine.Out',onComplete:()=>{if(--remaining===0)reveal()}});
      }
      if(!remaining)this.time.delayedCall(90,reveal);
    }else{this.animating=false;onDone?.()}

    this.movesText.setText(String(this.movesLeft));this.scoreText.setText(String(this.score));this.objectiveText.setText(this.objectiveLines());
  }
  complete(){
    const ratio=this.movesLeft/this.config.moveLimit,stars=ratio>=.45?3:ratio>=.2?2:1,p=loadProgress();p.unlocked=Math.max(p.unlocked,Math.min(50,this.config.id+1));p.stars[this.config.id]=Math.max(p.stars[this.config.id]||0,stars);saveProgress(p);this.showResult(true,stars);
  }
  showResult(win:boolean,stars:number){
    const o=this.add.container().setDepth(30);o.add(this.add.rectangle(0,0,W,H,0xf6f1e8,.94).setOrigin(0).setInteractive());
    const title=label(this,W/2,650,win?'过关！':'挑战失败',72);o.add(title);
    const detail=this.add.text(W/2,755,win?'★'.repeat(stars)+'☆'.repeat(3-stars):'目标还没有全部完成',{fontSize:win?'82px':'32px',color:win?'#f0b83f':'#887e72'}).setOrigin(.5);o.add(detail);
    const controls=win&&this.config.id<50?button(this,W/2,930,470,115,'下一关',()=>this.scene.restart({levelId:this.config.id+1})):button(this,W/2,930,470,115,'再试一次',()=>this.restart());o.add(controls);
    o.add(button(this,W/2,1080,470,105,'返回关卡',()=>this.scene.start('levels')));this.overlay=o;
  }
  hideOverlay(){this.overlay?.destroy();this.overlay=undefined}
}

new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#f6f1e8',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},render:{antialias:true},scene:[HomeScene,MechanicSelectScene,MechanicTestScene,LevelScene,GameScene],input:{activePointers:2}});

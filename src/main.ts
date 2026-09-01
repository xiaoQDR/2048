import Phaser from 'phaser';
import './style.css';
import { LEVELS, getLevel, type LevelConfig } from './levels';

const APP_VERSION='v0.2.1-test';
const TEST_UNLOCK_ALL=true;

type Direction='left'|'right'|'up'|'down';
type Snapshot={grid:number[][];score:number;movesLeft:number;rngState:number};
const W=1080,H=1920;
const COLORS:Record<number,number>={0:0xcfc4b5,2:0xeee4da,4:0xede0c8,8:0xf2b179,16:0xf59563,32:0xf67c5f,64:0xf65e3b,128:0xedcf72,256:0xedcc61,512:0xedc850,1024:0xedc53f,2048:0xedc22e};
const progressKey='phaser2048-level-progress';
interface Progress{unlocked:number;stars:Record<number,number>}
const loadProgress=():Progress=>{try{return {...{unlocked:1,stars:{}},...JSON.parse(localStorage.getItem(progressKey)||'{}')}}catch{return {unlocked:1,stars:{}}}};
const saveProgress=(p:Progress)=>localStorage.setItem(progressKey,JSON.stringify(p));
const empty=(n:number)=>Array.from({length:n},()=>Array(n).fill(0));
const clone=(g:number[][])=>g.map(r=>[...r]);

function collapse(line:number[],size:number){
  const values=line.filter(Boolean),out:number[]=[];let gained=0;
  for(let i=0;i<values.length;i++){
    if(values[i]===values[i+1]){const v=values[i]*2;out.push(v);gained+=v;i++}else out.push(values[i]);
  }
  while(out.length<size)out.push(0);
  return {line:out,gained};
}
function moveGrid(grid:number[][],dir:Direction){
  const size=grid.length,next=empty(size);let gained=0;
  for(let i=0;i<size;i++){
    let line=(dir==='left'||dir==='right')?[...grid[i]]:grid.map(r=>r[i]);
    if(dir==='right'||dir==='down')line.reverse();
    const result=collapse(line,size);gained+=result.gained;
    if(dir==='right'||dir==='down')result.line.reverse();
    for(let j=0;j<size;j++){
      if(dir==='left'||dir==='right')next[i][j]=result.line[j];else next[j][i]=result.line[j];
    }
  }
  return {grid:next,gained,moved:JSON.stringify(grid)!==JSON.stringify(next)};
}
function canMove(g:number[][]){
  const n=g.length;if(g.some(r=>r.includes(0)))return true;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if((c<n-1&&g[r][c]===g[r][c+1])||(r<n-1&&g[r][c]===g[r+1][c]))return true;
  return false;
}
function addLabel(scene:Phaser.Scene,x:number,y:number,text:string,size:number,color='#5f574d'){
  return scene.add.text(x,y,text,{fontFamily:'Arial, sans-serif',fontSize:size+'px',fontStyle:'bold',color}).setOrigin(.5);
}
function button(scene:Phaser.Scene,x:number,y:number,w:number,h:number,label:string,action:()=>void,enabled=true){
  const bg=scene.add.rectangle(x,y,w,h,enabled?0x75685b:0xc7bdb1).setInteractive(enabled?{useHandCursor:true}:undefined);
  const tx=addLabel(scene,x,y,label,34,enabled?'#ffffff':'#8f8579');
  if(enabled){bg.on('pointerdown',()=>scene.tweens.add({targets:[bg,tx],scale:.95,duration:60}));bg.on('pointerup',()=>{bg.setScale(1);tx.setScale(1);action()});bg.on('pointerout',()=>{bg.setScale(1);tx.setScale(1)})}
  return [bg,tx];
}

class LevelScene extends Phaser.Scene{
  constructor(){super('levels')}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');const p=loadProgress();
    addLabel(this,W/2,110,'关卡',78);
    this.add.text(W/2,180,'完成目标数字，解锁下一关',{fontSize:'30px',color:'#887e72'}).setOrigin(.5);
    for(let chapter=0;chapter<5;chapter++){
      const start=chapter*10;
      for(let i=0;i<10;i++){
        const level=LEVELS[start+i],col=i%5,row=Math.floor(i/5)+chapter*2;
        const x=130+col*205,y=330+row*150,open=TEST_UNLOCK_ALL||level.id<=p.unlocked;
        const bg=this.add.rectangle(x,y,154,118,open?0x9b8b7a:0xd3cbc1).setInteractive(open?{useHandCursor:true}:undefined);
        addLabel(this,x,y-15,open?String(level.id):'🔒',38,open?'#fff':'#90877e');
        const stars=p.stars[level.id]||0;
        this.add.text(x,y+32,open?('★'.repeat(stars)+'☆'.repeat(3-stars)):'',{fontSize:'22px',color:'#ffe08a'}).setOrigin(.5);
        if(open)bg.on('pointerup',()=>this.scene.start('game',{levelId:level.id}));
      }
    }
    this.add.text(W/2,1785,TEST_UNLOCK_ALL?'测试模式 · 全部关卡已解锁':`已解锁 ${Math.min(p.unlocked,50)} / 50`,{fontSize:'30px',color:'#887e72'}).setOrigin(.5);
    this.add.text(W/2,1850,APP_VERSION,{fontSize:'24px',color:'#aaa095'}).setOrigin(.5);
  }
}

class GameScene extends Phaser.Scene{
  config!:LevelConfig;grid:number[][]=[];score=0;movesLeft=0;previous:Snapshot|null=null;rngState=1;
  board!:Phaser.GameObjects.Container;scoreText!:Phaser.GameObjects.Text;movesText!:Phaser.GameObjects.Text;
  start?:Phaser.Math.Vector2;overlay?:Phaser.GameObjects.Container;
  readonly bx=90;readonly by=620;readonly boardSize=900;readonly gap=20;
  constructor(){super('game')}
  init(data:{levelId?:number}){this.config=getLevel(data.levelId||1)}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');
    this.add.text(W-40,H-32,APP_VERSION,{fontSize:'22px',color:'#aaa095'}).setOrigin(1,.5).setDepth(50);
    button(this,90,90,150,90,'‹ 关卡',()=>this.scene.start('levels'));
    addLabel(this,W/2,112,`第 ${this.config.id} 关`,52);
    this.add.text(W/2,172,this.config.title,{fontSize:'27px',color:'#8b8175'}).setOrigin(.5);
    this.card(90,270,280,'目标',String(this.config.target),false);
    this.card(400,270,280,'剩余步数','0',true);
    this.card(710,270,280,'分数','0',false,true);
    button(this,90,455,260,100,'↶ 撤销',()=>this.undo());
    button(this,730,455,260,100,'重新开始',()=>this.restart());
    this.board=this.add.container();
    this.input.keyboard?.on('keydown',(e:KeyboardEvent)=>{
      const m:Record<string,Direction>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
      if(m[e.key]){e.preventDefault();this.move(m[e.key])}
    });
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.start=new Phaser.Math.Vector2(p.x,p.y));
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{
      if(!this.start||this.overlay)return;const dx=p.x-this.start.x,dy=p.y-this.start.y;this.start=undefined;
      if(Math.max(Math.abs(dx),Math.abs(dy))<45)return;
      this.move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
    });
    this.restart();
  }
  card(x:number,y:number,w:number,label:string,value:string,moves=false,score=false){
    this.add.rectangle(x,y,w,135,0x938575).setOrigin(0);
    this.add.text(x+w/2,y+24,label,{fontSize:'27px',fontStyle:'bold',color:'#ded5c9'}).setOrigin(.5,0);
    const t=this.add.text(x+w/2,y+62,value,{fontSize:'43px',fontStyle:'bold',color:'#fff'}).setOrigin(.5,0);
    if(moves)this.movesText=t;if(score)this.scoreText=t;
  }
  random(){let t=this.rngState+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
  restart(){this.hideOverlay();this.grid=empty(this.config.boardSize);this.score=0;this.movesLeft=this.config.moveLimit;this.previous=null;this.rngState=this.config.seed;this.addRandom();this.addRandom();this.render(false)}
  addRandom(){
    const spots:{r:number;c:number}[]=[];this.grid.forEach((row,r)=>row.forEach((v,c)=>{if(!v)spots.push({r,c})}));
    if(!spots.length)return;const p=spots[Math.floor(this.random()*spots.length)];this.grid[p.r][p.c]=this.random()<.9?2:4;
  }
  move(dir:Direction){
    if(this.overlay)return;const result=moveGrid(this.grid,dir);if(!result.moved)return;
    this.previous={grid:clone(this.grid),score:this.score,movesLeft:this.movesLeft,rngState:this.rngState};
    this.grid=result.grid;this.score+=result.gained;this.movesLeft--;this.addRandom();this.render(true);
    if(this.grid.some(r=>r.some(v=>v>=this.config.target)))this.complete();
    else if(this.movesLeft<=0||!canMove(this.grid))this.showResult(false,0);
  }
  undo(){if(!this.previous||this.overlay)return;this.grid=clone(this.previous.grid);this.score=this.previous.score;this.movesLeft=this.previous.movesLeft;this.rngState=this.previous.rngState;this.previous=null;this.render(true)}
  render(animate:boolean){
    this.board.removeAll(true);const n=this.config.boardSize,cell=(this.boardSize-this.gap*(n+1))/n;
    this.board.add(this.add.rectangle(this.bx,this.by,this.boardSize,this.boardSize,0x9c8f80).setOrigin(0));
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      const x=this.bx+this.gap+c*(cell+this.gap),y=this.by+this.gap+r*(cell+this.gap),v=this.grid[r][c];
      const tile=this.add.container(x+cell/2,y+cell/2);tile.add(this.add.rectangle(0,0,cell,cell,COLORS[v]||0x3c3a32));
      if(v){const digits=String(v).length;tile.add(this.add.text(0,2,String(v),{fontFamily:'Arial Black',fontSize:(digits<3?Math.min(88,cell*.38):Math.min(70,cell*.3))+'px',color:v<=4?'#776e65':'#fff'}).setOrigin(.5))}
      this.board.add(tile);if(animate&&v){tile.setScale(.85);this.tweens.add({targets:tile,scale:1,duration:120,ease:'Back.Out'})}
    }
    this.movesText.setText(String(this.movesLeft));this.scoreText.setText(String(this.score));
    this.children.getAll().filter(o=>o.name==='hint').forEach(o=>o.destroy());
    this.add.text(W/2,1600,`在 ${this.config.moveLimit} 步内合成 ${this.config.target}`,{fontSize:'35px',fontStyle:'bold',color:'#6f655a'}).setOrigin(.5).setName('hint');
  }
  complete(){
    const ratio=this.movesLeft/this.config.moveLimit,stars=ratio>=.45?3:ratio>=.2?2:1,p=loadProgress();
    p.unlocked=Math.max(p.unlocked,Math.min(50,this.config.id+1));p.stars[this.config.id]=Math.max(p.stars[this.config.id]||0,stars);saveProgress(p);
    this.showResult(true,stars);
  }
  showResult(win:boolean,stars:number){
    const o=this.add.container().setDepth(30);o.add(this.add.rectangle(0,0,W,H,0xf6f1e8,.93).setOrigin(0).setInteractive());
    addLabel(this,W/2,650,win?'过关！':'挑战失败',72);
    if(win)this.add.text(W/2,755,'★'.repeat(stars)+'☆'.repeat(3-stars),{fontSize:'82px',color:'#f0b83f'}).setOrigin(.5);
    else this.add.text(W/2,755,'步数用完了，再调整一下合成路线',{fontSize:'30px',color:'#887e72'}).setOrigin(.5);
    const controls=win&&this.config.id<50?button(this,W/2,930,470,115,'下一关',()=>this.scene.restart({levelId:this.config.id+1})):button(this,W/2,930,470,115,'再试一次',()=>this.restart());
    o.add(controls);o.add(button(this,W/2,1080,470,105,'返回关卡',()=>this.scene.start('levels')));this.overlay=o;
  }
  hideOverlay(){this.overlay?.destroy();this.overlay=undefined}
}

new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#f6f1e8',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},render:{antialias:true},scene:[LevelScene,GameScene],input:{activePointers:2}});

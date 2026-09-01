import Phaser from 'phaser';
import './style.css';

type Direction = 'left'|'right'|'up'|'down';
type Snapshot = { grid:number[][]; score:number };
type MoveResult = { grid:number[][]; score:number; moved:boolean };

const W=1080, H=1920, SIZE=4;
const COLORS:Record<number,number>={
  0:0xcfc4b5,2:0xeee4da,4:0xede0c8,8:0xf2b179,16:0xf59563,
  32:0xf67c5f,64:0xf65e3b,128:0xedcf72,256:0xedcc61,
  512:0xedc850,1024:0xedc53f,2048:0xedc22e
};
const empty=()=>Array.from({length:SIZE},()=>Array(SIZE).fill(0));
const clone=(g:number[][])=>g.map(r=>[...r]);

function collapse(line:number[]){
  const a=line.filter(Boolean), out:number[]=[]; let gained=0;
  for(let i=0;i<a.length;i++){
    if(a[i]===a[i+1]){const v=a[i]*2;out.push(v);gained+=v;i++}else out.push(a[i]);
  }
  while(out.length<SIZE)out.push(0);
  return {line:out,gained};
}
function moveGrid(grid:number[][],dir:Direction):MoveResult{
  const next=empty();let score=0;
  for(let i=0;i<SIZE;i++){
    let line:number[];
    if(dir==='left'||dir==='right') line=[...grid[i]];
    else line=grid.map(r=>r[i]);
    if(dir==='right'||dir==='down')line.reverse();
    const c=collapse(line);score+=c.gained;
    if(dir==='right'||dir==='down')c.line.reverse();
    for(let j=0;j<SIZE;j++){
      if(dir==='left'||dir==='right')next[i][j]=c.line[j];
      else next[j][i]=c.line[j];
    }
  }
  return {grid:next,score,moved:JSON.stringify(grid)!==JSON.stringify(next)};
}
function canMove(g:number[][]){
  if(g.some(r=>r.includes(0)))return true;
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)
    if((c<3&&g[r][c]===g[r][c+1])||(r<3&&g[r][c]===g[r+1][c]))return true;
  return false;
}

class GameScene extends Phaser.Scene{
  grid=empty();score=0;best=0;previous:Snapshot|null=null;
  board!:Phaser.GameObjects.Container; scoreText!:Phaser.GameObjects.Text;
  bestText!:Phaser.GameObjects.Text; overlay?:Phaser.GameObjects.Container;
  start?:Phaser.Math.Vector2; won=false;
  readonly bx=90; readonly by=570; readonly boardSize=900; readonly gap=20;
  get cell(){return (this.boardSize-this.gap*5)/4}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');
    this.add.text(90,130,'2048',{fontFamily:'Arial Black',fontSize:'126px',color:'#5f574d'});
    this.add.text(94,270,'滑动方块，合成 2048',{fontSize:'36px',color:'#857b6e'});
    this.makeScoreCard(630,120,'分数',false);this.makeScoreCard(835,120,'最高',true);
    this.makeButton(90,390,270,'↶  撤销',()=>this.undo());
    this.makeButton(720,390,270,'重新开始',()=>this.restart());
    this.board=this.add.container(0,0);
    this.input.keyboard?.on('keydown',(e:KeyboardEvent)=>{
      const map:Record<string,Direction>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
      if(map[e.key]){e.preventDefault();this.move(map[e.key])}
    });
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.start=new Phaser.Math.Vector2(p.x,p.y));
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{
      if(!this.start||this.overlay)return;
      const dx=p.x-this.start.x,dy=p.y-this.start.y;this.start=undefined;
      if(Math.max(Math.abs(dx),Math.abs(dy))<45)return;
      this.move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
    });
    this.loadGame();this.render(false);
    this.scale.on('resize',()=>this.cameras.main.setViewport(0,0,W,H));
  }
  makeScoreCard(x:number,y:number,label:string,isBest:boolean){
    this.add.rectangle(x,y,175,140,0x8f8172).setOrigin(0);
    this.add.text(x+87,y+25,label,{fontSize:'28px',fontStyle:'bold',color:'#ded5c9'}).setOrigin(.5,0);
    const t=this.add.text(x+87,y+67,'0',{fontSize:'48px',fontStyle:'bold',color:'#fff'}).setOrigin(.5,0);
    if(isBest)this.bestText=t;else this.scoreText=t;
  }
  makeButton(x:number,y:number,w:number,label:string,action:()=>void){
    const bg=this.add.rectangle(x,y,w,110,0x75685b).setOrigin(0).setInteractive({useHandCursor:true});
    const tx=this.add.text(x+w/2,y+55,label,{fontSize:'36px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    bg.on('pointerdown',()=>{bg.setScale(.97);tx.setScale(.97)});
    bg.on('pointerup',()=>{bg.setScale(1);tx.setScale(1);action()});
    bg.on('pointerout',()=>{bg.setScale(1);tx.setScale(1)});
  }
  loadGame(){
    try{
      const saved=JSON.parse(localStorage.getItem('phaser2048')||'null');
      this.best=Number(localStorage.getItem('phaser2048Best'))||0;
      if(saved?.grid?.length===4){this.grid=saved.grid;this.score=saved.score||0}
      else this.newGame();
    }catch{this.newGame()}
  }
  newGame(){this.grid=empty();this.score=0;this.previous=null;this.won=false;this.addRandom();this.addRandom();this.save()}
  addRandom(){
    const spots:{r:number;c:number}[]=[];
    this.grid.forEach((row,r)=>row.forEach((v,c)=>{if(!v)spots.push({r,c})}));
    if(!spots.length)return;
    const p=Phaser.Utils.Array.GetRandom(spots);this.grid[p.r][p.c]=Math.random()<.9?2:4;
  }
  move(dir:Direction){
    if(this.overlay)return;
    const result=moveGrid(this.grid,dir);if(!result.moved)return;
    this.previous={grid:clone(this.grid),score:this.score};
    this.grid=result.grid;this.score+=result.score;this.addRandom();
    this.best=Math.max(this.best,this.score);this.save();this.render(true);
    if(!this.won&&this.grid.some(r=>r.includes(2048))){this.won=true;this.showOverlay('你赢了！','继续游戏',()=>this.hideOverlay())}
    else if(!canMove(this.grid))this.showOverlay('没有可移动方块','再玩一次',()=>this.restart());
  }
  undo(){if(!this.previous||this.overlay)return;this.grid=clone(this.previous.grid);this.score=this.previous.score;this.previous=null;this.save();this.render(true)}
  restart(){this.hideOverlay();this.newGame();this.render(true)}
  save(){
    localStorage.setItem('phaser2048',JSON.stringify({grid:this.grid,score:this.score}));
    localStorage.setItem('phaser2048Best',String(this.best));
  }
  render(animate:boolean){
    this.board.removeAll(true);
    this.board.add(this.add.rectangle(this.bx,this.by,this.boardSize,this.boardSize,0x9c8f80).setOrigin(0));
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const x=this.bx+this.gap+c*(this.cell+this.gap),y=this.by+this.gap+r*(this.cell+this.gap),v=this.grid[r][c];
      const tile=this.add.container(x+this.cell/2,y+this.cell/2);
      tile.add(this.add.rectangle(0,0,this.cell,this.cell,COLORS[v]||0x3c3a32));
      if(v){
        const digits=String(v).length;
        tile.add(this.add.text(0,2,String(v),{fontFamily:'Arial Black',fontSize:(digits<3?76:digits===3?66:digits===4?54:45)+'px',color:v<=4?'#776e65':'#fff'}).setOrigin(.5));
      }
      this.board.add(tile);
      if(animate&&v){tile.setScale(.82);this.tweens.add({targets:tile,scale:1,duration:130,ease:'Back.Out'})}
    }
    this.scoreText.setText(String(this.score));this.bestText.setText(String(this.best));
    this.add.text(90,1540,'玩法',{fontSize:'42px',fontStyle:'bold',color:'#5f574d'});
    this.add.text(90,1605,'上下左右滑动，相同数字会合并。\n试着合成 2048！',{fontSize:'34px',lineSpacing:18,color:'#857b6e'}).setName('help');
    const helps=this.children.getAll().filter(o=>o.name==='help');helps.slice(0,-1).forEach(o=>o.destroy());
  }
  showOverlay(title:string,button:string,action:()=>void){
    const o=this.add.container(0,0).setDepth(20);
    o.add(this.add.rectangle(0,0,W,H,0xf6f1e8,.9).setOrigin(0).setInteractive());
    o.add(this.add.text(W/2,750,title,{fontSize:'66px',fontStyle:'bold',color:'#5f574d',align:'center',wordWrap:{width:850}}).setOrigin(.5));
    const b=this.add.rectangle(W/2,900,400,110,0x75685b).setInteractive({useHandCursor:true});
    o.add([b,this.add.text(W/2,900,button,{fontSize:'38px',fontStyle:'bold',color:'#fff'}).setOrigin(.5)]);
    b.on('pointerup',action);this.overlay=o;
  }
  hideOverlay(){this.overlay?.destroy();this.overlay=undefined}
}

new Phaser.Game({
  type:Phaser.AUTO,parent:'game',backgroundColor:'#f6f1e8',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},
  render:{antialias:true,pixelArt:false},scene:[GameScene],
  input:{activePointers:2}
});

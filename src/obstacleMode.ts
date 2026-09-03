import Phaser from 'phaser';
import {chooseMotherCell,move2048,type MoveDirection,type TileTransition} from './core2048';
import {OBSTACLE_CATEGORIES,OBSTACLE_LEVELS,getObstacleLevel,type ObstacleLevel} from './obstacleLevels';

const W=1080,H=1920,VERSION='v0.13.0-combo',K=(r:number,c:number)=>r+','+c,SVG_CONFIG={width:256,height:256};
const COLORS:Record<number,number>={2:0xeee4da,4:0xe6d2b5,8:0xf2b179,16:0xf59563,32:0xf67c5f,64:0xe84a35,128:0xedcf72,256:0xe8bd48,512:0xd99b32,1024:0xc97932,2048:0xb85d2c};
const CATEGORY_COLORS={permanent:0x64727c,destructible:0xa66f3e,attached:0x5595a5,dynamic:0x6e8d54};
type Spawn={r:number;c:number;value:number};
type FixedState={type:'wall'|'number-gate'|'switch-gate'|'stump'|'crate'|'cracked-rock'|'barrel'|'boulder'|'thorn';hp:number};
type OverlayState={type:'ice'|'chain'|'slime'|'vine';layers:number};
const empty=()=>Array.from({length:5},()=>Array(5).fill(0));
const pos=(k:string)=>k.split(',').map(Number) as [number,number];

function txt(s:Phaser.Scene,x:number,y:number,value:string,size:number,color='#5f574d',width=900){
  return s.add.text(x,y,value,{fontFamily:'Arial,sans-serif',fontSize:size+'px',fontStyle:'bold',color,align:'center',wordWrap:{width}}).setOrigin(.5);
}
function btn(s:Phaser.Scene,x:number,y:number,w:number,label:string,fn:()=>void,enabled=true){
  const b=s.add.rectangle(x,y,w,82,enabled?0x75685b:0xc8bfb4).setInteractive(enabled?{useHandCursor:true}:undefined),t=txt(s,x,y,label,28,enabled?'#fff':'#91877b',w-20);
  if(enabled){b.on('pointerdown',()=>{b.setScale(.96);t.setScale(.96)});b.on('pointerup',()=>{b.setScale(1);t.setScale(1);fn()});b.on('pointerout',()=>{b.setScale(1);t.setScale(1)})}return[b,t];
}

export class ObstacleSelectScene extends Phaser.Scene{
  constructor(){super('obstacle-select')}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');btn(this,105,78,170,'‹ 主页',()=>this.scene.start('home'));txt(this,W/2,88,'障碍物实验室',60);txt(this,W/2,158,'4 类障碍 · 16 个可操作测试关',27,'#887e72');
    OBSTACLE_CATEGORIES.forEach((category,group)=>{
      const y=285+group*370,color=CATEGORY_COLORS[category.id];txt(this,105,y,category.name,31,'#655b51',180).setOrigin(0,.5);
      OBSTACLE_LEVELS.filter(level=>level.category===category.id).forEach((level,i)=>{
        const x=130+i*265,cy=y+125,b=this.add.rectangle(x,cy,225,190,color).setInteractive({useHandCursor:true});
        this.add.image(x,cy-34,level.asset).setDisplaySize(76,76);txt(this,x,cy+36,level.title,25,'#fff',205);txt(this,x,cy+72,String(level.index).padStart(2,'0'),18,'#e9e3dc',205);b.on('pointerup',()=>this.scene.start('obstacle-test',{index:level.index}));
      });
    });
    txt(this,W/2,1815,VERSION,22,'#aaa095');
  }
  preload(){preloadObstacleAssets(this)}
}

export class ObstacleTestScene extends Phaser.Scene{
  level!:ObstacleLevel;grid=empty();fixedCells=new Map<string,FixedState>();voids=new Set<string>();overlays=new Map<string,OverlayState>();terrain=new Map<string,'conveyor'|'portal'>();
  mother={r:0,c:0};turn=0;score=0;timeLeft=120;timeExpired=false;animating=false;countdown?:Phaser.Time.TimerEvent;touch?:Phaser.Math.Vector2;
  board!:Phaser.GameObjects.Container;status!:Phaser.GameObjects.Text;hint!:Phaser.GameObjects.Text;readonly cell=154;readonly ox=155;readonly oy=520;
  constructor(){super('obstacle-test')}
  init(data:{index?:number}){this.level=getObstacleLevel(data.index||1)}
  preload(){preloadObstacleAssets(this)}
  create(){
    this.cameras.main.setBackgroundColor('#f6f1e8');btn(this,90,65,145,'列表',()=>this.scene.start('obstacle-select'));btn(this,735,65,145,'上一个',()=>this.scene.restart({index:this.level.index-1}),this.level.index>1);btn(this,930,65,145,'下一个',()=>this.scene.restart({index:this.level.index+1}),this.level.index<OBSTACLE_LEVELS.length);
    txt(this,W/2,145,`${this.level.index}. ${this.level.title}`,51);txt(this,W/2,215,this.level.categoryName+' · '+this.level.description,26,'#81766a');btn(this,160,350,260,'重新测试',()=>this.reset());
    this.status=this.add.text(930,304,'',{fontFamily:'Arial,sans-serif',fontSize:'27px',fontStyle:'bold',color:'#655b51',align:'right'}).setOrigin(1,0);
    this.hint=this.add.text(W/2,1415,this.level.rule,{fontFamily:'Arial,sans-serif',fontSize:'29px',fontStyle:'bold',color:'#71665b',align:'center',wordWrap:{width:900}}).setOrigin(.5,0);this.board=this.add.container();
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.touch=new Phaser.Math.Vector2(p.x,p.y));this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{if(!this.touch)return;const dx=p.x-this.touch.x,dy=p.y-this.touch.y;this.touch=undefined;if(Math.max(Math.abs(dx),Math.abs(dy))<40)return;this.act(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'))});
    this.input.keyboard?.on('keydown',(e:KeyboardEvent)=>{const m:Record<string,MoveDirection>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(m[e.key])this.act(m[e.key])});this.reset();
  }
  reset(){
    this.countdown?.remove(false);this.grid=empty();this.fixedCells.clear();this.voids.clear();this.overlays.clear();this.terrain.clear();this.turn=0;this.score=0;this.timeLeft=this.level.timeLimit;this.timeExpired=false;this.animating=false;
    this.grid[1][1]=2;this.grid[1][2]=2;this.grid[3][2]=4;this.grid[3][3]=4;this.setupLevel();
    const unavailable=new Set<string>([...this.fixedCells.keys(),...this.voids,...this.overlays.keys(),...this.terrain.keys()]);for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(this.grid[r][c])unavailable.add(K(r,c));
    this.mother=chooseMotherCell(5,5,unavailable);this.render();this.startCountdown();
  }
  setupLevel(){
    const put=(r:number,c:number,type:FixedState['type'],hp=1)=>{this.grid[r][c]=0;this.fixedCells.set(K(r,c),{type,hp})};
    switch(this.level.id){
      case'wall':put(1,2,'wall',99);put(2,2,'wall',99);put(3,2,'wall',99);break;
      case'void':this.voids.add(K(0,0));this.voids.add(K(2,2));this.voids.add(K(4,4));break;
      case'number-gate':put(2,2,'number-gate',99);break;
      case'switch-gate':put(2,2,'switch-gate',99);break;
      case'stump':put(0,0,'stump');put(0,4,'stump');put(4,2,'stump');break;
      case'crate':put(0,0,'crate',2);put(0,4,'crate',2);break;
      case'cracked-rock':put(2,0,'cracked-rock');put(2,4,'cracked-rock');break;
      case'barrel':put(2,0,'barrel');put(2,1,'stump');put(3,0,'stump');break;
      case'ice':this.grid[2][2]=8;this.overlays.set(K(2,2),{type:'ice',layers:2});break;
      case'chain':this.grid[2][2]=8;this.overlays.set(K(2,2),{type:'chain',layers:1});break;
      case'slime':this.grid[2][2]=8;this.overlays.set(K(2,2),{type:'slime',layers:1});break;
      case'vine':this.grid[2][2]=8;this.overlays.set(K(2,2),{type:'vine',layers:1});break;
      case'boulder':put(2,2,'boulder',99);break;
      case'thorn':put(2,2,'thorn',99);break;
      case'conveyor':for(let c=0;c<5;c++)this.terrain.set(K(2,c),'conveyor');this.grid[2][0]=2;break;
      case'portal':this.terrain.set(K(0,0),'portal');this.terrain.set(K(4,4),'portal');break;
    }
  }
  startCountdown(){this.updateStatus();this.countdown=this.time.addEvent({delay:1000,loop:true,callback:()=>{if(this.timeExpired)return;this.timeLeft=Math.max(0,this.timeLeft-1);if(!this.timeLeft){this.timeExpired=true;this.countdown?.remove(false);this.countdown=undefined}this.updateStatus()}})}
  updateStatus(){const m=Math.floor(this.timeLeft/60),s=this.timeLeft%60,state=this.stateText();this.status?.setText(`剩余时间 ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}\n分数 ${this.score}\n有效操作 ${this.turn}\n${this.timeExpired?'时间到 · 测试结束':state}`);this.status?.setColor(this.timeLeft<=10?'#b94a3b':'#655b51')}
  stateText(){
    if(this.level.id==='number-gate'||this.level.id==='switch-gate')return this.fixedCells.size?'门未打开':'门已打开';
    if(this.level.id==='ice')return `冰层 ${this.overlays.get(K(2,2))?.layers||0}`;
    if(this.level.id==='slime')return this.turn%2===0?'黏液锁定':'黏液释放';
    if(['stump','crate','cracked-rock','barrel'].includes(this.level.id))return `剩余障碍 ${this.fixedCells.size}`;
    return this.level.rule;
  }
  blocked(){const result=new Set<string>([...this.fixedCells.keys(),...this.voids,K(this.mother.r,this.mother.c)]);for(const[k,o]of this.overlays)if(o.type!=='slime'||this.turn%2===0)result.add(k);return result}
  act(dir:MoveDirection){
    if(this.timeExpired||this.animating)return;const result=move2048(this.grid,dir,this.blocked());if(!result.moved)return;this.animating=true;this.grid=result.grid;this.turn++;this.score+=result.score;this.applyMechanic(result.mergedCells,dir);const spawned=this.spawn();this.render(result.transitions,spawned);this.updateStatus();
  }
  adjacentMerge(r:number,c:number,merges:Array<{r:number;c:number;value:number}>,min=0){return merges.some(m=>m.value>=min&&Math.abs(m.r-r)+Math.abs(m.c-c)===1)}
  applyMechanic(merges:Array<{r:number;c:number;value:number}>,dir:MoveDirection){
    if(this.level.id==='number-gate'&&Math.max(...this.grid.flat())>=16)this.fixedCells.delete(K(2,2));
    if(this.level.id==='switch-gate'&&merges.length)this.fixedCells.delete(K(2,2));
    if(this.level.id==='stump'||this.level.id==='crate'||this.level.id==='cracked-rock')for(const[k,state]of[...this.fixedCells]){const[r,c]=pos(k),minimum=state.type==='cracked-rock'?8:0;if(this.adjacentMerge(r,c,merges,minimum)){state.hp--;if(state.hp<=0)this.fixedCells.delete(k)}}
    if(this.level.id==='barrel'){const barrel=[...this.fixedCells].find(([,v])=>v.type==='barrel');if(barrel){const[r,c]=pos(barrel[0]);if(this.adjacentMerge(r,c,merges)){for(const k of[...this.fixedCells.keys()]){const[a,b]=pos(k);if(Math.abs(a-r)<=1&&Math.abs(b-c)<=1)this.fixedCells.delete(k)}}}}
    if(['ice','chain','vine'].includes(this.level.id)){const overlay=[...this.overlays][0];if(overlay){const[r,c]=pos(overlay[0]);if(this.adjacentMerge(r,c,merges)){overlay[1].layers--;if(overlay[1].layers<=0)this.overlays.delete(overlay[0])}}}
    if(this.level.id==='boulder')this.moveBoulder(dir);if(this.level.id==='thorn'&&this.turn%3===0)this.spreadThorn();if(this.level.id==='conveyor')this.runConveyor();if(this.level.id==='portal')this.runPortal();
  }
  moveBoulder(dir:MoveDirection){const item=[...this.fixedCells].find(([,v])=>v.type==='boulder');if(!item)return;const[r,c]=pos(item[0]),d=dir==='left'?[0,-1]:dir==='right'?[0,1]:dir==='up'?[-1,0]:[1,0],nr=r+d[0],nc=c+d[1],k=K(nr,nc);if(nr>=0&&nc>=0&&nr<5&&nc<5&&!this.grid[nr][nc]&&!this.fixedCells.has(k)&&!this.voids.has(k)&&k!==K(this.mother.r,this.mother.c)){this.fixedCells.delete(item[0]);this.fixedCells.set(k,item[1])}}
  spreadThorn(){const sources=[...this.fixedCells].filter(([,v])=>v.type==='thorn');for(const[k]of sources){const[r,c]=pos(k),target=[[r-1,c],[r,c+1],[r+1,c],[r,c-1]].find(([a,b])=>a>=0&&b>=0&&a<5&&b<5&&!this.grid[a][b]&&!this.fixedCells.has(K(a,b))&&!this.voids.has(K(a,b))&&K(a,b)!==K(this.mother.r,this.mother.c));if(target){this.fixedCells.set(K(target[0],target[1]),{type:'thorn',hp:99});break}}}
  runConveyor(){for(let c=3;c>=0;c--){const from=K(2,c),to=K(2,c+1);if(this.grid[2][c]&&!this.grid[2][c+1]&&!this.fixedCells.has(to)&&to!==K(this.mother.r,this.mother.c)){this.grid[2][c+1]=this.grid[2][c];this.grid[2][c]=0}}}
  runPortal(){const a=[0,0]as const,b=[4,4]as const;if(this.grid[a[0]][a[1]]&&!this.grid[b[0]][b[1]]){this.grid[b[0]][b[1]]=this.grid[a[0]][a[1]];this.grid[a[0]][a[1]]=0}else if(this.grid[b[0]][b[1]]&&!this.grid[a[0]][a[1]]){this.grid[a[0]][a[1]]=this.grid[b[0]][b[1]];this.grid[b[0]][b[1]]=0}}
  spawn():Spawn|null{const spots:Array<[number,number]>=[];for(let r=0;r<5;r++)for(let c=0;c<5;c++){const k=K(r,c);if(!this.grid[r][c]&&!this.fixedCells.has(k)&&!this.voids.has(k)&&k!==K(this.mother.r,this.mother.c))spots.push([r,c])}if(!spots.length)return null;const p=spots[Math.floor(Math.random()*spots.length)],value=Math.random()<.9?2:4;this.grid[p[0]][p[1]]=value;return{r:p[0],c:p[1],value}}
  assetFor(type:FixedState['type']){return type==='wall'?'obs-wall':type==='number-gate'?'obs-number-gate':type==='switch-gate'?'obs-switch-gate':type==='stump'?'art-stump':type==='crate'?'obs-crate':type==='cracked-rock'?'obs-cracked-rock':type==='barrel'?'obs-barrel':type==='boulder'?'obs-boulder':'obs-thorn'}
  center(r:number,c:number){return{x:this.ox+c*this.cell+this.cell/2,y:this.oy+r*this.cell+this.cell/2}}
  makePiece(value:number,x:number,y:number){const p=this.add.container(x,y);p.add(this.add.rectangle(0,0,this.cell,this.cell,COLORS[value]||0x3c3a32));p.add(txt(this,0,2,String(value),value>=1000?42:54,value<=4?'#776e65':'#fff',this.cell));return p}
  render(motions:TileTransition[]=[],spawned:Spawn|null=null){
    this.board.removeAll(true);const motherPos=this.center(this.mother.r,this.mother.c),mother=this.add.container(motherPos.x,motherPos.y);mother.add(this.add.rectangle(0,0,this.cell,this.cell,0x72549a));mother.add(this.add.circle(0,0,this.cell*.29,0xf3d58f));mother.add(this.add.circle(-this.cell*.15,-this.cell*.12,this.cell*.07,0xfff2c7));mother.add(this.add.circle(this.cell*.15,-this.cell*.12,this.cell*.07,0xfff2c7));mother.add(txt(this,0,this.cell*.08,'母',43,'#5b3e77',this.cell));
    const pieces=new Map<string,Phaser.GameObjects.Container>();for(let r=0;r<5;r++)for(let c=0;c<5;c++){const k=K(r,c),p=this.center(r,c);this.board.add(this.add.rectangle(p.x,p.y,this.cell,this.cell,(r+c)%2?0xaea295:0xc8bdae));if(this.voids.has(k)){this.board.add(this.add.image(p.x,p.y,'obs-void').setDisplaySize(this.cell*.9,this.cell*.9));continue}const terrain=this.terrain.get(k);if(terrain)this.board.add(this.add.image(p.x,p.y,terrain==='portal'?'art-portal':'obs-conveyor').setDisplaySize(this.cell*.82,this.cell*.82).setAlpha(.55));if(k===K(this.mother.r,this.mother.c)){this.board.add(mother);continue}const fixed=this.fixedCells.get(k);if(fixed){this.board.add(this.add.image(p.x,p.y,this.assetFor(fixed.type)).setDisplaySize(this.cell*.88,this.cell*.88));if(fixed.hp>1&&fixed.hp<90)this.board.add(txt(this,p.x+49,p.y-49,String(fixed.hp),25,'#fff',40));continue}if(this.grid[r][c]){const piece=this.makePiece(this.grid[r][c],p.x,p.y);pieces.set(k,piece);this.board.add(piece)}const overlay=this.overlays.get(k);if(overlay){const asset=overlay.type==='ice'?'art-ice':overlay.type==='chain'?'art-chain':overlay.type==='slime'?'art-slime':'obs-vine';this.board.add(this.add.image(p.x,p.y,asset).setDisplaySize(this.cell*.88,this.cell*.88).setAlpha(overlay.type==='slime'?.78:.92));if(overlay.layers>1)this.board.add(txt(this,p.x+48,p.y-48,String(overlay.layers),25,'#fff',40))}}
    if(!motions.length){this.animating=false;return}const spawnKey=spawned?K(spawned.r,spawned.c):'',hidden=new Set(motions.map(m=>K(m.toR,m.toC)));if(spawnKey)hidden.add(spawnKey);hidden.forEach(k=>pieces.get(k)?.setAlpha(0));const ghosts:Phaser.GameObjects.Container[]=[];let remaining=motions.length;
    const spray=()=>{if(!spawned){this.animating=false;return}const target=this.center(spawned.r,spawned.c),seed=this.makePiece(spawned.value,motherPos.x,motherPos.y).setScale(.35);this.board.add(seed);this.tweens.add({targets:mother,scaleX:1.08,scaleY:.92,duration:90,yoyo:true});this.tweens.add({targets:seed,x:target.x,y:target.y,scale:1,duration:280,ease:'Sine.Out',onComplete:()=>{seed.destroy();pieces.get(spawnKey)?.setAlpha(1);this.animating=false}})};
    const reveal=()=>{pieces.forEach(p=>p.setAlpha(1));this.tweens.add({targets:ghosts,alpha:0,duration:48,onComplete:()=>{ghosts.forEach(g=>g.destroy());spray()}})};
    for(const motion of motions){const from=this.center(motion.fromR,motion.fromC),ghost=this.makePiece(motion.value,from.x,from.y),path:Array<{x:number;y:number}>=[];ghosts.push(ghost);this.board.add(ghost);let r=motion.fromR,c=motion.fromC;while(r!==motion.toR||c!==motion.toC){if(r<motion.toR)r++;else if(r>motion.toR)r--;else if(c<motion.toC)c++;else c--;path.push(this.center(r,c))}let i=0;const done=()=>{if(--remaining===0)reveal()};const step=()=>{if(i>=path.length){done();return}const point=path[i++];this.tweens.add({targets:ghost,x:point.x,y:point.y,duration:75,ease:'Sine.InOut',onComplete:step})};step()}
  }
}

function preloadObstacleAssets(scene:Phaser.Scene){
  const assets:Record<string,string>={
    'art-stump':'stump.svg','art-ice':'ice.svg','art-chain':'chain.svg','art-slime':'slime.svg','art-portal':'portal.svg','obs-wall':'wall.svg','obs-void':'void.svg','obs-number-gate':'number-gate.svg','obs-switch-gate':'switch-gate.svg','obs-crate':'crate.svg','obs-cracked-rock':'cracked-rock.svg','obs-barrel':'barrel.svg','obs-vine':'vine.svg','obs-boulder':'boulder.svg','obs-thorn':'thorn.svg','obs-conveyor':'conveyor.svg'
  };for(const[key,file]of Object.entries(assets))scene.load.svg(key,`./assets/${file}?v=0.12.1`,SVG_CONFIG);
}

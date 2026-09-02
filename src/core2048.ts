export type MoveDirection='left'|'right'|'up'|'down';
export interface TileTransition{
  fromR:number;fromC:number;toR:number;toC:number;value:number;
  kind:'move'|'merge-source';
}
export interface MoveOutcome{
  grid:number[][];score:number;moved:boolean;transitions:TileTransition[];
  mergedCells:Array<{r:number;c:number;value:number}>;
}
interface Tile{
  id:number;value:number;r:number;c:number;startR:number;startC:number;merged:boolean;
}
const key=(r:number,c:number)=>r+','+c;
const copy=(g:number[][])=>g.map(row=>[...row]);

export function move2048(values:number[][],direction:MoveDirection,blocked:Set<string>=new Set()):MoveOutcome{
  const rows=values.length,cols=values[0].length;
  const cells:Array<Array<Tile|null>>=Array.from({length:rows},()=>Array(cols).fill(null));
  const originals=new Map<number,Tile>();let nextId=1;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(values[r][c]!==0){
    const tile:Tile={id:nextId++,value:values[r][c],r,c,startR:r,startC:c,merged:false};
    cells[r][c]=tile;originals.set(tile.id,tile);
  }
  const vector=direction==='left'?{r:0,c:-1}:direction==='right'?{r:0,c:1}:direction==='up'?{r:-1,c:0}:{r:1,c:0};
  const rOrder=Array.from({length:rows},(_,i)=>i),cOrder=Array.from({length:cols},(_,i)=>i);
  if(vector.r===1)rOrder.reverse();if(vector.c===1)cOrder.reverse();
  let score=0,moved=false;const mergedCells:MoveOutcome['mergedCells']=[];
  const sourceDest=new Map<number,{r:number;c:number;kind:'move'|'merge-source'}>();
  const available=(r:number,c:number)=>r>=0&&c>=0&&r<rows&&c<cols&&!blocked.has(key(r,c));
  for(const r of rOrder)for(const c of cOrder){
    const tile=cells[r][c];if(!tile||blocked.has(key(r,c)))continue;
    let farR=r,farC=c,nextR=r+vector.r,nextC=c+vector.c;
    while(available(nextR,nextC)&&!cells[nextR][nextC]){
      farR=nextR;farC=nextC;nextR+=vector.r;nextC+=vector.c;
    }
    const next=available(nextR,nextC)?cells[nextR][nextC]:null;
    if(next&&next.value===tile.value&&!next.merged){
      cells[r][c]=null;
      if(next.r!==nextR||next.c!==nextC)throw new Error('Invalid tile position');
      const merged:Tile={id:nextId++,value:tile.value*2,r:nextR,c:nextC,startR:nextR,startC:nextC,merged:true};
      cells[nextR][nextC]=merged;score+=merged.value;moved=true;
      sourceDest.set(tile.id,{r:nextR,c:nextC,kind:'merge-source'});
      sourceDest.set(next.id,{r:nextR,c:nextC,kind:'merge-source'});
      mergedCells.push({r:nextR,c:nextC,value:merged.value});
    }else{
      if(farR!==r||farC!==c){
        cells[r][c]=null;cells[farR][farC]=tile;tile.r=farR;tile.c=farC;moved=true;
        sourceDest.set(tile.id,{r:farR,c:farC,kind:'move'});
      }
    }
  }
  const grid=copy(values);for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)grid[r][c]=cells[r][c]?.value||0;
  const transitions:TileTransition[]=[];
  for(const [id,dest] of sourceDest){const source=originals.get(id);if(!source)continue;
    transitions.push({fromR:source.startR,fromC:source.startC,toR:dest.r,toC:dest.c,value:source.value,kind:dest.kind});
  }
  return{grid,score,moved,transitions,mergedCells};
}

export function hasLegalMove(values:number[][],blocked:Set<string>=new Set()){
  return(['left','right','up','down'] as MoveDirection[]).some(d=>move2048(values,d,blocked).moved);
}

export function verifyCoreRules(){
  const row=(values:number[])=>[values];
  const run=(values:number[],direction:MoveDirection)=>move2048(row(values),direction).grid[0];
  return{
    threeLeft:run([2,2,2,0],'left'),
    fourLeft:run([2,2,2,2],'left'),
    chainBlocked:run([4,4,8,0],'left'),
    gapSlide:run([2,0,0,0],'right')
  };
}

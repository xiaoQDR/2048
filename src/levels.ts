export type Pos={r:number;c:number};
export type IceCell=Pos&{value:number;layers:1|2};

export interface LevelConfig{
  id:number;
  chapter:number;
  boardSize:3|4;
  moveLimit:number;
  seed:number;
  title:string;
  target?:number;
  blockers?:Pos[];
  voids?:Pos[];
  ice?:IceCell[];
  orders?:number[];
  rescueAnts?:number;
  ants?:Pos[];
  clearIce?:boolean;
}

const P=(...pairs:number[][]):Pos[]=>pairs.map(([r,c])=>({r,c}));
const I=(r:number,c:number,value:number,layers:1|2=1):IceCell=>({r,c,value,layers});
const chapterNames=['初识合成','树桩迷阵','冰封棋盘','订单工坊','蚂蚁出逃'];
const base=[
  [8,8],[16,12],[8,12],[32,18],[16,16],[32,16],[64,24],[32,22],[64,25],[128,34]
];
const trees=[
  P([1,1]),P([0,3],[3,0]),P([1,1],[1,2]),P([0,1],[3,2]),P([1,1],[2,2]),
  P([0,0],[1,0],[1,1]),P([1,2],[2,2]),P([0,0],[3,3]),P([0,1],[1,1],[2,1]),P([0,1],[1,1],[2,2],[3,2])
];
const iceSets:IceCell[][]=[
  [I(1,1,4)],[I(0,1,4),I(2,1,4)],[I(1,1,8)],[I(1,0,8),I(1,3,8)],[I(1,1,16,2)],
  [I(0,1,4),I(1,2,4),I(3,1,8)],[I(1,1,8),I(2,2,8)],[I(0,0,4),I(0,3,4),I(3,0,4),I(3,3,4)],
  [I(1,1,16,2),I(2,2,8,2)],[I(1,1,16,2),I(1,2,16,2),I(2,1,8,2),I(2,2,8,2)]
];
const antSets:Pos[][]=[
  P([1,1]),P([1,0],[2,3]),P([1,1]),P([1,0],[2,3]),P([1,1],[2,2]),
  P([1,1]),P([0,1],[2,2],[3,1]),P([1,0],[1,3]),P([0,1],[2,2],[3,1]),P([0,1],[1,2],[2,1],[3,2])
];

const levels:LevelConfig[]=[];
base.forEach(([target,moveLimit],i)=>levels.push({id:i+1,chapter:1,boardSize:i<5?3:4,target,moveLimit,seed:204800+(i+1)*7919,title:chapterNames[0]}));

const treeTargets=[32,32,32,64,64,64,128,64,128,256];
const treeMoves=[19,20,21,26,27,28,35,31,38,46];
treeTargets.forEach((target,i)=>levels.push({id:11+i,chapter:2,boardSize:4,target,moveLimit:treeMoves[i],seed:204800+(11+i)*7919,title:chapterNames[1],blockers:trees[i]}));

const iceTargets=[8,16,32,16,32,32,64,32,128,256];
const iceMoves=[14,18,20,20,24,26,30,30,38,48];
iceTargets.forEach((target,i)=>levels.push({
  id:21+i,chapter:3,boardSize:4,target,moveLimit:iceMoves[i],seed:204800+(21+i)*7919,title:chapterNames[2],
  ice:iceSets[i],clearIce:i===5||i===7||i===9,blockers:i===6?P([0,3],[3,0]):undefined
}));

const orderSets=[[16],[16,16],[32,16],[16,16,16],[32,32],[8,16,32],[32,32],[64,32],[128,16,16],[16,16,32,32,64]];
const orderMoves=[14,20,22,24,27,27,30,34,40,48];
orderSets.forEach((orders,i)=>levels.push({
  id:31+i,chapter:4,boardSize:4,orders,moveLimit:orderMoves[i],seed:204800+(31+i)*7919,title:chapterNames[3],
  blockers:i===6?trees[1]:undefined,ice:i===7?[I(1,1,8),I(2,2,8)]:undefined
}));

const finalData=[
  {move:16,ants:1},{move:20,ants:2},{move:24,ants:1,target:32},{move:27,ants:2,blockers:trees[2]},
  {move:31,ants:2,ice:[I(1,1,8),I(2,2,8)]},{move:34,ants:1,orders:[32,32]},
  {move:38,ants:3,ice:[I(0,1,4),I(2,2,8)]},{move:42,ants:2,orders:[64,32],blockers:trees[1]},
  {move:50,ants:3,target:256,ice:[I(1,1,16,2)]},
  {move:60,ants:4,orders:[128,128],ice:[I(1,1,16,2),I(2,2,16,2)],blockers:P([0,0],[3,3])}
];
finalData.forEach((d,i)=>levels.push({
  id:41+i,chapter:5,boardSize:4,moveLimit:d.move,seed:204800+(41+i)*7919,title:chapterNames[4],
  rescueAnts:d.ants,ants:antSets[i],target:d.target,orders:d.orders,ice:d.ice,blockers:d.blockers,
  clearIce:i===6||i===9
}));

const irregular:Record<number,Pos[]>={
  16:P([0,3]),
  18:P([0,1],[3,2]),
  20:P([0,0],[0,3]),
  24:P([0,0],[3,3]),
  28:P([1,1],[2,2]),
  30:P([0,0],[0,3],[3,0],[3,3]),
  34:P([0,0],[3,3]),
  38:P([0,0],[3,3]),
  40:P([0,0],[0,3],[3,0],[3,3]),
  42:P([0,3],[3,0]),
  44:P([0,0],[3,3]),
  47:P([0,0],[3,3]),
  49:P([0,3],[3,0]),
  50:P([0,3])
};
for(const level of levels)level.voids=irregular[level.id];

export const LEVELS=levels;
export const getLevel=(id:number)=>LEVELS[Math.max(0,Math.min(49,id-1))];

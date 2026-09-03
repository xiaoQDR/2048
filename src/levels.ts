export type Pos={r:number;c:number};
export type IceCell=Pos&{value:number;layers:1|2};

export interface LevelConfig{
  id:number;
  chapter:number;
  boardSize:3|4|5|6;
  boardRows?:number;
  boardCols?:number;
  timeLimit:number;
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
  [8,40],[16,60],[8,60],[32,90],[16,80],[32,80],[64,120],[32,110],[64,125],[128,170]
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
base.forEach(([target,timeLimit],i)=>levels.push({id:i+1,chapter:1,boardSize:i<5?3:4,target,timeLimit,seed:204800+(i+1)*7919,title:chapterNames[0]}));

const treeTargets=[32,32,32,64,64,64,128,64,128,256];
const treeTimes=[95,100,105,130,135,140,175,155,190,230];
treeTargets.forEach((target,i)=>levels.push({id:11+i,chapter:2,boardSize:4,target,timeLimit:treeTimes[i],seed:204800+(11+i)*7919,title:chapterNames[1],blockers:trees[i]}));

const iceTargets=[8,16,32,16,32,32,64,32,128,256];
const iceTimes=[70,90,100,100,120,130,150,150,190,240];
iceTargets.forEach((target,i)=>levels.push({
  id:21+i,chapter:3,boardSize:4,target,timeLimit:iceTimes[i],seed:204800+(21+i)*7919,title:chapterNames[2],
  ice:iceSets[i],clearIce:i===5||i===7||i===9,blockers:i===6?P([0,3],[3,0]):undefined
}));

const orderSets=[[16],[16,16],[32,16],[16,16,16],[32,32],[8,16,32],[32,32],[64,32],[128,16,16],[16,16,32,32,64]];
const orderTimes=[70,100,110,120,135,135,150,170,200,240];
orderSets.forEach((orders,i)=>levels.push({
  id:31+i,chapter:4,boardSize:4,orders,timeLimit:orderTimes[i],seed:204800+(31+i)*7919,title:chapterNames[3],
  blockers:i===6?trees[1]:undefined,ice:i===7?[I(1,1,8),I(2,2,8)]:undefined
}));

const finalData=[
  {time:80,ants:1},{time:100,ants:2},{time:120,ants:1,target:32},{time:135,ants:2,blockers:trees[2]},
  {time:155,ants:2,ice:[I(1,1,8),I(2,2,8)]},{time:170,ants:1,orders:[32,32]},
  {time:190,ants:3,ice:[I(0,1,4),I(2,2,8)]},{time:210,ants:2,orders:[64,32],blockers:trees[1]},
  {time:250,ants:3,target:256,ice:[I(1,1,16,2)]},
  {time:300,ants:4,orders:[128,128],ice:[I(1,1,16,2),I(2,2,16,2)],blockers:P([0,0],[3,3])}
];
finalData.forEach((d,i)=>levels.push({
  id:41+i,chapter:5,boardSize:4,timeLimit:d.time,seed:204800+(41+i)*7919,title:chapterNames[4],
  rescueAnts:d.ants,ants:antSets[i],target:d.target,orders:d.orders,ice:d.ice,blockers:d.blockers,
  clearIce:i===6||i===9
}));

const dimensions=(id:number):[number,number]=>{
  if(id<=5)return[3,3];
  if(id<=15)return[4,4];
  if(id<=20)return[5,5];
  if(id<=25)return[4,4];
  if(id<=30)return[6,5];
  if(id<=35)return[5,4];
  if(id<=40)return[6,6];
  if(id<=43)return[5,5];
  if(id<=46)return[7,6];
  if(id<=48)return[8,7];
  return[9,7];
};
const spread=(p:Pos,rows:number,cols:number):Pos=>({
  r:Math.round(p.r*(rows-1)/3),
  c:Math.round(p.c*(cols-1)/3)
});
for(const level of levels){
  const [rows,cols]=dimensions(level.id);
  level.boardRows=rows;level.boardCols=cols;
  if(level.boardSize===4&&(rows!==4||cols!==4)){
    level.blockers=level.blockers?.map(p=>spread(p,rows,cols));
    level.ants=level.ants?.map(p=>spread(p,rows,cols));
    level.ice=level.ice?.map(p=>({...spread(p,rows,cols),value:p.value,layers:p.layers}));
  }
}
const M=(rows:number,cols:number,test:(r:number,c:number)=>boolean):Pos[]=>{
  const result:Pos[]=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(test(r,c))result.push({r,c});return result;
};
const irregular:Record<number,Pos[]>={
  16:P([0,4],[4,0]),
  18:P([0,1],[0,2],[4,2],[4,3]),
  20:P([0,0],[0,4],[2,2],[4,0]),
  24:P([0,0],[3,3]),
  28:P([2,1],[2,2],[3,2],[3,3]),
  30:P([0,0],[5,0],[2,2],[3,2],[0,4],[5,4]),
  34:P([0,0],[4,3]),
  38:M(6,6,(r,c)=>r===c&&(r===1||r===4)),
  40:M(6,6,(r,c)=>(r===2&&c>0&&c<5)||(c===3&&r>2&&r<5)),
  42:P([0,4],[4,0],[2,2]),
  44:M(7,6,(r,c)=>(c===0&&(r===0||r===6))||(c===5&&(r===0||r===6))||(c===2&&r===3)),
  47:M(8,7,(r,c)=>(r===3&&c!==3)||(c===0&&(r===0||r===7))||(c===6&&(r===0||r===7))),
  48:M(8,7,(r,c)=>(c===2&&r>1&&r<6)||(c===4&&r>1&&r<6)||(r===1&&c===3)),
  49:M(9,7,(r,c)=>(c>=2&&c<=3&&r>=4&&r<=5)||(r===4&&c===1)||(c===0&&r===8)||(c===6&&r===0)),
  50:M(9,7,(r,c)=>r===6||(c===0&&r===8)||(c===3&&r===3))
};
for(const level of levels)level.voids=irregular[level.id];

export const LEVELS=levels;
export const getLevel=(id:number)=>LEVELS[Math.max(0,Math.min(49,id-1))];

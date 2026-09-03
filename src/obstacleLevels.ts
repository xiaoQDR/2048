export type ObstacleCategory='permanent'|'destructible'|'attached'|'dynamic';
export type ObstacleId='wall'|'void'|'number-gate'|'switch-gate'|'stump'|'crate'|'cracked-rock'|'barrel'|'ice'|'chain'|'slime'|'vine'|'boulder'|'thorn'|'conveyor'|'portal';

export interface ObstacleLevel{
  index:number;
  id:ObstacleId;
  category:ObstacleCategory;
  categoryName:string;
  title:string;
  description:string;
  rule:string;
  asset:string;
  timeLimit:number;
}

const C:Record<ObstacleCategory,string>={permanent:'永久地形',destructible:'可破坏障碍',attached:'附着状态',dynamic:'动态障碍'};
const rows:Array<[ObstacleId,ObstacleCategory,string,string,string,string]>=[
  ['wall','permanent','石墙','永久占据格子并截断滑动路线。','不可破坏；母棋子和新棋子不会落在墙上。','obs-wall'],
  ['void','permanent','空洞','格子本身消失，将棋盘切割成特殊形状。','不可进入、不可生成，也不能通过。','obs-void'],
  ['number-gate','permanent','数字门','达到要求后才会开放的固定通道。','棋盘出现16或更大数字时，数字门打开。','obs-number-gate'],
  ['switch-gate','permanent','开关门','通过合成触发开关，恢复被封锁格子。','任意一次合成发生后，开关门打开。','obs-switch-gate'],
  ['stump','destructible','树桩','最基础的可破坏障碍。','相邻格发生一次合成即可破坏。','art-stump'],
  ['crate','destructible','加固木箱','具有两层耐久，持续阻挡路线。','相邻合成造成1点伤害，需要攻击两次。','obs-crate'],
  ['cracked-rock','destructible','裂纹石','只有足够强的合成才能击碎。','相邻合成结果达到8或以上时破坏。','obs-cracked-rock'],
  ['barrel','destructible','爆炸桶','触发后清除自己和周围障碍。','相邻发生合成时爆炸，清除八邻域障碍。','obs-barrel'],
  ['ice','attached','多层冰块','冻结所在棋子，使它无法移动。','附近每发生一次合成就解除一层冰。','art-ice'],
  ['chain','attached','锁链','锁住棋子，使其暂时不能移动和合并。','相邻发生合成后锁链断开。','art-chain'],
  ['slime','attached','黏液','让棋子每隔一个回合才能移动。','锁定与释放状态随有效操作交替。','art-slime'],
  ['vine','attached','藤蔓','缠住所在棋子并占据其表面。','相邻发生合成后切断藤蔓。','obs-vine'],
  ['boulder','dynamic','移动巨石','跟随滑动方向在空格中移动。','每次有效操作后向滑动方向移动一格。','obs-boulder'],
  ['thorn','dynamic','扩散荆棘','会不断占据新的空格，压缩棋盘。','每三次有效操作向相邻空格扩散一次。','obs-thorn'],
  ['conveyor','dynamic','传送带','在玩家滑动结束后继续推送棋子。','传送带行上的棋子每回合向右移动一格。','obs-conveyor'],
  ['portal','dynamic','传送门','把进入入口的棋子送到另一端。','棋子停在任一传送门时传送到空闲出口。','art-portal']
];

export const OBSTACLE_LEVELS:ObstacleLevel[]=rows.map(([id,category,title,description,rule,asset],i)=>({
  index:i+1,id,category,categoryName:C[category],title,description,rule,asset,timeLimit:120
}));
export const getObstacleLevel=(index:number)=>OBSTACLE_LEVELS[Math.max(0,Math.min(OBSTACLE_LEVELS.length-1,index-1))];
export const OBSTACLE_CATEGORIES=(Object.keys(C) as ObstacleCategory[]).map(id=>({id,name:C[id]}));

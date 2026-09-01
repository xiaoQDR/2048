export interface LevelConfig {
  id: number;
  chapter: number;
  boardSize: 3 | 4;
  target: number;
  moveLimit: number;
  seed: number;
  title: string;
}

const targets = [
  8,16,8,32,16,32,64,32,64,128,
  32,32,32,64,64,64,128,64,128,256,
  16,32,32,64,64,64,128,128,128,256,
  16,16,32,32,64,64,64,128,128,256,
  32,64,64,128,128,128,256,256,256,512
];
const moves = [
  8,12,12,18,16,16,24,22,25,34,
  19,20,21,26,27,28,35,31,38,46,
  16,20,22,27,29,30,38,40,42,50,
  16,20,23,25,30,32,34,40,43,52,
  23,28,30,38,40,43,52,55,58,68
];
const chapterNames = ['初识合成','空间挑战','冰封预演','订单挑战','终极冒险'];

export const LEVELS: LevelConfig[] = targets.map((target, index) => {
  const id=index+1, chapter=Math.floor(index/10)+1;
  return {
    id, chapter,
    boardSize:id<=5?3:4,
    target,
    moveLimit:moves[index],
    seed:204800+id*7919,
    title:chapterNames[chapter-1]
  };
});

export const getLevel=(id:number)=>LEVELS[Math.max(0,Math.min(49,id-1))];

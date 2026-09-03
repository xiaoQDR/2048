import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseMotherCell,move2048} from '../src/core2048';
import {LEVELS} from '../src/levels';
import {MECHANIC_LEVELS} from '../src/mechanicLevels';
import {OBSTACLE_CATEGORIES,OBSTACLE_LEVELS} from '../src/obstacleLevels';

const row=(v:number[])=>[v];
test('three equal tiles merge only the leading pair',()=>{
  assert.deepEqual(move2048(row([2,2,2,0]),'left').grid,[[4,2,0,0]]);
  assert.deepEqual(move2048(row([0,2,2,2]),'right').grid,[[0,0,2,4]]);
});
test('four equal tiles create two merged tiles',()=>{
  assert.deepEqual(move2048(row([2,2,2,2]),'left').grid,[[4,4,0,0]]);
});
test('a merged tile cannot merge again in the same move',()=>{
  assert.deepEqual(move2048(row([4,4,8,0]),'left').grid,[[8,8,0,0]]);
});
test('tiles travel to the farthest available cell',()=>{
  const result=move2048(row([2,0,0,0]),'right');
  assert.deepEqual(result.grid,[[0,0,0,2]]);
  assert.deepEqual(result.transitions[0],{fromR:0,fromC:0,toR:0,toC:3,value:2,kind:'move'});
});
test('invalid moves report no change',()=>{
  const result=move2048(row([2,4,8,16]),'left');
  assert.equal(result.moved,false);assert.equal(result.score,0);assert.deepEqual(result.transitions,[]);
});
test('blocked cells split a line into independent regions',()=>{
  const blocked=new Set(['0,1']);
  assert.deepEqual(move2048(row([2,0,2,0]),'left',blocked).grid,[[2,0,2,0]]);
});
test('vertical traversal uses the leading edge first',()=>{
  const grid=[[2],[2],[2],[0]];
  assert.deepEqual(move2048(grid,'up').grid,[[4],[2],[0],[0]]);
  assert.deepEqual(move2048(grid,'down').grid,[[0],[0],[2],[4]]);
});
test('merge score equals the created tile values',()=>{
  assert.equal(move2048(row([2,2,4,4]),'left').score,12);
});
test('mother tile randomly chooses from available board cells',()=>{
  const unavailable=new Set(['0,0']);
  assert.deepEqual(chooseMotherCell(5,5,unavailable,()=>0),{r:0,c:1});
  assert.deepEqual(chooseMotherCell(5,5,unavailable,()=>.999999),{r:4,c:4});
});
test('mother tile blocks movement like a fixed board cell',()=>{
  const mother={r:0,c:2};
  const blocked=new Set([`${mother.r},${mother.c}`]);
  assert.deepEqual(move2048([[2,0,0,4,0]],'right',blocked).grid,[[0,2,0,0,4]]);
});
test('all regular and mechanic levels define a valid time limit',()=>{
  assert.equal(LEVELS.length,50);assert.equal(MECHANIC_LEVELS.length,50);
  assert.ok(LEVELS.every(level=>Number.isInteger(level.timeLimit)&&level.timeLimit>=40));
  assert.ok(MECHANIC_LEVELS.every(level=>Number.isInteger(level.timeLimit)&&level.timeLimit>=40));
});
test('obstacle lab contains four categories and sixteen unique obstacles',()=>{
  assert.equal(OBSTACLE_CATEGORIES.length,4);assert.equal(OBSTACLE_LEVELS.length,16);
  assert.equal(new Set(OBSTACLE_LEVELS.map(level=>level.id)).size,16);
  for(const category of OBSTACLE_CATEGORIES)assert.equal(OBSTACLE_LEVELS.filter(level=>level.category===category.id).length,4);
});

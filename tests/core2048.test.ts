import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseMotherCell,move2048} from '../src/core2048';

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
test('mother tile uses the nearest available center cell',()=>{
  assert.deepEqual(chooseMotherCell(5,5),{r:2,c:2});
  assert.deepEqual(chooseMotherCell(5,5,new Set(['2,2','1,2'])),{r:2,c:1});
});
test('mother tile blocks movement like a fixed board cell',()=>{
  const mother={r:0,c:2};
  const blocked=new Set([`${mother.r},${mother.c}`]);
  assert.deepEqual(move2048([[2,0,0,4,0]],'right',blocked).grid,[[0,2,0,0,4]]);
});

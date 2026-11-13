const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
test('rings render synchronously and update after returning from a hidden page',()=>{const {chart}=require('./ring-fixture.cjs');const c=chart([{count:432}]);assert.equal(c.data.segments.length,2);c.data.visible=false;c.data.rows=[];c.queue();assert.equal(c.data.segments.length,2);c.data.visible=true;c.queue();assert.equal(c.data.segments.length,0);});

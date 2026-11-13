const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
function deck(items){const file=path.resolve('apps/miniprogram/components/collection-deck/index.js');let spec;vm.runInNewContext(fs.readFileSync(file,'utf8'),{Component:s=>spec=s,require:createRequire(file),wx:{},Date,Math,Array,Object,Number,String,Set,Map,setTimeout,clearTimeout});const data={...spec.data,items,collections:[],kind:'vinyl',pitch:280};const self={data,setData(p,done){Object.assign(data,p);done?.();}};for(const [k,v]of Object.entries(spec.methods))self[k]=v.bind(self);self.rebuild();return self;}
test('circular galleries keep both neighbors and normalize boundary clones without changing record identity',()=>{
 for(const n of [1,2,388]){const c=deck(Array.from({length:n},(_,i)=>({id:String(i),title:String(i)}))),d=c.data,p=d.prefix;assert.equal(d.slides[p-1].id,d.cards[n-1].id);assert.equal(d.slides[p+n].id,d.cards[0].id);assert.equal(new Set(d.slides.map(x=>x.slideKey)).size,d.slides.length);
 c.lastLeft=(p-1)*d.pitch;c.settle();assert.equal(d.current.id,d.cards[n-1].id);assert.equal(d.physical,p+n-1);assert.equal(d.scrollLeft,(p+n-1)*d.pitch);
 c.lastLeft=(p+n)*d.pitch;c.settle();assert.equal(d.active,0);assert.equal(d.physical,p);assert.equal(d.scrollLeft,p*d.pitch);}
 const c=deck([]);c.settle();assert.equal(c.data.current,null);assert.equal(c.data.slides.length,0);
});
test('detail adapter forwards identity, lifecycle and actions and releases original subscriptions',()=>{
 const file=path.resolve('apps/miniprogram/ui/detail-component.js');let component;const context={module:{exports:{}},Component:s=>component=s,require:createRequire(file),Object};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);const calls=[];context.module.exports({data:{record:null},onLoad(o){calls.push(['load',o.albumId,o.ownerId]);},onShow(){calls.push(['show']);},onHide(){calls.push(['hide']);},onUnload(){calls.push(['cleanup']);},openEdit(){calls.push(['edit']);}});
 const self={data:{options:{albumId:'manual:abc',ownerId:'shared-owner'}},setData(p){Object.assign(this.data,p)},triggerEvent:e=>calls.push([e])};for(const [k,v]of Object.entries(component.methods))self[k]=v.bind(self);component.lifetimes.attached.call(self);self.openEdit();self.uiSheetScroll({detail:{scrollTop:88}});assert.equal(self.uiPageTop,88);self.uiSheetClose();component.pageLifetimes.hide.call(self);component.lifetimes.detached.call(self);assert.deepEqual(calls,[['load','manual:abc','shared-owner'],['show'],['edit'],['close'],['hide'],['cleanup']]);assert.equal(self.uiInSheet,true);
});
test('live primary navigation uses the current page and refuses unregistered destinations',()=>{
 const file=path.resolve('apps/miniprogram/packages/live-archive/pages/index/index.js');let spec;const calls=[];vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:s=>spec=s,require:createRequire(file),wx:{pageScrollTo:()=>calls.push('top')},Date});const self={data:{},setData(p){Object.assign(this.data,p)},filter:()=>calls.push('filter'),calc:()=>calls.push('stats'),prepareAllShare:()=>calls.push('share')};spec.uiPrimary.call(self,'add');assert.equal(self.data.tab,'add');spec.uiPrimary.call(self,'stats');assert.equal(self.data.tab,'stats');spec.uiPrimary.call(self,'unknown');assert.equal(self.data.tab,'stats');assert.deepEqual(calls,['filter','share','top','filter','stats','top']);
});
test('gallery gestures preserve immediate single taps, suppress duplicate taps and retain live detail identity',async()=>{
 const c=deck([{id:'one',title:'One'},{id:'two',title:'Two'}]),events=[];
 c.triggerEvent=(name,detail)=>events.push({name,id:detail.id});
 const tap={currentTarget:{dataset:{id:'one'}}};
 c.scroll({detail:{scrollLeft:c.data.scrollLeft}});
 c.touchStart({touches:[{clientX:100,clientY:100}]});c.touchEnd();c.select(tap);
 await new Promise(resolve=>setTimeout(resolve,310));
 assert.deepEqual(events,[{name:'select',id:'one'}]);
 c.touchStart({touches:[{clientX:100,clientY:100}]});c.select(tap);c.select(tap);
 await new Promise(resolve=>setTimeout(resolve,310));
 assert.equal(c.data.discMode,undefined);assert.equal(events.length,1);
 c.touchStart({touches:[{clientX:100,clientY:100}]});c.touchMove({touches:[{clientX:120,clientY:100}]});c.touchEnd();c.select(tap);
 assert.equal(events.length,1);
 c.data.kind='live';c.touchStart({touches:[{clientX:100,clientY:100}]});c.touchEnd();c.select(tap);
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.deepEqual(events[1],{name:'select',id:'one'});
 clearTimeout(c.snapTimer);clearTimeout(c.tapTimer);
 const file=path.resolve('apps/miniprogram/packages/live-archive/pages/index/index.js');let spec;
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:s=>spec=s,require:createRequire(file),wx:{},Date});
 const shown=[],page={data:{records:[{id:'one'}],uiSeenRecords:[{id:'one'}]},setData(p){Object.assign(this.data,p)},uiShowDetail:options=>shown.push(options)};for(const name of ['open','uiPreview','uiPreviewClose','uiPreviewDetail'])page[name]=spec[name].bind(page);
 spec.openDeck.call(page,{detail:events[1]});assert.equal(page.data.uiPreviewRecord.id,'one');assert.equal(shown.length,0);page.uiPreviewDetail();assert.equal(shown[0].id,'one');assert.equal(shown[0].shared,'0');
});

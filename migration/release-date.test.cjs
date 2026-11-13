const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../apps/miniprogram/ui/ticket-data');
const card={id:'a',isCollected:true,title:'专辑',artist:'艺人',cover:'/cover',conditionLabel:'NM / 1 张'};
const release=ticket=>ticket.fields.find(([label])=>label==='发行日期')?.[1];
test('record ticket includes stored release information without inventing a month or day',()=>{
 assert.equal(release(D.vinyl(card,[{id:'a',year:1988}],[],'川')),'1988');
 assert.equal(release(D.vinyl(card,[{id:'a',releaseYear:1992}],[],'川')),'1992');
 assert.equal(release(D.vinyl(card,[{id:'a'}],[],'川')),'未填写');
});
test('release and collection dates remain separate and show tickets keep their attendance date',()=>{
 const ticket=D.vinyl({...card,collectionDateLabel:'收藏于 2025-07'},[{id:'a',year:1988}],[],'川');
 assert.equal(ticket.fields.find(([label])=>label==='收藏时间')[1],'2025-07');
 assert.equal(release(ticket),'1988');
 assert.equal(release(D.live({id:'l',name:'现场',date:'2026-11-01'},[],'川')),undefined);
});

const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const cloud=require('../apps/miniprogram/services/cloud-api');
function editor(year){
 const file=path.resolve('apps/miniprogram/pages/collection-edit/index.js'),realRequire=createRequire(file);let spec,requests=[],toasts=[];
 const app={globalData:{manualAlbums:[{id:'a',title:'专辑',artist:'艺人',year,cover:'/cover',tracks:[]}],collectionItems:[{id:'c',albumId:'a',collectionDate:'2025-07-12',quantity:1,condition:'NM',mediumKey:'vinyl',source:'唱片店',price:399,notes:'保留备注'}],tvBindings:[]},uploadAlbumCoverIfNeeded:async v=>v,isCloudAccountReady:()=>true,
 async saveCollectionToCloud(item,album){const req=cloud.buildCloudCollectionRequest(item,album);requests.push(req);const payload={owner:{id:'u',displayName:'川'},albums:[req.album],collectionItems:[{...req.collection,id:'c',albumId:'a'}]};cloud.applyCloudCollectionPayload(this,payload,[]);return payload;}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:v=>spec=v,require:name=>name==='../../ui/locale-runtime'?{page:v=>v,toast:(_,o)=>toasts.push(o.title),loading(){}}:realRequire(name),getApp:()=>app,wx:{navigateBack(){},hideLoading(){}},Date});
 const self={...spec,data:structuredClone(spec.data),setData(values){for(const [key,value]of Object.entries(values)){const parts=key.split('.');let current=this.data;for(const part of parts.slice(0,-1))current=current[part];current[parts.at(-1)]=value;}}};
 self.loadCollectionForm('a');return {self,app,requests,toasts};
}
test('edit release year survives request normalization and reopening, without changing collection date or notes',async()=>{
 const f=editor(2025);assert.equal(f.self.data.releaseDate,'2025');
 f.self.handleReleaseDateChange({detail:{value:'1998'}});await f.self.saveCollection();
 assert.equal(f.requests[0].album.year,1998);assert.equal(f.requests[0].collection.collectionDate,'2025-07-12');assert.equal(f.requests[0].collection.notes,'保留备注');
 f.self.loadCollectionForm('a');assert.equal(f.self.data.releaseDate,'1998');
 const album=f.app.globalData.manualAlbums.find(a=>a.id==='a');assert.equal(release(D.vinyl(card,[album],[],'川')),'1998');
 f.self.handleReleaseDateChange({detail:{value:''}});await f.self.saveCollection();assert.equal(f.requests[1].album.year,null);f.self.loadCollectionForm('a');assert.equal(f.self.data.releaseDate,'');
});
test('invalid release years never reach save and legacy releaseYear still loads',async()=>{
 const f=editor(undefined);f.app.globalData.manualAlbums[0].releaseYear=1992;f.self.loadCollectionForm('a');assert.equal(f.self.data.releaseDate,'1992');
 for(const value of ['1799','3001','2025.5','20','2e3','年份']){f.self.handleReleaseDateChange({detail:{value}});await f.self.saveCollection();}
 assert.equal(f.requests.length,0);assert.equal(f.toasts.length,6);
});

test('full release day survives editing, cloud normalization and poster data',async()=>{
 const f=editor(2019);f.self.handleReleaseDateChange({detail:{value:'2019-05-21'}});await f.self.saveCollection();
 assert.equal(f.requests[0].album.releaseDate,'2019-05-21');assert.equal(f.requests[0].album.year,2019);
 f.self.loadCollectionForm('a');assert.equal(f.self.data.releaseDate,'2019-05-21');
 assert.equal(release(D.vinyl(card,f.app.globalData.manualAlbums,[],'川')),'2019-05-21');
});
test('calendar validation accepts leap days and preserves written timezone dates',()=>{
 const dates=require('../apps/miniprogram/ui/release-date');
 assert.equal(dates.normalize('2024-02-29'),'2024-02-29');assert.equal(dates.normalize('2019-05-21T00:00:00Z'),'2019-05-21');
 for(const value of ['2023-02-29','2019-04-31','2019-00-01','2019-12-00','2019-13-01'])assert.equal(dates.valid(value),false);
 assert.equal(dates.value({releaseDate:'2019-05-21',year:2019}),'2019-05-21');
});

test('catalog dates survive the search adapter and ISO timestamps become a calendar date in requests',()=>{
 const catalog=require('../apps/miniprogram/services/catalog-api');
 const album=catalog.catalogCandidateToAlbum({id:'a',title:'A',artist:'B',year:2019,releaseDate:'2019-05-21T23:00:00-07:00'});
 const request=cloud.buildCloudCollectionRequest({albumId:'a',collectionDate:'2025-07-12',quantity:1},album);
 assert.equal(request.album.releaseDate,'2019-05-21');
 assert.equal(release(D.vinyl(card,[album],[],'川')),'2019-05-21');
});

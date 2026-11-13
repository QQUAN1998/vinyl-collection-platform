const M=require('../../ui/stats-model');
const snapshot=require('../../ui/stats-snapshot');
const poster=require('../../ui/stats-poster');
Component({
  properties:{visible:{type:Boolean,value:true},avatar:{type:String,value:''},records:{type:Array,value:[]},kind:{type:String,value:'vinyl'},owner:{type:String,value:'音乐收藏者'},readOnly:{type:Boolean,value:false},mediaShare:{type:String,value:''},snapshotOptions:{type:Object,value:null},collectionShareReady:{type:Boolean,value:false},collectionPreparing:{type:Boolean,value:false}},
  data:{year:'全部年份',timelineYear:'全部年份',rankMetric:'count',currency:'CNY',layout:[],panel:'',panelTitle:'',posterChoices:[],generating:false,posterUrls:[],detailCosts:[],detailRecords:[],timeline:[],totals:[],metrics:[],months:[],years:[],ranks:[],formats:[],cities:[]},
  observers:{'records,kind,snapshotOptions':function(){this.rebuild();}},
  methods:{
    rebuild(){if(!this.data.kind)return;const opt=this.data.snapshotOptions;if(opt&&!this.loadedSnapshot){this.loadedSnapshot=true;Object.assign(this.data,{year:opt.year,timelineYear:opt.timelineYear,rankMetric:opt.rankMetric,currency:opt.currency,layout:M.normalizeLayout(this.data.kind,opt.layout)});}const layout=M.normalizeLayout(this.data.kind,this.data.layout),view=M.view(this.data.records,this.data.kind,this.data);const safe=row=>this.failedImages?.has(row.cover)?{...row,cover:''}:row;view.ranks=view.ranks.map(safe);view.timeline=view.timeline.map(safe);let offset=0;const segments=view.formats.map(r=>{const a=offset;offset+=r.count/(view.units||1)*100;return r.color+' '+a+'% '+offset+'%';});this.setData({...view,timelinePreview:view.timeline.slice(0,5),layout,ownerInitial:Array.from(this.data.owner||'音')[0],timelineYearLabels:view.timelineYears.map(y=>y+' · '+this.data.records.filter(r=>y==='全部年份'||r.date.startsWith(y)).length+(this.data.kind==='live'?' 场':' 张')),timelineYearLabel:this.data.timelineYear+' · '+view.timeline.length+(this.data.kind==='live'?' 场':' 张'),donutGradient:segments.length?'conic-gradient('+segments.join(',')+')':'#eef1e9'});},
    yearChange(e){this.setData({year:this.data.years[Number(e.detail.value)]});this.rebuild();},
    timelineChange(e){this.setData({timelineYear:this.data.timelineYears[Number(e.detail.value)]});this.rebuild();},
    rankChange(e){this.setData({rankMetric:e.currentTarget.dataset.metric});this.rebuild();},
    currencyChange(e){this.setData({currency:this.data.currencies[Number(e.detail.value)]});this.rebuild();},
    selectRecord(e){if(this.data.readOnly)return;this.close();this.triggerEvent('select',{id:e.currentTarget.dataset.id});},
    imageError(e){const src=e.currentTarget.dataset.src;if(!src||this.failedImages?.has(src))return;if(!this.failedImages)this.failedImages=new Set();this.failedImages.add(src);this.setData({detailRecords:this.data.detailRecords.map(row=>row.cover===src?{...row,cover:''}:row)});this.rebuild();},
    showDetail(title,rows,withCosts=true){rows=rows.map(row=>this.failedImages?.has(row.cover)?{...row,cover:''}:row);this.setData({panel:'detail',panelTitle:title,detailRecords:rows,detailCosts:withCosts?M.costs(rows):[]});},
    monthDetail(e){const month=this.data.months.find(r=>r.month===Number(e.currentTarget.dataset.month));if(month)this.showDetail(this.data.year+' · '+month.month+'月',month.entries);},
    openTimeline(){this.setData({panel:'timeline',panelTitle:'完整时间线',detailRecords:this.data.timeline,detailCosts:[]});},
    genreDetail(e){const name=e.currentTarget.dataset.name;this.showDetail(name,this.data.list.filter(r=>(r.genre||'未分类')===name));},
    artistDetail(e){const name=e.currentTarget.dataset.name;this.showDetail(name,this.data.list.filter(r=>this.data.kind==='live'?r.artist.split(/[/／、]/).map(s=>s.trim()).includes(name):r.artist===name));},
    cityDetail(e){const name=e.currentTarget.dataset.name;this.showDetail(name,this.data.list.filter(r=>r.city===name));},
    exactAmount(e){this.setData({panel:'detail',panelTitle:'花费明细',detailRecords:[],detailCosts:this.data.totals});},
    openLayout(){this.setData({panel:'layout',panelTitle:'统计排列',layoutDraft:this.data.layout.map(r=>({...r}))});},
    layoutCheck(e){const rows=this.data.layoutDraft.map(r=>({...r}));rows[Number(e.currentTarget.dataset.index)].visible=e.detail.value.includes('on');this.setData({layoutDraft:rows});},
    moveLayout(e){const rows=this.data.layoutDraft.slice(),i=Number(e.currentTarget.dataset.index),j=i+Number(e.currentTarget.dataset.step);if(j<0||j>=rows.length)return;[rows[i],rows[j]]=[rows[j],rows[i]];this.setData({layoutDraft:rows});},
    resetLayout(){this.setData({layoutDraft:M.normalizeLayout(this.data.kind)});},
    applyLayout(){this.setData({layout:M.normalizeLayout(this.data.kind,this.data.layoutDraft),panel:''});},
    openShare(){this.setData({panel:'share',panelTitle:'统计分享'});if(!this.data.readOnly)this.triggerEvent('collectionshare',{passive:true});},
    prepareCollectionShare(){if(!this.data.readOnly&&!this.data.collectionPreparing)this.triggerEvent('collectionshare',{passive:false});},
    openModules(){const old=new Map(this.data.posterChoices.map(r=>[r.id,r.selected]));const rows=[{id:'costs',label:'花费'},{id:'overview',label:'数据概览'},...this.data.layout.filter(r=>r.visible)].map(r=>({...r,selected:old.get(r.id)!==false}));this.setData({panel:'modules',panelTitle:'选择分享模块',posterChoices:rows});},
    posterCheck(e){const selected=new Set(e.detail.value);this.setData({posterChoices:this.data.posterChoices.map(r=>({...r,selected:selected.has(r.id)}))});},
    openLink(){try{const data={v:1,kind:this.data.kind,owner:this.data.owner,avatar:this.data.avatar,records:this.data.records,year:this.data.year,timelineYear:this.data.timelineYear,rankMetric:this.data.rankMetric,currency:this.data.currency,layout:this.data.layout,mediaShare:this.data.mediaShare},message=snapshot.message(data);this.triggerEvent('snapshot',{message});this.setData({panel:'link',panelTitle:'页面链接',sharePath:message.path});}catch(e){wx.showToast({title:e.message,icon:'none'});}},
    copyPath(){if(this.data.sharePath)wx.setClipboardData({data:this.data.sharePath});},
    async generatePoster(){const modules=this.data.posterChoices.filter(r=>r.selected).map(r=>r.id);if(!modules.length)return wx.showToast({title:'请至少选择一个模块',icon:'none'});this.setData({generating:true});try{const result=await poster.render(this,modules);this.setData({posterUrls:result,panel:'poster',panelTitle:'统计海报'});}catch(e){wx.showToast({title:e.message||'图片生成失败，请重试',icon:'none'});}finally{this.setData({generating:false});}},
    previewPoster(e){wx.previewImage({urls:this.data.posterUrls,current:this.data.posterUrls[Number(e.currentTarget.dataset.index)]});},
    async savePosters(){try{for(const filePath of this.data.posterUrls)await wx.saveImageToPhotosAlbum({filePath});wx.showToast({title:'已保存',icon:'success'});}catch(e){wx.showModal({title:'保存图片',content:'请允许保存图片到相册，也可以预览图片后长按保存。',confirmText:'查看图片',success:r=>{if(r.confirm)wx.previewImage({urls:this.data.posterUrls});}});}},
    close(){this.setData({panel:''});},noop(){}
  }
});

const uiLocale=require("../../ui/locale-runtime");
const iso=(y,m,d)=>y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
Component(uiLocale.component({
  properties:{value:{type:String,value:''},label:{type:String,value:'选择日期'},disabled:{type:Boolean,value:false},required:{type:Boolean,value:false},start:{type:String,value:'1900-01-01'},end:{type:String,value:'2100-12-31'}},
  data:{opened:false,year:2026,month:0,yearIndex:126,years:Array.from({length:201},(_,i)=>String(1900+i)+'年'),months:Array.from({length:12},(_,i)=>String(i+1)+'月'),weekdays:['一','二','三','四','五','六','日'],days:[]},
  observers:{value(value){this.setData({displayDate:String(value||'').replace(/-/g,"/")});}},
  methods:{nativeChange(e){if(!this.data.disabled)this.select(e.detail.value);},
    open(){if(this.data.disabled)return;const date=/^\d{4}-\d{2}-\d{2}$/.test(this.data.value)?new Date(this.data.value+'T12:00:00'):new Date();this.setData({opened:true,year:date.getFullYear(),month:date.getMonth()});this.draw();},
    draw(){const {year,month,value,start,end}=this.data,offset=(new Date(year,month,1).getDay()+6)%7,today=new Date(),now=iso(today.getFullYear(),today.getMonth(),today.getDate());const days=Array.from({length:offset},(_,i)=>({id:'blank'+i,blank:true}));for(let d=1;d<=new Date(year,month+1,0).getDate();d++){const date=iso(year,month,d);days.push({id:date,day:d,selected:date===value,today:date===now,disabled:date<start||date>end});}this.setData({days,yearIndex:year-1900});},
    move(e){const date=new Date(this.data.year,this.data.month+Number(e.currentTarget.dataset.step),1);if(date.getFullYear()<1900||date.getFullYear()>2100)return;this.setData({year:date.getFullYear(),month:date.getMonth()});this.draw();},
    yearChange(e){this.setData({year:1900+Number(e.detail.value)});this.draw();},
    monthChange(e){this.setData({month:Number(e.detail.value)});this.draw();},
    choose(e){this.select(e.currentTarget.dataset.value);},
    select(value){if(value&&(value<this.data.start||value>this.data.end))return;this.triggerEvent('change',{value});this.setData({opened:false});},
    today(){const d=new Date();this.select(iso(d.getFullYear(),d.getMonth(),d.getDate()));},clear(){this.triggerEvent('clear');this.select('');},close(){this.setData({opened:false});},noop(){}
  }
}));

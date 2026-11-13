const poster=require('../../ui/ticket-poster');
const locale=require('../../ui/locale-runtime');
Component(locale.component({
 properties:{ticket:{type:Object,value:null}},
 data:{generating:true,url:'',error:'',saving:false,posterHeight:1000},
 lifetimes:{ready(){this.generate();},detached(){this.closed=true;}},
 methods:{
  noop(){},close(){this.triggerEvent('close');},
  async generate(){if(this.running||!this.data.ticket)return;this.running=true;await new Promise(resolve=>this.setData({generating:true,error:'',url:''},resolve));
   try{const url=await poster.render(this,this.data.ticket);if(!this.closed)this.setData({url});}
   catch(e){if(!this.closed)this.setData({error:e.message||'海报生成失败，请重试'});}
   finally{this.running=false;if(!this.closed)this.setData({generating:false});}
  },
  preview(){if(this.data.url)wx.previewImage({urls:[this.data.url]});},
  async save(){if(this.data.saving||!this.data.url)return;this.setData({saving:true});
   try{await wx.saveImageToPhotosAlbum({filePath:this.data.url});locale.toast(wx,{title:'已保存',icon:'success'});}
   catch(e){if(!this.closed)locale.modal(wx,{title:'保存海报',content:'请允许保存到相册，也可以打开图片后长按保存。',confirmText:'查看图片',success:r=>{if(r.confirm)this.preview();}});}
   finally{if(!this.closed)this.setData({saving:false});}
  }
 }
}));

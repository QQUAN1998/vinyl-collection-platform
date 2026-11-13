const uiLocale=require("../../ui/locale-runtime");
const {switchSpace}=require('../../ui/space-navigation');
Component(uiLocale.component({properties:{current:{type:String,value:'vinyl'}},methods:{open(event){const space=event.currentTarget.dataset.space;if(space&&space!==this.properties.current)switchSpace(space,wx);}}}));

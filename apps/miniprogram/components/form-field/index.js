const uiLocale=require("../../ui/locale-runtime");
Component(uiLocale.component({
  properties: {
    label: {
      type: String,
      value: ""
    },
    value: {
      type: String,
      value: ""
    },
    placeholder: {
      type: String,
      value: ""
    },
    type: {
      type: String,
      value: "text"
    },
    mode: {
      type: String,
      value: "input"
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },
  data:{isDate:false,isCondition:false,conditions:["M","NM","VG+","VG","G+","G","F","P"],conditionIndex:0},
  observers:{"label,value":function(label,value){this.setData({isDate:label.includes("日期"),isCondition:label.includes("品相"),conditionIndex:Math.max(0,["M","NM","VG+","VG","G+","G","F","P"].indexOf(value))});}},
  methods: {
    conditionChange(e){this.triggerEvent("change",{value:this.data.conditions[Number(e.detail.value)]});},
    handleInput(event) {
      this.triggerEvent("change", {
        value: event.detail.value
      });
    }
  }
}));

const uiLocale=require("../../ui/locale-runtime");
Component(uiLocale.component({
  properties: {
    label: {
      type: String,
      value: "收藏形式",
    },
    options: {
      type: Array,
      value: [],
    },
    selectedKey: {
      type: String,
      value: "vinyl",
    },
  },
  data:{selectedIndex:0,selectedLabel:"黑胶"},
  observers:{"options,selectedKey":function(options,key){const index=Math.max(0,options.findIndex(r=>r.key===key));this.setData({selectedIndex:index,selectedLabel:options[index]?.label||"黑胶"});}},
  methods: {
    handleSelect(e){const row=this.data.options[Number(e.detail.value)];if(row)this.handleOption({currentTarget:{dataset:{key:row.key}}});},
    handleOption(event) {
      const { key } = event.currentTarget.dataset;
      this.triggerEvent("change", {
        value: key,
      });
    },
  },
}));

// Presentation adapter; batch parsing/matching and account share paths reuse existing services.
const uiImport=require('../../services/import-service');
const uiAddMethods={
  uiMethod(e){this.cancelOnlineSearch();this.setData({uiMethod:e.currentTarget.dataset.method,uiError:''});},
  uiBatchInput(e){this.setData({uiBatchText:e.detail.value,uiError:''});},
  uiMatchBatch(){try{const app=getApp(),parsed=uiImport.parseBatchInput(this.data.uiBatchText||''),matches=uiImport.matchAlbumCandidates(parsed.entries,albums,app.globalData.collectionItems||[]);app.globalData.importDraft={source:'batch',batchText:this.data.uiBatchText,parsed,matches,selectedAlbumIds:uiImport.getDefaultSelectedAlbumIds(matches),candidates:matches.flatMap(match=>match.candidates)};wx.navigateTo({url:'/pages/search-results/index'});}catch(e){this.setData({uiError:e.message});}},
};

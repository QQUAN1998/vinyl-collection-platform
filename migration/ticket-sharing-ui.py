"""Owner-initiated, local-only ticket posters for both collection previews."""
share=(DEST/'assets/ui/share.svg').read_text(encoding='utf-8')
write('assets/ui/share-light.svg',share.replace('#000000','#ffffff'))
for name in ['ticket-data.js','ticket-poster.js']:
    write('ui/'+name,(UI/name).read_text(encoding='utf-8'))
for f in (UI/'ticket-share').iterdir():
    write('components/ticket-share/'+f.name,f.read_text(encoding='utf-8'))
for rel,depth,kind in [('pages/cabinet/index','../../','vinyl'),('packages/live-archive/pages/index/index','../../../../','live')]:
    cfg=json.loads((DEST/(rel+'.json')).read_text(encoding='utf-8'))
    cfg.setdefault('usingComponents',{})['ticket-share']='/components/ticket-share/index'
    write(rel+'.json',json.dumps(cfg,ensure_ascii=False,indent=2))
    markup=(DEST/(rel+'.wxml')).read_text(encoding='utf-8')
    at=markup.index('<view class="ui-dialog-actions">')+len('<view class="ui-dialog-actions">')
    end=markup.index('</view>',at)
    condition='albumCard.isCollected' if kind=='vinyl' else '!shared'
    button='<button wx:if="{{'+condition+'}}" class="ui-dialog-share" bindtap="uiTicketShare" aria-label="分享收藏票根"><image src="/assets/ui/share{{uiThemeClass===\'theme-dark\'?\'-light\':\'\'}}.svg" mode="aspectFit"/></button>'
    markup=markup[:end]+button+markup[end:]
    end=markup.index('</view>',at)
    actions=markup[at:end]
    labels=['查看详情','编辑唱片','删除唱片','分享唱片'] if kind=='vinyl' else ['查看详情','编辑演出','删除演出','分享演出']
    for cls,label in zip(['primary','secondary','delete','share'],labels):
        pattern=r'(<button\b[^>]*class="ui-dialog-'+cls+r'"[^>]*>)(.*?)(</button>)'
        def labeled(match):
            caption="{{i18n.t('"+label+"',uiLanguage)}}"
            opening=re.sub(r'aria-label="[^"]*"','aria-label="'+caption+'"',match[1])
            return opening+match[2]+'<text>'+caption+'</text>'+match[3]
        actions,count=re.subn(pattern,labeled,actions)
        assert count==1,(rel,cls)
    markup=markup[:at]+actions+markup[end:]
    write(rel+'.wxml',markup+'\n<ticket-share wx:if="{{uiTicket}}" ticket="{{uiTicket}}" bindclose="uiTicketClose"/>\n')
    script=(DEST/(rel+'.js')).read_text(encoding='utf-8')
    if kind=='vinyl':
        method='uiTicketShare(){const ticket=uiTicketData.vinyl(this.data.albumCard,this.data.deckAlbums,this.data.deckCollections,this.data.deckOwner,this.data.deckAvatar);if(ticket)this.setData({uiTicket:ticket});},'
    else:
        method='uiTicketShare(){if(this.data.shared)return;const ticket=uiTicketData.live(this.data.uiPreviewRecord,this.data.uiSeenRecords,this.data.account?.name,this.data.account?.avatar);if(ticket)this.setData({uiTicket:ticket});},'
    assert '  noop(){' in script or '  noop() {' in script,rel
    pos=script.index('  noop()')
    script=script[:pos]+'  '+method+'\n  uiTicketClose(){this.setData({uiTicket:null});},\n'+script[pos:]
    write(rel+'.js',"const uiTicketData=require('"+depth+"ui/ticket-data');\n"+script)
    style=(DEST/(rel+'.wxss')).read_text(encoding='utf-8')
    write(rel+'.wxss',style+'\n.ui-album-dialog .ui-album-sheet .ui-dialog-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px!important}.ui-album-dialog .ui-album-sheet .ui-dialog-actions button{display:flex!important;align-items:center;justify-content:center;gap:7px;flex:none!important;width:100%!important;min-width:0!important;height:48px!important;min-height:48px!important;margin:0!important;padding:8px!important;border-radius:14px!important;font-size:12px!important;line-height:16px!important;white-space:normal}.ui-album-dialog .ui-album-sheet .ui-dialog-actions button image{flex:0 0 20px;width:20px!important;height:20px!important}.ui-album-dialog .ui-album-sheet .ui-dialog-actions button text{min-width:0;max-width:calc(100% - 27px);white-space:normal;overflow-wrap:break-word}.ui-album-dialog .ui-album-sheet .ui-dialog-actions button:only-child{grid-column:1/-1}\n')

# The removed double-tap appearance must never be restored from an old preference.
rel='components/collection-deck/index.wxss'
s=(DEST/rel).read_text(encoding='utf-8')
s=re.sub(r'\.is-disc [^{}]+\{[^{}]*\}|\.disc-hole\{[^{}]*\}', '', s)
s=s.replace(':not(.is-disc)','')
write(rel,s)

"""Full release-date editor; retain genuine year-only legacy data."""
rel='pages/collection-edit/index'
s=(DEST/(rel+'.js')).read_text(encoding='utf-8')
s="const releaseDates=require('../../ui/release-date');\n"+s
assert s.count('    album: null,')==1
s=s.replace('    album: null,', '    album: null,\n    releaseDate: "",',1)
s=s.replace('album.year || album.releaseYear || "未记录"','releaseDates.value(album) || "未记录"')
marker='      collectionForm: {\n        collectionDate: collectionItem.collectionDate,'
assert marker in s
s=s.replace(marker,'      releaseDate: releaseDates.value(album),\n'+marker,1)
marker='  handleFieldChange(event) {'
s=s.replace(marker,'  handleReleaseDateChange(event) {\n    const value = String(event.detail.value || "");\n    this.setData({ releaseDate: value, "album.yearLabel": value || "未记录" });\n  },\n'+marker,1)
marker='    const app = getApp();\n    const me = await requireCloudAccount(app);'
assert s.count(marker)==2
s=s.replace(marker,'    const releaseDate = String(this.data.releaseDate || "").trim();\n    if (!releaseDates.valid(releaseDate)) {\n      uiLocale.toast(wx, { title: "请选择有效的发行日期", icon: "none" });\n      return;\n    }\n\n'+marker,1)
marker='        ...this.data.album,\n        cover,\n        coverUrl: cover,'
assert marker in s
s=s.replace(marker,'        ...this.data.album,\n        ...releaseDates.fields(releaseDate),\n        yearLabel: releaseDate || "未记录",\n        cover,\n        coverUrl: cover,',1)
write(rel+'.js',s)
markup=(DEST/(rel+'.wxml')).read_text(encoding='utf-8')
marker='      <form-field label="收藏日期"'
assert marker in markup
markup=markup.replace(marker,'      <form-field label="发行日期" placeholder="YYYY-MM-DD" value="{{releaseDate}}" bind:change="handleReleaseDateChange" />\n'+marker,1)
write(rel+'.wxml',markup)
# Existing cloud payload remains the same except this optional date field.
rel='services/cloud-api.js';s="const releaseDates=require('../ui/release-date');\n"+(DEST/rel).read_text(encoding='utf-8')
s=s.replace('    year: album.year || album.releaseYear || undefined,','    year: album.year || album.releaseYear || undefined,\n    releaseDate: album.releaseDate === undefined ? undefined : releaseDates.normalize(album.releaseDate) || null,',1)
s=s.replace('    year: album.year === undefined ? album.releaseYear || null : album.year,','    year: album.year === undefined ? album.releaseYear || null : album.year,\n    releaseDate: album.releaseDate === undefined ? undefined : releaseDates.normalize(album.releaseDate) || null,',1);write(rel,s)
rel='pages/album-detail/index.js';s=(DEST/rel).read_text(encoding='utf-8');s="const releaseDates=require('../../ui/release-date');\n"+s
s=s.replace('{ label: "发行年份", value: `${album.year || album.releaseYear || "未记录"}` }','{ label: "发行日期", value: releaseDates.value(album) || "未记录" }');write(rel,s)
rel='pages/manual-add/index.js';s=(DEST/rel).read_text(encoding='utf-8');s="const releaseDates=require('../../ui/release-date');\n"+s
s=s.replace('      year: "",','      releaseDate: "",')
s=s.replace('    const me = await requireCloudAccount(app);','    if (!releaseDates.valid(form.releaseDate)) {\n      uiLocale.toast(wx,{title:"请选择有效的发行日期",icon:"none"});return;\n    }\n    const me = await requireCloudAccount(app);',1)
s=s.replace('      year: Number(form.year || new Date().getFullYear()),','      ...releaseDates.fields(form.releaseDate),')
write(rel,s)
rel='pages/manual-add/index.wxml';s=(DEST/rel).read_text(encoding='utf-8').replace('label="发行年份" type="number" placeholder="1994" value="{{manualForm.year}}" data-key="year"','label="发行日期" placeholder="YYYY-MM-DD" value="{{manualForm.releaseDate}}" data-key="releaseDate"');write(rel,s)

rel='services/catalog-api.js';s=(DEST/rel).read_text(encoding='utf-8')
marker='    year: candidate.year || previousAlbum.year || undefined,'
assert s.count(marker)==1
s=s.replace(marker,marker+'\n    releaseDate: candidate.releaseDate || previousAlbum.releaseDate || undefined,')
write(rel,s)

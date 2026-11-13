"""Final, reproducible cleanup of cancelled display paths; preserve legacy storage contracts."""
import re

cleanup_counts = {'darkRules': 0, 'darkExpressions': 0, 'removedUnusedFiles': []}

def replace_once(text, old, new):
    assert text.count(old) == 1, old[:100]
    return text.replace(old, new, 1)

rel = 'packages/live-archive/pages/index/index.js'
s = (DEST / rel).read_text(encoding='utf-8')
s = re.sub(r'function today\(\) \{.*?\n\}\n', '', s, count=1, flags=re.S)
s = s.replace('const artistExpenses = require("../../shared/artist-expenses");\n', '')
s = s.replace('uiSeenRecords:[],uiSeenCount:0,', '')
s = s.replace('    status: "全部",\n    statuses: ["全部", "已看过", "已购票", "想看"],\n', '')
s = replace_once(s, '  update(records) {', '  update(records) {\n    records = (records || []).filter(Boolean).map(record => record.status === "已看过" ? record : {...record, status:"已看过"});')
s = re.sub(r'      uiSeenRecords:.*?\n      uiSeenCount:.*?\n', '', s)
s = s.replace('    recent: [],\n', '')
s = re.sub(r'      recent: records.*?\.slice\(0, 3\),\n', '', s, count=1, flags=re.S)
s = s.replace('        (d.status === "全部" || r.status === d.status) &&\n', '')
s = s.replace('this.data.tab==="collection"?rows:rows.filter(record => record.status === "已看过")', 'rows')
s = s.replace('this.data.uiSeenRecords', 'this.data.records')
s = replace_once(s, 'api.call("share")', 'api.call("share", { scope: "all" })')
s = re.sub(r'  status\(e\) \{.*?\n  \},\n', '', s, count=1, flags=re.S)
s = s.replace('status: fields.date && fields.date < today() ? "已看过" : "想看"', 'status: "已看过"')
s = re.sub(r'status:\s*result.fields\?\.date && result.fields.date >= today\(\)\s*\? "想看"\s*: "已看过"', 'status: "已看过"', s)
s = s.replace('status: s.date >= today() ? "想看" : "已看过"', 'status: "已看过"')
s = s.replace('      tickets: [],\n    };', '      tickets: [],\n      status: "已看过",\n    };', 1)
s = s.replace('query: "", status: "全部",', 'query: "",')
# stats-board owns ranking, expense and chart presentation. Annual export still uses stats/timeline.
a = s.index('  calc() {'); b = s.index('  tab(e) {', a)
s = s[:a] + '''  calc() {
    const year = this.data.year === "全部年份" ? "" : this.data.year;
    this.setData({
      uiStatsRecords: uiStats.liveRecords(this.data.records),
      stats: statistics(this.data.records, year),
      timeline: this.data.records.filter(r => !year || r.date.startsWith(year)).slice().sort((a,b) => b.date.localeCompare(a.date)),
    });
  },
''' + s[b:]
for name in ['months','artistCards','artistExpenseCurrencies','artistExpenseCards','rankedArtists','cityCards','expenses']:
    s = re.sub(r'    '+name+r': \[\],\n', '', s)
for name in ['artistRankMode','artistExpenseCurrency','expensePercent']:
    s = re.sub(r'    '+name+r': [^\n]+\n', '', s)
# Removed rank controls have no binding or callers; stats-board provides their replacement.
a=s.index('  rank(e) {');b=s.index('  exitShare()',a);s=s[:a]+s[b:]
write(rel, s)
rel='packages/live-archive/pages/index/index.wxml'
s=(DEST/rel).read_text(encoding='utf-8').replace('uiSeenRecords','records').replace('uiSeenCount','count');write(rel,s)

rel='packages/live-archive/pages/edit/edit.js'
s=(DEST/rel).read_text(encoding='utf-8').replace('{ STATUS, TYPES, CURRENCIES, validDate }','{ TYPES, CURRENCIES, validDate }').replace('statuses: STATUS, ','')
s=re.sub(r'    statusIndex: 0,\n|      statusIndex: Math.max\(0, STATUS.indexOf\(fields.status \|\| "已看过"\)\),\n','',s)
s=s.replace('        status: "已看过",\n','').replace('        ...fields,','        ...fields,\n        status: "已看过",')
a=s.index('  picker(e) {');b=s.index('  dateChange(e)',a)
s=s[:a]+'''  picker(e) {
    const index = Number(e.detail.value);
    if (this.data.busy || e.currentTarget.dataset.key !== "type" || !this.data.types[index]) return;
    this.setData({"draft.type":this.data.types[index], typeIndex:index});
  },
'''+s[b:]
s=s.replace('{ ...this.data.draft, expenses }','{ ...this.data.draft, status:"已看过", expenses }');write(rel,s)
rel='packages/live-archive/pages/edit/edit.wxml'
s=(DEST/rel).read_text(encoding='utf-8').replace("{{draft.status === '已看过' ? ' *' : ''}}",' *');write(rel,s)
rel='packages/live-archive/pages/detail/detail.js'
s=(DEST/rel).read_text(encoding='utf-8').replace('const { STATUS } = require("../../shared/domain");\n','').replace('    statuses: STATUS,\n','')
s=re.sub(r'  status\(e\) \{.*?\n  \},\n','',s,count=1,flags=re.S);write(rel,s)
rel='packages/live-archive/pages/detail/detail.wxml'
s=(DEST/rel).read_text(encoding='utf-8');s,n=re.subn(r'<view[^>]*class="[^"]*fact-item[^"]*"[^>]*>\s*<text[^>]*>[^<]*状态[^<]*</text>\s*<text[^>]*>\{\{record.status\}\}</text>\s*</view>','',s);assert n==1,n;write(rel,s)

# All accepted display preferences are now light. Remove inactive dark-only branches/rules.
expressions={"{{uiThemeClass==='theme-dark'?'-light':''}}":'',"{{uiThemeClass==='theme-dark'?'#f2f3ed':'#171a17'}}":'#171a17',"{{uiThemeClass==='theme-dark'?'#101113':'#f5f6f2'}}":'#f5f6f2'}
for file in DEST.rglob('*.wxml'):
    s=file.read_text(encoding='utf-8');original=s
    for old,new in expressions.items():
        cleanup_counts['darkExpressions']+=s.count(old);s=s.replace(old,new)
    if s!=original:write(file.relative_to(DEST).as_posix(),s)

# Flat selector blocks only; leave imports, media/keyframe structure, and fallbacks untouched.
flat_rule=re.compile(r'([^{}]+)\{([^{}]*)\}')
def clean_css(s):
    def rule(m):
        prefix=m.group(1);body=m.group(2)
        # Comments belong to the preceding source; do not treat them as selectors.
        split=prefix.rfind('*/')+2 if '*/' in prefix else 0
        lead,selectors=prefix[:split],prefix[split:]
        if '@' in selectors:return m.group(0)
        choices=selectors.split(',');kept=[x for x in choices if '.theme-dark' not in x]
        cleanup_counts['darkRules']+=len(choices)-len(kept)
        return lead+(','.join(kept)+'{'+body+'}' if kept else '')
    return flat_rule.sub(rule,s)
for file in DEST.rglob('*.wxss'):
    original=file.read_text(encoding='utf-8');s=clean_css(original)
    if s!=original:write(file.relative_to(DEST).as_posix(),s)
# These generated extras have no inbound references. CSS is already flattened above.
unused=['ui/poster-tone.js','ui/stats-layout.wxss','ui/stats-polish.wxss','ui/stats-refinement.wxss']+[f'assets/ui/{name}-light.svg' for name in ['calendar','delete','detail','edit','share']]
source_text='\n'.join(p.read_text(encoding='utf-8') for p in DEST.rglob('*') if p.suffix in ['.js','.json','.wxss','.wxml','.wxs'] and 'tests' not in p.parts)
for rel in unused:
    file=DEST/rel
    # A comment naming a flattened stylesheet is not an import.
    ref_pattern=r"(?:require\(\s*|@import\s*)[\"'][^\"']*"+re.escape(file.stem)+r"(?:\.js|\.wxss)?[\"']"
    assert not re.search(ref_pattern,source_text),rel
    if file.suffix=='.svg':assert file.name not in source_text,rel
    assert rel not in META['files'],rel
    if file.exists():file.unlink();cleanup_counts['removedUnusedFiles'].append(rel)

# Statistics exports follow the single accepted appearance too.
rel='ui/stats-poster.js';s=(DEST/rel).read_text(encoding='utf-8')
s=re.sub(r"const dark=data.uiThemeClass==='theme-dark';const bg=.*?;", "const bg='#f5f6f2',ink='#171a17',muted='#687063',lime='#d1ff66',line='#e3e7de',surface='#ffffff',graph='#53664b';",s,count=1)
s=re.sub(r"dark\?'#[0-9a-fA-F]+'\s*:\s*'(#[0-9a-fA-F]+)'",lambda m:"'"+m[1]+"'",s)
assert 'dark?' not in s and 'theme-dark' not in s
write(rel,s)
(ROOT/'migration/cleanup-report.json').write_text(json.dumps({'checkedAt':datetime.datetime.now().isoformat(),**cleanup_counts,'preserved':['legacy storage/schema compatibility','annual export','original sources and backups'],'removed':['status choices and status filtering','duplicate page-level ranking calculations','dark display markup and CSS']},ensure_ascii=False,indent=2),encoding='utf-8')

const {symbol}=require('./stats-model');
// Presentation only: never writes a record or changes a service payload.
const {getCollectionQuantity}=require('../services/stats-service');
function money(amount) {
  return Number(amount || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
function expenses(rows, ticketsOnly) {
  const totals = {};
  (rows || []).forEach(row => {
    if (ticketsOnly && row.type !== '票价') return;
    const currency = row.currency || 'CNY';
    const digits = ['JPY', 'KRW'].includes(currency) ? 0 : 2;
    const minor = row.minor != null && row.minor !== '' && Number.isFinite(Number(row.minor)) ? Number(row.minor) : Math.round(Number(row.amount || 0) * 10 ** digits);
    if (Number.isFinite(minor)) totals[currency] = (totals[currency] || 0) + minor;
  });
  return Object.keys(totals).sort((a, b) => a === b ? 0 : a === 'CNY' ? -1 : b === 'CNY' ? 1 : a.localeCompare(b))
    .map(currency => ({ currency, value: totals[currency] / (['JPY', 'KRW'].includes(currency) ? 1 : 100) }));
}
function buildDeck(items, collections, kind, metric, ascending, showAmount) {
  const collectionMap = new Map((collections || []).map(row => [row.albumId, row]));
  const artistCounts = {};
  const source = (items || []).filter(item => item && !item.placeholder).map(item => {
    const collection = collectionMap.get(item.id) || {};
    const isLive = kind === 'live';
    const date = String(isLive ? item.date || '' : collection.collectionDate || '');
    const ticket = isLive && showAmount ? expenses(item.expenses, true) : [];
    const price = Number(collection.price || 0);
    const artist = item.artist || '';
    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    return { id: item.id, title: item.title || item.name || '', artist,
      cover: item.cover || item.posterUrl || (item.coverUrl ? (/^(https?:|cloud:)/.test(item.coverUrl) ? item.coverUrl : '/' + item.coverUrl.replace(/^\/+/,'')) : ''),
      date, city: item.city || '', year: item.year || date.slice(0, 4),
      price: isLive ? (ticket[0]?.value || 0) : price,
      priceCurrency: isLive ? (ticket[0]?.currency || '') : 'CNY',
      amountLabel: showAmount ? (isLive ? ticket.map(row => symbol(row.currency) + money(row.value)).join(' · ') : '￥' + money(price)) : '',
      status: item.status || '', sequence: '' };
  });
  const dated = source.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date)).slice()
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const order = new Map(dated.map((row, index) => [row.id, index + 1]));
  source.forEach(row => { row.sequence = order.get(row.id) || ''; });
  source.sort((a, b) => {
    let diff = metric === 'price' ? a.priceCurrency.localeCompare(b.priceCurrency) || a.price - b.price
      : metric === 'artist' ? (artistCounts[a.artist] - artistCounts[b.artist]) || a.artist.localeCompare(b.artist)
        : a.date.localeCompare(b.date);
    return (ascending ? diff : -diff) || String(a.id).localeCompare(String(b.id));
  });
  let totals;
  if (!showAmount) totals = [];
  else if (kind === 'live') totals = expenses((items || []).flatMap(row => row.expenses || []), false);
  else totals = [{ currency: 'CNY', value: (collections || []).reduce((sum, row) => sum + Number(row.price || 0) * (Number(row.quantity) > 0 ? Number(row.quantity) : 1), 0) }];
  const owned=(collections||[]).filter(row=>row&&row.albumId);
  const uniqueCount=kind==='live'?new Set(source.map(row=>row.id)).size:new Set(owned.map(row=>row.albumId)).size;
  const totalQuantity=kind==='live'?source.length:owned.reduce((sum,row)=>sum+getCollectionQuantity(row),0);
  return { cards: source, uniqueCount, totalQuantity, amountLabel: totals.map(row => symbol(row.currency) + money(row.value)).join('   ') || (showAmount ? '￥0' : '') };
}
module.exports = { buildDeck, expenses };

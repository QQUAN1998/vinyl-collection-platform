// Split each show's cost in integer minor units, without mixing currencies.
module.exports = function artistExpenses(records, year) {
  const currencies = new Map();
  for (const record of records) {
    if (record.status !== "已看过" || (year && !record.date.startsWith(year))) continue;
    const artists = [...new Set((record.artist || "").split("/").map(name => name.trim()).filter(Boolean))]
      .sort();
    if (!artists.length) continue;
    const totals = new Map();
    for (const expense of record.expenses || []) {
      if (!Number.isSafeInteger(expense.minor) || expense.minor < 0) continue;
      totals.set(expense.currency, (totals.get(expense.currency) || 0) + expense.minor);
    }
    for (const [currency, total] of totals) {
      if (!currencies.has(currency)) currencies.set(currency, new Map());
      const rows = currencies.get(currency), part = Math.floor(total / artists.length), remainder = total % artists.length;
      artists.forEach((name, index) => {
        const row = rows.get(name) || { name, minor: 0, count: 0 };
        row.minor += part + (index < remainder ? 1 : 0);
        row.count++;
        rows.set(name, row);
      });
    }
  }
  return Object.fromEntries([...currencies].map(([currency, rows]) => [currency,
    [...rows.values()].sort((a, b) => b.minor - a.minor || a.name.localeCompare(b.name)),
  ]));
};

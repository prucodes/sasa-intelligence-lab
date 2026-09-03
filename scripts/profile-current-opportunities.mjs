import fs from 'node:fs';
import path from 'node:path';

const snapshotDirectory = path.resolve('data/full-snapshots');
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function numberValue(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/[",%]/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function monthNumber(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  if (/^\d{6}$/.test(normalized)) return Number(normalized.slice(4));
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const index = monthNames.findIndex((month) => month.toLowerCase() === normalized.toLowerCase());
  return index >= 0 ? index + 1 : null;
}

function periodParts(record) {
  const monthId = String(record.month_id ?? '').trim();
  const encodedYear = /^\d{6}$/.test(monthId) ? Number(monthId.slice(0, 4)) : null;
  const yearValue = numberValue(record.year) ?? encodedYear;
  const monthValue = monthNumber(monthId) ?? monthNumber(record.month_number ?? record.mnth_no ?? record.month ?? record.month_name ?? record.kpi_month);
  return { year: yearValue, month: monthValue };
}

function periodKey(record) {
  const { year, month } = periodParts(record);
  if (year && month) return year * 100 + month;
  if (year) return year * 100;
  return month ?? 0;
}

function periodLabel(record) {
  const { year, month } = periodParts(record);
  if (year && month) return `${monthNames[month - 1]} ${year}`;
  if (year) return String(year);
  if (month) return monthNames[month - 1];
  return 'Period unavailable';
}

function normalizedName(value) {
  return String(value ?? '').normalize('NFKD').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function entityKey(record) {
  const district = record.district_id || normalizedName(record.district_name ?? record.dstrt_nm);
  const ulb = record.ulb_id || normalizedName(record.ulb_name ?? record.ulb_nm);
  return ulb ? `${district}|${ulb}` : district;
}

function exactSignature(record) {
  return JSON.stringify(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function targetAchievementProfile(records) {
  if (!records.some((record) => 'target' in record && 'achievement' in record)) return null;
  let target = 0;
  let achievement = 0;
  let computableRows = 0;
  let zeroTargets = 0;
  let achievementAboveTarget = 0;
  let percentageMismatches = 0;
  let blankMeasures = 0;
  for (const record of records) {
    const targetValue = numberValue(record.target);
    const achievementValue = numberValue(record.achievement);
    const reportedPercentage = numberValue(record.achievement_percentage ?? record.percentage);
    if (targetValue === null || achievementValue === null) {
      blankMeasures += 1;
      continue;
    }
    target += targetValue;
    achievement += achievementValue;
    if (targetValue === 0) {
      zeroTargets += 1;
      continue;
    }
    computableRows += 1;
    if (achievementValue > targetValue) achievementAboveTarget += 1;
    const calculatedPercentage = achievementValue / targetValue * 100;
    if (reportedPercentage !== null && Math.abs(calculatedPercentage - reportedPercentage) > 1) percentageMismatches += 1;
  }
  return {
    target,
    achievement,
    aggregateRatio: target === 0 ? null : achievement / target,
    computableRows,
    zeroTargets,
    achievementAboveTarget,
    percentageMismatches,
    blankMeasures,
  };
}

function specialMeasures(tableKey, records) {
  const sumField = (field) => records.reduce((total, record) => total + (numberValue(record[field]) ?? 0), 0);
  if (tableKey.includes('legacy_waste')) {
    const inconsistentBalanceRows = records.filter((record) => {
      const target = numberValue(record.target);
      const achievement = numberValue(record.achievement);
      const balance = numberValue(record.balance);
      return target !== null && achievement !== null && balance !== null && Math.abs(target - achievement - balance) > 1;
    }).length;
    return { target: sumField('target'), achievement: sumField('achievement'), balance: sumField('balance'), inconsistentBalanceRows };
  }
  if (tableKey.includes('identification_of_new_ihhls')) return {
    identified: sumField('no_of_benf_identified'), approved: sumField('ihhls_approved_by_mohua'),
    underConstruction: sumField('under_construction'), completed: sumField('completed'),
  };
  if (tableKey.includes('iswm_facilities')) return {
    totalTpd: sumField('total_tpd'), wetTpd: sumField('wet_tpd'), dryTpd: sumField('dry_tpd'),
    statusCounts: Object.fromEntries([...records.reduce((map, record) => map.set(record.status_tx || 'Not reported', (map.get(record.status_tx || 'Not reported') ?? 0) + 1), new Map()).entries()]),
  };
  if (tableKey.includes('establishing_fstps')) return { configuredKld: sumField('capacity_in_kld') };
  if (tableKey.includes('compactors')) return { reportedUnits: sumField('no_of_units') };
  if (tableKey.includes('sweeping_machines')) return { reportedUnits: sumField('no_of_machines_supplied') };
  return null;
}

function serpProfile(tableKey, records) {
  if (!tableKey.startsWith('serp_')) return null;
  const targetField = Object.keys(records[0] ?? {}).find((field) => field.endsWith('_target_units'));
  const previousField = Object.keys(records[0] ?? {}).find((field) => field.includes('previous_month_achievement'));
  const cumulativeField = Object.keys(records[0] ?? {}).find((field) => field.includes('cummulative_achievement'));
  const sum = (field) => records.reduce((total, record) => total + (numberValue(record[field]) ?? 0), 0);
  return { target: sum(targetField), previousMonthAchievement: sum(previousField), cumulativeAchievement: sum(cumulativeField) };
}

const snapshots = fs.readdirSync(snapshotDirectory).filter((file) => file.endsWith('.json')).sort().map((file) => {
  const envelope = JSON.parse(fs.readFileSync(path.join(snapshotDirectory, file), 'utf8'));
  return { file, ...envelope };
});

const profiles = snapshots.map((snapshot) => {
  const tableKey = snapshot.responseMetadata.tableKey;
  const periods = [...new Map(snapshot.records.map((record) => [periodKey(record), periodLabel(record)])).entries()].sort((left, right) => left[0] - right[0]);
  const latestKey = Math.max(...snapshot.records.map(periodKey));
  const latestRecords = snapshot.records.filter((record) => periodKey(record) === latestKey);
  const uniqueLatestRecords = [...new Map(latestRecords.map((record) => [exactSignature(record), record])).values()];
  const exactDuplicates = latestRecords.length - uniqueLatestRecords.length;
  const entityPeriodSignatures = snapshot.records.reduce((map, record) => {
    const key = `${entityKey(record)}|${periodKey(record)}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(exactSignature(record));
    return map;
  }, new Map());
  const ambiguousEntityPeriods = [...entityPeriodSignatures.values()].filter((signatures) => signatures.size > 1).length;
  return {
    tableKey,
    tableName: snapshot.responseMetadata.tableName,
    grain: snapshot.records.some((record) => record.ulb_name || record.ulb_nm || record.ulb_id) ? 'ULB' : 'District',
    rows: snapshot.records.length,
    entities: new Set(snapshot.records.map(entityKey).filter(Boolean)).size,
    periods: periods.map(([, label]) => label),
    latestPeriod: periods.at(-1)?.[1] ?? 'Period unavailable',
    latestRows: latestRecords.length,
    analyticalRows: uniqueLatestRecords.length,
    exactDuplicates,
    ambiguousEntityPeriods,
    targetAchievement: targetAchievementProfile(uniqueLatestRecords),
    special: specialMeasures(tableKey, uniqueLatestRecords),
    serp: serpProfile(tableKey, uniqueLatestRecords),
  };
});

console.log(JSON.stringify({
  generatedFrom: 'data/full-snapshots',
  datasetCount: profiles.length,
  recordCount: profiles.reduce((total, profile) => total + profile.rows, 0),
  multiPeriodDatasets: profiles.filter((profile) => profile.periods.length > 1).length,
  profiles,
}, null, 2));

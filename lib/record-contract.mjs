/** Shared by ingestion, aggregate builders and the application. */
export const sourceText = (value) => {
  const text = String(value ?? '').trim();
  return !text || /^(null|undefined|n\/?a)$/i.test(text) ? null : text;
};

export function sourceNumber(value) {
  const text = sourceText(value);
  if (text === null) return null;
  const number = Number(text.replace(/,/g, '').replace(/^"|"$/g, ''));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export const canonicalRecord = (record) => JSON.stringify(Object.keys(record).sort().map((key) => [key, record[key]]));

/** Exact repeats collapse; every variant of a conflicting key remains held out. */
export function uniqueSourceRecords(input, keyOf, signatureOf = canonicalRecord) {
  const groups = new Map();
  let missingKeyRows = 0;
  for (const row of input) {
    const key = keyOf(row);
    if (!key) { missingKeyRows++; continue; }
    if (!groups.has(key)) groups.set(key, { rows: 0, variants: new Map() });
    const group = groups.get(key);
    group.rows++;
    group.variants.set(signatureOf(row), row);
  }
  const records = [];
  const conflicts = [];
  let duplicateRows = 0;
  let conflictingRows = 0;
  for (const [key, group] of groups) {
    if (group.variants.size > 1) {
      conflicts.push(key);
      conflictingRows += group.rows;
    } else {
      records.push(group.variants.values().next().value);
      duplicateRows += group.rows - 1;
    }
  }
  return {
    records,
    quality: { rawRows: input.length, uniqueRows: records.length, duplicateRows, conflictingKeys: conflicts.length, conflictingRows, missingKeyRows },
    conflicts,
  };
}

/** A source's declared period; no reporting month is invented for an undated row. */
export function sourcePeriod(row) {
  const date = sourceText(row.date1 ?? row.COLLECTION_DATE);
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 7);
  const raw = sourceText(row.month_number ?? row.month_no ?? row.month_id ?? row.mnth_no ?? row.MONTH_ID ?? row.month);
  if (raw && /^\d{6}$/.test(raw)) {
    const month = Number(raw.slice(4));
    return month >= 1 && month <= 12 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
  }
  const year = sourceText(row.year ?? row.YEAR);
  if (year && /^\d{4}$/.test(year) && raw === null && !sourceText(row.month_name ?? row.mnth_nm)) return year;
  const names = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  let month = raw === null ? NaN : Number(raw);
  if (!Number.isInteger(month)) month = names.indexOf(String(row.month_name ?? row.mnth_nm ?? raw ?? '').trim().toLowerCase()) + 1;
  if (!year || !/^\d{4}$/.test(year) || month < 1 || month > 12 || !Number.isInteger(month)) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function sourceEntity(row) {
  const pick = (...fields) => fields.map((field) => sourceText(row[field])).find(Boolean);
  const gp = pick('GRAM_PANCHAYAT_ID');
  if (gp) return `gp:${gp}`;
  const secretariat = pick('sachivalayam_code', 'secretariat_code');
  if (secretariat) return `secretariat:${secretariat}`;
  const district = pick('lgd_district_code', 'lgd_dist_code', 'api_lgd_dist_code', 'district_code', 'DISTRICT_ID', 'district_id', 'dstrt_id', 'district_name', 'dstrt_nm');
  const ulb = pick('lgd_mandal_code', 'api_lgd_mandal_code', 'ulb_code', 'ulb_id', 'ulb_nm', 'ulb_name');
  return district || ulb ? `${district ?? '?'}|${ulb ?? ''}` : null;
}

/**
 * One-command live status sweep of every documented Data Lake key.
 *
 *   AILAB_ACCESS_TOKEN=<300s token from /playground/token> node scripts/check-live.mjs
 *
 * The integration guide runs ahead of the deployment, so keys appear in the docs
 * before they resolve. This queries each one and reports live / 404 / 5xx with its
 * totalRecordCount, so the morning after a data drop you can see at a glance what
 * came online — then sample.mjs a new key for fill rate and ingest.mjs to pull it.
 *
 * Serial and gentle (concurrency 1): firing these in parallel returns spurious 504s.
 * The token is read from the environment for the run only and never written to disk.
 */

const API_BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';

// Grouped as of the 2026-09-06 cross-check: what is readable, what is only documented.
const KEYS = {
  'CDMA live (secretariat · day)': [
    'msw_door_to_door_collection_api',
    'identification_of_bulk_waste_generators_api',
    'onsite_processing_of_wet_waste_bwg_api',
  ],
  'CDMA documented — watch for these going live': [
    'waste_egregation_api', 'waste_segregation_api', 'construction_of_csc_api',
    'compost_pits_api', 'magic_drains_api', 'soak_pits_api',
    'housing_construction_of_ihhls_new1_api', 'sbm_construction_of_ihhls_new1_api',
    'msw_cbg_units_new1_api', 'ihhl_new_identification_new1_api', 'itc_wow_schools_api',
  ],
  'PR documented — watch for these going live': [
    'sasa_pr_door_to_door_collection_percentage_of_garbage_api',
    'sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api',
    'sasa_pr_no_of_swpcs_operationalised_api',
  ],
  'Known broken': ['sasa_establishment_of_gobardhan_units_api'],
};

async function status(token, key) {
  try {
    const r = await fetch(`${API_BASE}/datasets/${key}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId: 'DEPT-AILABS', purpose: 'BENEFIT_DISBURSEMENT', filters: {}, responseFormat: 'JSON' }),
    });
    if (r.ok) return { live: true, total: (await r.json()).responseMetadata?.totalRecordCount ?? '?' };
    return { live: false, note: `HTTP ${r.status}` };
  } catch (e) {
    return { live: false, note: `ERR ${String(e).slice(0, 40)}` };
  }
}

async function main() {
  const token = process.env.AILAB_ACCESS_TOKEN;
  if (!token) {
    console.error('AILAB_ACCESS_TOKEN not set. From the signed-in portal, open /playground/token,');
    console.error('copy accessToken, and run:  AILAB_ACCESS_TOKEN=<paste> node scripts/check-live.mjs');
    process.exit(1);
  }
  const newlyLive = [];
  for (const [group, keys] of Object.entries(KEYS)) {
    console.log(`\n${group}`);
    for (const key of keys) {
      const s = await status(token, key);
      const mark = s.live ? `LIVE · ${Number(s.total).toLocaleString('en-IN')} rows` : s.note;
      console.log(`  ${s.live ? '✓' : '·'} ${key.padEnd(56)} ${mark}`);
      if (s.live && group.includes('documented')) newlyLive.push(key);
      await new Promise((done) => setTimeout(done, 200));
    }
  }
  if (newlyLive.length) {
    console.log(`\n${newlyLive.length} documented key(s) now LIVE — sample then decide:`);
    for (const key of newlyLive) console.log(`  AILAB_ACCESS_TOKEN=$TOK node scripts/sample.mjs ${key}`);
  } else {
    console.log('\nNo documented keys have gone live yet.');
  }
}

await main();

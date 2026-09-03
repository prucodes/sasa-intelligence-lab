export type CatalogueTheme =
  | 'Collection & machinery'
  | 'Waste management'
  | 'Green & water'
  | 'Sanitation outcomes'
  | 'Circular economy'
  | 'Awareness & schools';

export interface CatalogueDataset {
  catalogueName: string;
  tableKey: string;
  programme: 'SASA' | 'SASA PR' | 'SASA CDMA' | 'SERP';
  theme: CatalogueTheme;
  frequency: 'Monthly' | 'Not established';
  fieldCount: number;
  columns: string[];
  dataLakeLink?: string;
  schemaVerification: 'PUBLIC SCHEMA VERIFIED' | 'AUTHENTICATED SCHEMA VERIFIED' | 'DOCUMENTED RESPONSE EXAMPLE';
  retainedExcerpt: boolean;
  completePayload: boolean;
  payloadEvidence: string;
  joinEligibility: string;
  scoringEligibility: 'UNSCORED';
  sourceState: 'AUTHORIZED' | 'DOCUMENTED — INGESTION PENDING';
  sourceGrain?: 'District' | 'Gram Panchayat' | 'Gram Panchayat · Date' | 'Secretariat · Day';
  /**
   * Rows the live API reports for this dataset, recorded when the endpoint was
   * actually queried. Present without `completePayload` means the data is
   * reachable but has not been pulled: the size is known, the content is not.
   */
  liveRowCount?: number;
  /** Date the live check above was made, so a stale count is visible as stale. */
  liveCheckedOn?: string;
}

type CatalogueTuple = [string, string, CatalogueTheme, string[]];

const catalogueTuples: CatalogueTuple[] = [
  ['Sweeping Machines Information', 'sasa_sac_sweeping_machines_information_api', 'Collection & machinery', ['month_number','month_name','fin_year','no_of_machines_supplied','ulb_name','inserted_date','district_name','year']],
  ['100% Clearance of Legacy Waste', 'sasa_100_percent_clearance_of_legacy_waste_api', 'Waste management', ['mnth_nm','overall_quantity_remediated_in_lmt','overall_quantity','dstrt_nm','mnth_no','year','fin_year','load_date','ulb_nm','balance','percentage_of_completion']],
  ['50% Green Spaces', 'sasa_50_percent_green_spaces_api', 'Green & water', ['ulb_nm','fin_year','mnth_no','dstrt_nm','year','load_date','mnth_nm','green_spaces_achieved_percent','green_spaces_achieved','green_spaces_target_in_nos']],
  ['50% Green Cover', 'sasa_50_percent_greencover_api', 'Green & water', ['mnth_no','mnth_nm','green_cover_trgts_in_kms','ulb_nm','year','dstrt_nm','load_date','fin_year','achvd_percent_in_kms','green_cover_achvd_in_kms']],
  ['50% Rejuvenation of Water Bodies', 'sasa_50_percent_rejuvenation_api', 'Green & water', ['mnth_nm','rejuvenation_of_water_bodies_in_nos_targets','dstrt_nm','mnth_no','rejuvenation_of_water_bodies_achived','rejuvenation_of_water_bodies_achived_percent','year','ulb_nm','fin_year','load_date']],
  ['ULB E-Waste Collection Mechanism', 'sasa_cdma_ulbs_ewaste_collection_mechanism_api', 'Waste management', ['month','district_name','year','percentage','ewste_rcylr_in_achieved','inserted_date','total_ulbs','district_id']],
  ['ULB Single-Use Plastic Ban', 'sasa_cdma_ulbs_single_use_plastic_ban_api', 'Waste management', ['district_id','year','total_ulbs','percentage','sup_ban_in_achieved','month','inserted_date','district_name']],
  ['Declaration of ODF+ Model Villages', 'sasa_declaration_of_odf_plus_model_villages_api', 'Sanitation outcomes', ['dstrt_nm','dstrt_id','fin_year','month_name','mnth_no','year','odf_vlges_declaration_achvmt','odf_vlges_declaration_target_units','load_date','odf_vlges_declaration_achvmt_prcntge']],
  ['Establishment of Gobardhan Units', 'sasa_establishment_of_gobardhan_units_api', 'Circular economy', ['dstrt_nm','gobardhan_achvmnt','mnth_no','gobardhan_achvmnt_prcntge','month_name','dstrt_id','year','gobardhan_trgt_uniits','load_date','fin_year']],
  ['Establishment of Plastic Waste Management Units', 'sasa_establishment_of_plastic_waste_management_units_api', 'Waste management', ['load_date','mnth_nm','dstrt_nm','year','pwm_units_achvmnt_prcntge','dstrt_id','fin_year','pwm_units_achvmnt','pwm_units_trgt_units','mnth_no']],
  ['Households Promoted for Terrace and Kitchen Gardens', 'sasa_households_promoted_for_terrace_gardening_kitchen_gardens_api', 'Green & water', ['load_date','terrace_gardening_achieved','district_name','terrace_gardening_targeted_members','ulb_id','month_id','district_id','terrace_gardening_percentage','ulb_name']],
  ['ITC WOW Programme in Schools', 'sasa_itc_wow_program_in_schools_api', 'Awareness & schools', ['load_date','trgt_units','fin_year','dstrt_id','mnth_nm','year','dstrt_nm','achvmnt','prcnt_achvd','mnth_no']],
  ['Entrepreneurs Promoted for Circular Economy', 'sasa_mepma_entrepreneurs_promoted_for_circular_economy_api', 'Circular economy', ['month_id','circular_economy_achieved','inserted_date','circular_economy_targeted_members','ulb_id','district_name','circular_percentage','ulb_name','district_id']],
  ['Households Promoted for Home Composting', 'sasa_mepma_households_promoted_for_home_composite_api', 'Circular economy', ['home_composite_targeted_members','district_name','home_composite_percentage','inserted_date','month_id','district_id','home_composite_achieved','ulb_name','ulb_id']],
  ['C&D Waste Processing', 'sasa_sac_c_d_waste_processing_api', 'Waste management', ['month_name','plnt_cpcty_in_tpd','ulb_name','month_number','district_name','fin_year','year','inserted_date']],
  ['Door-to-Door E-Autos', 'sasa_sac_door_to_door_e_autos_api', 'Collection & machinery', ['fin_year','year','district_name','e_autos_achievement','e_autos_achievement_percentage','month_name','inserted_date','e_autos_target','mnth_no']],
  ['Door-to-Door Push Carts', 'sasa_sac_door_to_door_push_carts_api', 'Collection & machinery', ['push_carts_target','month_name','district_name','push_carts_achievement','mnth_no','push_carts_achievement_percentage','inserted_date','year','fin_year']],
  ['Door-to-Door Tri-Cycles', 'sasa_sac_door_to_door_tri_cycles_api', 'Collection & machinery', ['tri_cycles_achievement_percentage','year','district_name','tri_cycles_target','inserted_date','month_name','tri_cycles_achievement','mnth_no','fin_year']],
  ['FSTP Establishment', 'sasa_sac_establishing_fstps_information_api', 'Waste management', ['district_name','capacity_in_kld','month_name','inserted_date','month_number','year','overall_progress','fin_year','ulb_name']],
  ['Identification of New IHHLs', 'sasa_sac_identification_of_new_ihhls_api', 'Sanitation outcomes', ['percentage_of_achievement','month_name','ulb_name','district_name','inserted_date','year','month_number','completed','ihhls_approved_by_mohua','no_of_benf_identified','fin_year','under_construction']],
  ['Compactor Machinery', 'sasa_sac_machinery_compactors_api', 'Collection & machinery', ['inserted_date','month_number','no_of_units','fin_year','year','district_name','month_name','ulb_name']],
  ['E-Autos Service Model', 'sasa_sac_machinery_e_autos_service_model_api', 'Collection & machinery', ['year','no_of_vehicles_supplied_in_nos','fin_year','mnth_no','ulb_name','month_name','inserted_date','district_name','target','actual_wrk_order_issued','percentage']],
  ['MSW Processing — CBG Units', 'sasa_sac_msw_processing_facilities_cbg_units_api', 'Waste management', ['financial_year','inserted_date','ulb_name','district_name','status_tx','month_number','month_name','total_tpd','year']],
  ['MSW Processing — ISWM Facilities', 'sasa_sac_msw_processing_facilities_iswm_facilities_api', 'Waste management', ['total_tpd','dry_tpd','district_name','status_tx','year','inserted_date','month_number','month_name','ulb_name','financial_year','wet_tpd']],
  ['Swachh Survekshan — GFC Status', 'sasa_sac_swacch_survekshan_information_gfc_status_api', 'Sanitation outcomes', ['year','gfc_status','ulb_name','inserted_date','district_name']],
  ['Swachh Survekshan — National Rank', 'sasa_sac_swacch_survekshan_information_national_rank_api', 'Sanitation outcomes', ['national_rank','inserted_date','district_name','year','ulb_name']],
  ['Swachh Survekshan — ODF Status', 'sasa_sac_swacch_survekshan_information_odf_status_api', 'Sanitation outcomes', ['district_name','ulb_name','odf_status','inserted_date','year']],
];

const retainedExcerptKeys = new Set([
  'sasa_sac_machinery_e_autos_service_model_api',
  'sasa_sac_msw_processing_facilities_iswm_facilities_api',
  'sasa_sac_identification_of_new_ihhls_api',
  'sasa_sac_swacch_survekshan_information_gfc_status_api',
  'sasa_sac_swacch_survekshan_information_odf_status_api',
  'sasa_sac_swacch_survekshan_information_national_rank_api',
]);

const outcomeExcerptKeys = new Set([
  'sasa_sac_swacch_survekshan_information_gfc_status_api',
  'sasa_sac_swacch_survekshan_information_odf_status_api',
  'sasa_sac_swacch_survekshan_information_national_rank_api',
]);

export const sasaCatalogue: CatalogueDataset[] = catalogueTuples.map(([catalogueName, tableKey, theme, columns]) => {
  const retainedExcerpt = retainedExcerptKeys.has(tableKey);
  return {
    catalogueName,
    tableKey,
    programme: 'SASA',
    theme,
    frequency: 'Monthly',
    fieldCount: columns.length,
    columns,
    dataLakeLink: `https://datalakes.ailivinglabs.ap.gov.in/datasets/${tableKey}`,
    schemaVerification: 'PUBLIC SCHEMA VERIFIED',
    retainedExcerpt,
    completePayload: false,
    payloadEvidence: retainedExcerpt ? 'EXCERPT VERIFIED' : 'AUTHENTICATION REQUIRED',
    joinEligibility: outcomeExcerptKeys.has(tableKey)
      ? 'PERIOD ALIGNMENT REQUIRED'
      : retainedExcerpt
        ? 'CROSSWALK REQUIRED'
        : 'NOT EVALUATED',
    scoringEligibility: 'UNSCORED',
    sourceState: 'AUTHORIZED',
  };
});

const serpCatalogueTuples: CatalogueTuple[] = [
  ['SERP Kitchen Garden', 'serp_kitchen_garden_api', 'Green & water', ['district_id','district_name','kpi_month','month','shg_kitchen_garden_cummulative_achievement_till_current_month','shg_kitchen_garden_previous_month_achievement','shg_kitchen_garden_target_units','year']],
  ['SERP Swachhata Awareness', 'serp_swachhata_awareness_api', 'Awareness & schools', ['district_id','district_name','kpi_month','month','shg_swachhata_awareness_cummulative_achievement_till_current_month','shg_swachhata_awareness_previous_month_achievement','shg_swachhata_awareness_target_units','year']],
  ['SERP Circular Economy', 'serp_circular_economy_api', 'Circular economy', ['circular_economy_entrepreneurs_cummulative_achievement_till_current_month','circular_economy_entrepreneurs_previous_month_achievement','circular_economy_entrepreneurs_target_units','district_id','district_name','kpi_month','month','year']],
];

export const serpCatalogue: CatalogueDataset[] = serpCatalogueTuples.map(([catalogueName, tableKey, theme, columns]) => ({
  catalogueName,
  tableKey,
  programme: 'SERP',
  theme,
  frequency: 'Monthly',
  fieldCount: columns.length,
  columns,
  dataLakeLink: `https://datalakes.ailivinglabs.ap.gov.in/datasets/${tableKey}`,
  schemaVerification: 'AUTHENTICATED SCHEMA VERIFIED',
  retainedExcerpt: false,
  completePayload: false,
  payloadEvidence: 'AUTHENTICATION REQUIRED',
  joinEligibility: 'DISTRICT GRAIN',
  scoringEligibility: 'UNSCORED',
  sourceState: 'AUTHORIZED',
}));

export const authorizedCatalogue = [...serpCatalogue, ...sasaCatalogue];

export const documentedIntegrationCatalogue: CatalogueDataset[] = [
  {
    catalogueName: 'PR Gram Panchayat SWPC Availability and Working Condition',
    tableKey: 'sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026',
    programme: 'SASA PR',
    theme: 'Waste management',
    frequency: 'Not established',
    fieldCount: 8,
    columns: ['DISTRICT_ID', 'DISTRICT_NAME', 'BLOCK_ID', 'BLOCK_NAME', 'GRAM_PANCHAYAT_ID', 'GRAM_PANCHAYAT_NAME', 'GP_HAVING_SWPC', 'WORKING_CONDITION'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · INGESTION PENDING',
    joinEligibility: 'GRAM PANCHAYAT GRAIN · NO ULB JOIN',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'Gram Panchayat',
  },
  {
    catalogueName: 'PR Swachh Ratham Mandal Operator Reconciliation',
    tableKey: 'sasa_pr_no_of_swpcs_operationalised_api_27_aug_2026',
    programme: 'SASA PR',
    theme: 'Collection & machinery',
    frequency: 'Not established',
    fieldCount: 4,
    columns: ['DISTRICT_ID', 'DISTRICT_NAME', 'SWACHCH_RATHAM_MANDAL_OPERATORS', 'SWACHCH_RATHAM_REPORTED_MANDAL_OPERATORS'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · INGESTION PENDING',
    joinEligibility: 'DISTRICT GRAIN · SEMANTIC REVIEW REQUIRED',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
  {
    catalogueName: 'PR Door-to-Door Garbage Collection',
    tableKey: 'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026',
    programme: 'SASA PR',
    theme: 'Collection & machinery',
    frequency: 'Monthly',
    fieldCount: 12,
    columns: ['DISTRICT_ID', 'DISTRICT_NAME', 'BLOCK_ID', 'BLOCK_NAME', 'GRAM_PANCHAYAT_ID', 'GRAM_PANCHAYAT_NAME', 'COLLECTION_DATE', 'MONTH_ID', 'MONTH_NAME', 'YEAR', 'SEGREGATED_WASTE_HOUSEHOLDS', 'IS_COLLECTED'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · INGESTION PENDING',
    joinEligibility: 'GRAM PANCHAYAT · DATE GRAIN · NO ULB JOIN',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'Gram Panchayat · Date',
  },
];


/**
 * SASA_CDMA, documented in section 15 of the integration guide. The guide has since
 * grown to 13 datasets, and a live cross-check on 2026-09-03 shows the guide runs
 * ahead of the deployment: only three keys actually resolve on the Data Lake
 * (door-to-door collection, bulk-waste generators, on-site wet-waste — ~64,000 rows
 * each, secretariat · day grain). The other ten return `dataset_not_found` (404),
 * so they are catalogued as documented-pending and contribute nothing to analytics.
 *
 * The three that resolve are still not analysable. A stratified sample of each
 * (2026-09-03) found the measure columns almost empty or single-day: door-to-door
 * `collected_households` was non-zero on essentially one day (Aug 12) against a fully
 * populated household denominator; `no_of_bwgs` filled ~24% of secretariats with a
 * tiny sum; `wet_waste_processing_bwgs` under 10%. So the rows exist but do not yet
 * support a coverage or performance measure — the honest state is UNSCORED.
 *
 * `waste_segregation_api` is listed as `waste_egregation_api` in the section index and
 * as `waste_segregation_api` elsewhere; both spellings return 404, so neither is the
 * deployed key yet.
 *
 * `ihhl_new_identification_new1_api` re-publishes the same measures as the live
 * `sasa_sac_identification_of_new_ihhls_api`; if it is provisioned it duplicates data
 * the app already holds rather than adding any.
 */
export const cdmaIntegrationCatalogue: CatalogueDataset[] = [
  {
    catalogueName: 'CDMA 100% Door-to-Door Collection of MSW',
    tableKey: 'msw_door_to_door_collection_api',
    programme: 'SASA CDMA',
    theme: 'Collection & machinery',
    frequency: 'Monthly',
    fieldCount: 16,
    columns: ['date1', 'district_name', 'district_code', 'ulb_name', 'ulb_code', 'sachivalayam_name', 'sachivalayam_code', 'active_indicator', 'total_households', 'collected_households', 'garbage_segregation', 'i_ts', 'api_lgd_dist_code', 'api_district_name', 'api_lgd_mandal_code', 'api_mandal_name'],
    schemaVerification: 'AUTHENTICATED SCHEMA VERIFIED',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'LIVE · 64,368 ROWS · NUMERATOR SINGLE-DAY (AUG 12); DENOMINATOR COMPLETE',
    joinEligibility: 'SECRETARIAT · DAY GRAIN · ULB CODE IS A MANDAL CODE',
    scoringEligibility: 'UNSCORED',
    sourceState: 'AUTHORIZED',
    sourceGrain: 'Secretariat · Day',
    liveRowCount: 64368,
    liveCheckedOn: '2026-09-03',
  },
  {
    catalogueName: 'CDMA Identification of Bulk Waste Generators',
    tableKey: 'identification_of_bulk_waste_generators_api',
    programme: 'SASA CDMA',
    theme: 'Waste management',
    frequency: 'Monthly',
    fieldCount: 13,
    columns: ['date1', 'district_name', 'district_code', 'ulb_name', 'ulb_code', 'secretariat_name', 'secretariat_code', 'no_of_bwgs', 'i_ts', 'api_lgd_dist_code', 'api_district_name', 'api_lgd_mandal_code', 'api_mandal_name'],
    schemaVerification: 'AUTHENTICATED SCHEMA VERIFIED',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'LIVE · 64,528 ROWS · no_of_bwgs FILLED ~24% OF SECRETARIATS, SMALL COUNTS',
    joinEligibility: 'SECRETARIAT · DAY GRAIN · ULB CODE IS A MANDAL CODE',
    scoringEligibility: 'UNSCORED',
    sourceState: 'AUTHORIZED',
    sourceGrain: 'Secretariat · Day',
    liveRowCount: 64528,
    liveCheckedOn: '2026-09-03',
  },
  {
    catalogueName: 'CDMA On-Site Wet Waste Processing by BWGs',
    tableKey: 'onsite_processing_of_wet_waste_bwg_api',
    programme: 'SASA CDMA',
    theme: 'Waste management',
    frequency: 'Monthly',
    fieldCount: 13,
    columns: ['date1', 'district_name', 'district_code', 'ulb_name', 'ulb_code', 'secretariat_name', 'secretariat_code', 'wet_waste_processing_bwgs', 'i_ts', 'api_lgd_dist_code', 'api_district_name', 'api_lgd_mandal_code', 'api_mandal_name'],
    schemaVerification: 'AUTHENTICATED SCHEMA VERIFIED',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'LIVE · 64,528 ROWS · wet_waste_processing_bwgs FILLED <10% OF SECRETARIATS',
    joinEligibility: 'SECRETARIAT · DAY GRAIN · ULB CODE IS A MANDAL CODE',
    scoringEligibility: 'UNSCORED',
    sourceState: 'AUTHORIZED',
    sourceGrain: 'Secretariat · Day',
    liveRowCount: 64528,
    liveCheckedOn: '2026-09-03',
  },
  {
    catalogueName: 'CDMA Waste Segregation',
    tableKey: 'waste_segregation_api',
    programme: 'SASA CDMA',
    theme: 'Waste management',
    frequency: 'Monthly',
    fieldCount: 15,
    columns: ['date1', 'district_name', 'district_code', 'ulb_name', 'ulb_code', 'sachivalayam_name', 'sachivalayam_code', 'active_indicator', 'total_households', 'garbage_segregation', 'i_ts', 'api_lgd_dist_code', 'api_district_name', 'api_lgd_mandal_code', 'api_mandal_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · BOTH SPELLINGS 404 ON LIVE 2026-09-03',
    joinEligibility: 'SECRETARIAT · DAY GRAIN · KEY SPELLED TWO WAYS IN SOURCE DOC',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'Secretariat · Day',
  },
  {
    catalogueName: 'CDMA Construction of Community Sanitary Complexes',
    tableKey: 'construction_of_csc_api',
    programme: 'SASA CDMA',
    theme: 'Sanitation outcomes',
    frequency: 'Monthly',
    fieldCount: 15,
    columns: ['s_no', 'district_name', 'district_id', 'csc_target_units', 'csc_achievement', 'csc_achievement_percentage', 'month_no', 'month_name', 'year', 'fin_year', 'a_in', 'i_ts', 'u_ts', 'api_lgd_dist_code', 'api_district_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · NOT PROVISIONED',
    joinEligibility: 'DISTRICT GRAIN · TWO PARALLEL DISTRICT ID SYSTEMS',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
  {
    catalogueName: 'CDMA Compost Pits',
    tableKey: 'compost_pits_api',
    programme: 'SASA CDMA',
    theme: 'Waste management',
    frequency: 'Not established',
    fieldCount: 9,
    columns: ['district_id', 'district_name', 'work_name', 'units', 'fin_year', 'month', 'target', 'achivement', 'lgd_district_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · NOT PROVISIONED',
    joinEligibility: 'DISTRICT GRAIN · PERIOD ENCODING UNCONFIRMED',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
  {
    catalogueName: 'CDMA Magic Drains',
    tableKey: 'magic_drains_api',
    programme: 'SASA CDMA',
    theme: 'Green & water',
    frequency: 'Not established',
    fieldCount: 9,
    columns: ['district_id', 'district_name', 'work_name', 'units', 'fin_year', 'month', 'target', 'achivement', 'lgd_district_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · NOT PROVISIONED',
    joinEligibility: 'DISTRICT GRAIN · PERIOD ENCODING UNCONFIRMED',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
  {
    catalogueName: 'CDMA Soak Pits',
    tableKey: 'soak_pits_api',
    programme: 'SASA CDMA',
    theme: 'Waste management',
    frequency: 'Not established',
    fieldCount: 9,
    columns: ['district_id', 'district_name', 'work_name', 'units', 'fin_year', 'month', 'target', 'achivement', 'lgd_district_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · SAMPLE DUPLICATES COMPOST PITS',
    joinEligibility: 'DISTRICT GRAIN · SOURCE SAMPLE NOT SPECIFIC TO THIS DATASET',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
  {
    catalogueName: 'CDMA Housing Construction of IHHLs',
    tableKey: 'housing_construction_of_ihhls_new1_api',
    programme: 'SASA CDMA',
    theme: 'Sanitation outcomes',
    frequency: 'Monthly',
    fieldCount: 13,
    columns: ['s_no', 'district_name', 'construction_of_ihhls_target_units', 'construction_of_ihhls_achievement', 'construction_of_ihhls_achievement_percentage', 'month_no', 'month_name', 'year', 'fin_year', 'a_in', 'i_ts', 'u_ts', 'lgd_district_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · NOT PROVISIONED',
    joinEligibility: 'DISTRICT GRAIN',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
  {
    catalogueName: 'CDMA SBM Construction of IHHLs',
    tableKey: 'sbm_construction_of_ihhls_new1_api',
    programme: 'SASA CDMA',
    theme: 'Sanitation outcomes',
    frequency: 'Monthly',
    fieldCount: 14,
    columns: ['s_no', 'district_id', 'district_name', 'ihhls_target_units', 'ihhls_achievement', 'ihhls_achievement_percentage', 'month_no', 'month_name', 'year', 'fin_year', 'a_in', 'i_ts', 'u_ts', 'lgd_district_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · NOT PROVISIONED',
    joinEligibility: 'DISTRICT GRAIN · TWO PARALLEL DISTRICT ID SYSTEMS',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
  {
    catalogueName: 'CDMA MSW CBG Units',
    tableKey: 'msw_cbg_units_new1_api',
    programme: 'SASA CDMA',
    theme: 'Waste management',
    frequency: 'Monthly',
    fieldCount: 12,
    columns: ['dstrt_nm', 'ulb_nm', 'total_tpd', 'status_tx', 'mnth_no', 'mnth_nm', 'year', 'fin_year', 'lgd_dist_code', 'district_name', 'lgd_mandal_code', 'mandal_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · DUPLICATES LIVE sasa_sac_msw_processing_facilities_cbg_units_api',
    joinEligibility: 'ULB GRAIN · ULB CODE IS A MANDAL CODE',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'Secretariat · Day',
  },
  {
    catalogueName: 'CDMA IHHL New Identification',
    tableKey: 'ihhl_new_identification_new1_api',
    programme: 'SASA CDMA',
    theme: 'Sanitation outcomes',
    frequency: 'Monthly',
    fieldCount: 15,
    columns: ['dstrt_nm', 'ulb_nm', 'ihhls_approved_by_mohua', 'no_of_benf_identified', 'percentage_of_achievement', 'under_construction', 'completed', 'mnth_no', 'mnth_nm', 'year', 'fin_year', 'lgd_dist_code', 'district_name', 'lgd_mandal_code', 'mandal_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · SAME MEASURES AS LIVE sasa_sac_identification_of_new_ihhls_api (DUPLICATE)',
    joinEligibility: 'ULB GRAIN · ULB CODE IS A MANDAL CODE',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'Secretariat · Day',
  },
  {
    catalogueName: 'CDMA ITC WOW Schools',
    tableKey: 'itc_wow_schools_api',
    programme: 'SASA CDMA',
    theme: 'Awareness & schools',
    frequency: 'Monthly',
    fieldCount: 7,
    columns: ['dstrt_id', 'dstrt_nm', 'trgt_units', 'achvmnt', 'prcnt_achvd', 'lgd_district_code', 'lgd_district_name'],
    schemaVerification: 'DOCUMENTED RESPONSE EXAMPLE',
    retainedExcerpt: false,
    completePayload: false,
    payloadEvidence: 'DOCUMENTED · 404 ON LIVE 2026-09-03 · OVERLAPS LIVE sasa_itc_wow_program_in_schools_api',
    joinEligibility: 'DISTRICT GRAIN',
    scoringEligibility: 'UNSCORED',
    sourceState: 'DOCUMENTED — INGESTION PENDING',
    sourceGrain: 'District',
  },
];

export const readinessCatalogue = [...authorizedCatalogue, ...documentedIntegrationCatalogue, ...cdmaIntegrationCatalogue];

export const sasaCatalogueStats = {
  publishedDatasets: sasaCatalogue.length,
  documentedFields: sasaCatalogue.reduce((total, dataset) => total + dataset.fieldCount, 0),
  themes: new Set(sasaCatalogue.map((dataset) => dataset.theme)).size,
  retainedExcerpts: sasaCatalogue.filter((dataset) => dataset.retainedExcerpt).length,
  completePayloads: sasaCatalogue.filter((dataset) => dataset.completePayload).length,
  eligibleScores: sasaCatalogue.filter((dataset) => dataset.scoringEligibility !== 'UNSCORED').length,
};

export const authorizedCatalogueStats = {
  authorizedDatasets: authorizedCatalogue.length,
  sasaDatasets: sasaCatalogue.length,
  serpDatasets: serpCatalogue.length,
  documentedFields: authorizedCatalogue.reduce((total, dataset) => total + dataset.fieldCount, 0),
};

const notYetIngested = [...documentedIntegrationCatalogue, ...cdmaIntegrationCatalogue]
  .filter((dataset) => !dataset.completePayload);
/** Reachable on the live API but not pulled: the size is known, the content is not. */
const liveNotIngested = notYetIngested.filter((dataset) => typeof dataset.liveRowCount === 'number');

export const readinessCatalogueStats = {
  documentedDatasets: readinessCatalogue.length,
  /** Derived from completePayload rather than a length sum, so it means what it says. */
  documentedPending: notYetIngested.length,
  documentedPendingFields: documentedIntegrationCatalogue.reduce((total, dataset) => total + dataset.fieldCount, 0),
  /** Datasets confirmed readable on the live API that still have no retained snapshot. */
  liveNotIngestedDatasets: liveNotIngested.length,
  /** Rows sitting behind those endpoints, waiting on a complete paginated pull. */
  liveNotIngestedRows: liveNotIngested.reduce((total, dataset) => total + (dataset.liveRowCount ?? 0), 0),
};

export const catalogueSource = {
  label: 'AI Living Labs Government Data Catalogue',
  url: 'https://ailivinglabs.ap.gov.in/government-data',
  verifiedOn: '2026-08-27',
};

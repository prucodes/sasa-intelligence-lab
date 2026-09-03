export type GlossaryCategory = 'Product terms' | 'Sanitation & infrastructure' | 'Institutions & programmes' | 'Data & technology';

export type GlossaryEntry = {
  term: string;
  definition: string;
  category: GlossaryCategory;
  aliases?: string[];
};

/**
 * Single maintained vocabulary for interface tooltips and the About glossary.
 * Add abbreviations or evidence terms here whenever a new source is activated.
 */
export const glossaryEntries: GlossaryEntry[] = [
  { term: 'UNSCORED', definition: 'No score is shown because one or more evidence gates are not met. It is not a low or poor score.', category: 'Product terms' },
  { term: 'dataset grain', definition: 'The level represented by each source record, such as a district, ULB, facility, or household. A district record is never presented as a ULB record.', category: 'Product terms' },
  { term: 'configured capacity', definition: 'The source-reported designed or rated capacity of an asset. It does not measure actual throughput, uptime, or utilization.', category: 'Product terms' },
  { term: 'candidate identity', definition: 'A possible entity match based on the normalized source name. It remains provisional until reviewed against an authoritative identifier.', category: 'Product terms' },
  { term: 'crosswalk', definition: 'A reviewed mapping that links source-specific entity names or IDs to one authoritative entity identity.', category: 'Product terms' },
  { term: 'retained snapshot', definition: 'A saved authenticated source response kept with its raw records, filters, period, retrieval time, and pagination evidence.', category: 'Product terms' },
  { term: 'SASA', definition: 'Swachha Andhra Swarna Andhra.', category: 'Institutions & programmes' },
  { term: 'ULB', definition: 'Urban Local Body.', category: 'Sanitation & infrastructure' },
  { term: 'IHHL', definition: 'Individual Household Latrine.', category: 'Sanitation & infrastructure' },
  { term: 'ISWM', definition: 'Integrated Solid Waste Management.', category: 'Sanitation & infrastructure' },
  { term: 'FSTP', definition: 'Faecal Sludge Treatment Plant.', category: 'Sanitation & infrastructure' },
  { term: 'STP', definition: 'Sewage Treatment Plant.', category: 'Sanitation & infrastructure' },
  { term: 'MSW', definition: 'Municipal Solid Waste.', category: 'Sanitation & infrastructure' },
  { term: 'CBG', definition: 'Compressed Bio-Gas.', category: 'Sanitation & infrastructure' },
  { term: 'C&D', definition: 'Construction and Demolition waste.', category: 'Sanitation & infrastructure' },
  { term: 'ODF', definition: 'Open Defecation Free.', category: 'Sanitation & infrastructure' },
  { term: 'GFC', definition: 'Garbage Free City.', category: 'Sanitation & infrastructure' },
  { term: 'TPD', definition: 'Tonnes per day.', category: 'Sanitation & infrastructure' },
  { term: 'KLD', definition: 'Kilolitres per day.', category: 'Sanitation & infrastructure' },
  { term: 'SERP', definition: 'Society for Elimination of Rural Poverty.', category: 'Institutions & programmes' },
  { term: 'MEPMA', definition: 'Mission for Elimination of Poverty in Municipal Areas.', category: 'Institutions & programmes' },
  { term: 'CDMA', definition: 'Commissioner and Director of Municipal Administration.', category: 'Institutions & programmes' },
  { term: 'PR&RD', definition: 'Panchayat Raj and Rural Development.', category: 'Institutions & programmes', aliases: ['PR/RD'] },
  { term: 'MA&UD', definition: 'Municipal Administration and Urban Development.', category: 'Institutions & programmes' },
  { term: 'SWPC', definition: 'Solid Waste Processing Centre.', category: 'Institutions & programmes' },
  { term: 'SHG', definition: 'Self-Help Group.', category: 'Institutions & programmes' },
  { term: 'MoHUA', definition: 'Ministry of Housing and Urban Affairs.', category: 'Institutions & programmes' },
  { term: 'ITC WOW', definition: 'ITC Wellbeing Out of Waste.', category: 'Institutions & programmes' },
  { term: 'KPI', definition: 'Key Performance Indicator.', category: 'Data & technology' },
  { term: 'API', definition: 'Application Programming Interface.', category: 'Data & technology' },
  { term: 'JSON', definition: 'JavaScript Object Notation, a structured data format.', category: 'Data & technology' },
  { term: 'XLSX', definition: 'Microsoft Excel workbook format.', category: 'Data & technology' },
  { term: 'AI', definition: 'Artificial Intelligence.', category: 'Data & technology' },
  { term: 'ID', definition: 'Identifier.', category: 'Data & technology' },
];

export const glossaryCategories: GlossaryCategory[] = [
  'Product terms',
  'Sanitation & infrastructure',
  'Institutions & programmes',
  'Data & technology',
];


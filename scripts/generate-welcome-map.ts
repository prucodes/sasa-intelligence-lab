// Run from the checkout: npx vite-node --config vitest.config.ts scripts/generate-welcome-map.ts
import {readFileSync, writeFileSync} from 'node:fs';
import {getUlbAtlas, districtMapRows, districtPlacements} from '../lib/ulb-atlas';

type Position = [number, number];
type Geometry = {type: 'Polygon'; coordinates: Position[][]} | {type: 'MultiPolygon'; coordinates: Position[][][]};
type Feature = {properties: {d: string}; geometry: Geometry};
type Sample = {district: string; x: number; y: number; endX: number; endY: number};

// Anchor locations are inside the named districts, in plate coordinates. They identify
// polygons only, not facilities or household locations.
const examples: Sample[] = [
  {district: 'Bapatla', x: 322, y: 303, endX: 405, endY: 333},
  {district: 'Chittoor', x: 218, y: 516, endX: 308, endY: 535},
];
const bands = [
  {label: '<50%', color: '#327b82'},
  {label: '50–<75%', color: '#75ae9a'},
  {label: '≥75%', color: '#d6deaa'},
];
const hatchBase = '#233c40';
const normal = (label: string) => label.toUpperCase().replace(/[^A-Z]/g, '');
const xml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const bandFor = (value: number) => value < 50 ? bands[0] : value < 75 ? bands[1] : bands[2];
const percent = (value: number) => `${value.toFixed(1)}%`;

const model = getUlbAtlas();
const placements = districtPlacements(model);
const geo = JSON.parse(readFileSync('public/ap-districts.geojson', 'utf8')) as {features: Feature[]};
const xScale = 78 * Math.cos(16 * Math.PI / 180);
const project = ([lon, lat]: Position): Position => [50 + (lon - 76.7606) * xScale, 51 + (19.166 - lat) * 78];

function pathFor(geometry: Geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map(poly => poly.map(ring =>
    'M' + ring.map(point => project(point).map(value => value.toFixed(1)).join(',')).join(' ') + 'Z'
  ).join('')).join('');
}

function insideRing(point: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = project(ring[i]), [previousX, previousY] = project(ring[j]);
    if ((y > point[1]) !== (previousY > point[1]) &&
        point[0] < (previousX - x) * (point[1] - y) / (previousY - y) + x) inside = !inside;
  }
  return inside;
}

function contains(feature: Feature, sample: Sample) {
  const geometry = feature.geometry;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(poly => insideRing([sample.x, sample.y], poly[0]) && !poly.slice(1).some(hole => insideRing([sample.x, sample.y], hole)));
}

function renderMeasure(id: 'reach' | 'segregation') {
  const measure = model.measures.find(m => m.id === id)!;
  const mapRows = districtMapRows(model, id)!.rows;
  const name = id === 'reach' ? 'Household waste collection reach' : 'Segregation among collected households';
  const definition = id === 'reach'
    ? "the median reporting urban local body's share of households collected from"
    : "the median reporting urban local body's share of collected households segregating waste";
  const districts = geo.features.map((feature, index) => {
    const boundary = feature.properties.d;
    const matches = mapRows.filter(row => normal(placements.get(row.district) ?? row.district) === normal(boundary));
    const unique = geo.features.filter(other => normal(other.properties.d) === normal(boundary)).length === 1;
    const row = matches.length === 1 && unique ? matches[0] : undefined;
    const value = row?.value ?? null;
    const reporting = row ? model.ulbs.filter(ulb => ulb.district === row.district && ulb.cells[id]?.state === 'value').length : 0;
    const label = row?.district ?? boundary;
    return {id: `district-${index}`, feature, label, value, reporting, detail: row?.detail, d: pathFor(feature.geometry)};
  });

  const samples = examples.map(sample => {
    const district = districts.find(row => row.label === sample.district);
    if (!district || district.value === null || !contains(district.feature, sample)) {
      throw new Error(`The anchored callout for ${sample.district} requires review.`);
    }
    return {...sample, display: percent(district.value), reporting: district.reporting};
  });
  const key = {
    period: measure.period,
    bands: bands.map(band => ({...band, count: districts.filter(row => row.value !== null && bandFor(row.value) === band).length})),
    hatchBase,
    mapped: districts.filter(row => row.value !== null).length,
    total: districts.length,
    mapUlbCount: districts.reduce((n, row) => n + row.reporting, 0),
    examples: samples.map(({district, display, reporting}) => ({district, display, reporting})),
  };

  const paths = districts.map(row => `<path id="${row.id}" d="${row.d}"/>`).join('\n');
  const svgReference = (id: string, attrs = '') => `<use xlink:href="#${id}" ${attrs}/>`;
  const silhouettes = districts.map(d => svgReference(d.id)).join('\n');
  const regions = districts.map(row => {
    const fill = row.value === null ? 'url(#no-reading)' : bandFor(row.value).color;
    const description = row.value === null ? 'No mapped reading' : `${percent(row.value)}. ${row.detail}`;
    return `<g><title>${xml(row.label)}: ${xml(description)}</title>${svgReference(row.id, `fill="${fill}"`)}</g>`;
  }).join('\n');
  const callouts = samples.map(({district, x, y, endX, endY, display, reporting}, index) => `
  <g class="callout callout-${index + 1}">
    <title>${district}: ${display}, median of ${reporting} reporting urban local bodies</title>
    <path class="leader" d="M${x} ${y}h12L${endX - 16} ${endY}H${endX}" pathLength="1"/>
    <circle cx="${x}" cy="${y}" r="4.6" fill="#0d282e" stroke="#f5e7bb" stroke-width="1.2"/>
    <circle cx="${x}" cy="${y}" r="1.7" fill="#f4dda0"/>
    <g transform="translate(${endX + 8} ${endY})" class="callout-label">
      <text class="area" y="-3">${district}</text>
      <text class="value" y="24">${display}</text>
    </g>
  </g>`).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="620" viewBox="0 0 700 620" role="img" aria-labelledby="title desc">
<title id="title">Andhra Pradesh · ${name}</title>
<desc id="desc">${measure.period}. Each coloured district shows ${definition}. Lightest: at least 75%. Mid-green: 50% to below 75%. Deep teal: below 50%. Diagonal hatching: no matched reading. ${key.mapped} of ${key.total} reference districts are coloured. District geography: 2022.</desc>
<style>
  .leader{fill:none;stroke:#e4d8a6;stroke-width:1.25;stroke-linecap:round}
  .area,.value{paint-order:stroke;stroke:#102c31;stroke-width:3;stroke-linejoin:round}
  .area{font:16px Arial,sans-serif;fill:#e5ebe4}
  .value{font:italic 27px Georgia,serif;fill:#fff0cf}
  @media(prefers-reduced-motion:no-preference){
    .develop-window{animation:develop .96s cubic-bezier(.16,.64,.18,1) both}
    .leader{stroke-dasharray:1;animation:trace .65s ease-out both}
    .callout-1 .leader{animation-delay:.6s}.callout-2 .leader{animation-delay:.87s}
    .callout-label{animation:inscribe .42s ease-out both}
    .callout-1 .callout-label{animation-delay:.86s}.callout-2 .callout-label{animation-delay:1.12s}
  }
  @keyframes develop{from{transform:translateX(-705px)}to{transform:translateX(0)}}
  @keyframes trace{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
  @keyframes inscribe{from{opacity:0}to{opacity:1}}
</style>
<defs>
  <clipPath id="development"><rect class="develop-window" x="0" y="0" width="710" height="620"/></clipPath>
  ${paths}
  <g id="land">${silhouettes}</g>
  <pattern id="no-reading" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
    <rect width="7" height="7" fill="${hatchBase}"/><path d="M1 0V7" stroke="#919f94" stroke-width="1.4"/>
  </pattern>
</defs>
<g fill="none" stroke="#aad1b7" stroke-width=".65" opacity=".12">
  <path d="M20 110H680M20 215H680M20 320H680M20 425H680M20 530H680M84 45V578M189 45V578M294 45V578M399 45V578M504 45V578M609 45V578"/>
</g>
<g stroke-linejoin="round" fill="#102d31">
  ${svgReference('land', 'stroke="#163338" stroke-width="21"')}
  ${svgReference('land', 'stroke="#294941" stroke-width="10"')}
  ${svgReference('land', 'stroke="#b8ac7f" stroke-width="2.4"')}
</g>
<g clip-path="url(#development)" fill-rule="evenodd" stroke="#284b49" stroke-width=".95" stroke-linejoin="round">
  ${regions}
</g>
<g aria-hidden="true" transform="translate(92 105)" fill="#c3cbb8" font-family="Arial,sans-serif">
  <path d="M0 5V-25M-5-8H5" fill="none" stroke="#9caf9f"/><path d="m0-28 3.2 9-3.2-1.5-3.2 1.5Z" fill="#cdb986"/><text y="-35" text-anchor="middle" font-size="10">N</text>
</g>
${callouts}
<text x="514" y="439" transform="rotate(-17 514 439)" fill="#9db5a8" opacity=".8" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-style="italic" letter-spacing="1.4">Bay of Bengal</text>
</svg>\n`;

  return {svg, key};
}

const collection = renderMeasure('reach');
const segregation = renderMeasure('segregation');
writeFileSync('public/assets/sasa/welcome-atlas.svg', collection.svg);
writeFileSync('public/assets/sasa/welcome-segregation.svg', segregation.svg);
const moduleSource = [
  '// Generated by scripts/generate-welcome-map.ts from the Atlas service-day measures.',
  'export const welcomeMapKey = ' + JSON.stringify(collection.key, null, 2) + ' as const;',
  'export const welcomeSegregationKey = ' + JSON.stringify(segregation.key, null, 2) + ' as const;',
];
writeFileSync('lib/welcome-map-key.ts', moduleSource.join('\n') + '\n');

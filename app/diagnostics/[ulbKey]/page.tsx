import { LabApp } from '../../lab-app';
import { datasets } from '@/lib/domain';

// Enumerate every ULB key across modes so the dynamic route prerenders to static
// HTML — the SAMPLE keys are derived from the registry, so this is the only place
// that knows the full set at build time.
export function generateStaticParams() {
  const keys = new Set<string>();
  for (const mode of ['DEMO', 'SAMPLE', 'LIVE'] as const) {
    for (const entry of datasets[mode].diagnostics) keys.add(entry.ulbKey);
  }
  return [...keys].map((ulbKey) => ({ ulbKey }));
}

export default async function DiagnosticsPage({ params }: { params: Promise<{ ulbKey: string }> }) {
  const { ulbKey } = await params;
  return <LabApp page="diagnostics" initialUlbKey={ulbKey} />;
}

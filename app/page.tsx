import { LabApp } from './lab-app';

// Static export: the page ships with defaults and LabApp reads mode/theme from the
// URL on the client, so ?mode=sample deep links still resolve without a server.
export default function OverviewPage() {
  return <LabApp page="overview" />;
}

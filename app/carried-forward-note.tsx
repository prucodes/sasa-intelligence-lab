import type { CarriedForward } from '@/lib/analytics';
import './carried-forward-note.css';

/**
 * Says when a period is identical to the one before it for nearly every ULB, so a
 * repeated report is never read as steady delivery. Renders nothing otherwise.
 */
export function CarriedForwardNote({ repeat, compact = false }: { repeat: CarriedForward; compact?: boolean }) {
  if (!repeat.carriedForward) return null;
  return <p className={`carried-forward${compact ? ' is-compact' : ''}`} role="note" aria-label="Repeated reporting period">
    <b>Possibly carried forward.</b> {repeat.currentPeriod} is identical to {repeat.previousPeriod} in every field for {repeat.identical} of {repeat.compared} ULBs. It may be the {repeat.previousPeriod} report repeated rather than a new one, and the source does not say which.
  </p>;
}

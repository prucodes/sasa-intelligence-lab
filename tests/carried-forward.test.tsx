import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getCarriedForward, getReportedMovements } from '@/lib/analytics';
import { CarriedForwardNote } from '@/app/carried-forward-note';

describe('carried-forward periods', () => {
  it('flags a period that repeats the one before for every ULB, and not one where values moved', () => {
    const vehicles = getCarriedForward('sasa_sac_machinery_e_autos_service_model_api');
    const toilets = getCarriedForward('sasa_sac_identification_of_new_ihhls_api');
    const legacy = getCarriedForward('sasa_100_percent_clearance_of_legacy_waste_api');
    expect(vehicles).toMatchObject({ previousPeriod: 'June 2026', currentPeriod: 'July 2026', carriedForward: true });
    expect(vehicles.identical).toBe(vehicles.compared);
    expect(toilets.carriedForward).toBe(true);
    expect(toilets.identical).toBe(toilets.compared);
    // Legacy waste balances changed for a quarter of ULBs, so July is not a copy of June.
    expect(legacy.carriedForward).toBe(false);
    expect(legacy.identical).toBeLessThan(legacy.compared);
  });

  it('attaches the same reading to every reported movement', () => {
    const repeats = Object.fromEntries(getReportedMovements().map((movement) => [movement.id, movement.repeat.carriedForward]));
    expect(repeats).toEqual({ collection: true, sanitation: true, processing: false });
  });

  it('says so in plain words when a period repeats, and stays silent when it does not', () => {
    const repeat = getCarriedForward('sasa_sac_identification_of_new_ihhls_api');
    const { unmount } = render(<CarriedForwardNote repeat={repeat}/>);
    const note = screen.getByRole('note', { name: 'Repeated reporting period' });
    expect(note).toHaveTextContent(`July 2026 is identical to June 2026 in every field for ${repeat.identical} of ${repeat.compared} ULBs`);
    expect(note).toHaveTextContent('the source does not say which');
    unmount();
    const { container } = render(<CarriedForwardNote repeat={getCarriedForward('sasa_100_percent_clearance_of_legacy_waste_api')}/>);
    expect(container).toBeEmptyDOMElement();
  });
});

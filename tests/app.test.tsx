import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabApp } from '@/app/lab-app';
import { readinessCatalogueStats } from '@/lib/catalogue';

describe('application shell and screens', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('opens on governed evidence, not the synthetic fixture', () => {
    // An unqualified link is the one a department actually receives. It must not show
    // illustrative numbers to someone who did not know to add a query parameter.
    render(<LabApp page="overview" />);
    expect(screen.getByRole('combobox', { name: /data mode/i })).toHaveValue('SAMPLE');
    expect(screen.getByText(/authenticated, governed SASA evidence/i)).toBeInTheDocument();
  });

  it('renders accessible primary navigation and mode control', () => {
    render(<LabApp page="overview" initialMode="DEMO" />);
    const navigation = screen.getByRole('complementary', { name: /primary navigation/i });
    expect(navigation).toBeInTheDocument();
    expect(navigation.querySelectorAll('nav a')).toHaveLength(6);
    expect(screen.getByRole('combobox', { name: /data mode/i })).toHaveValue('DEMO');
    expect(screen.getByRole('heading', { name: /what sasa data can tell us today/i })).toBeInTheDocument();
  });

  it('switches between light and dark presentation themes', () => {
    const { container } = render(<LabApp page="overview" initialMode="DEMO" />);
    const shell = container.querySelector('.app-shell');
    expect(shell).toHaveClass('theme-light');
    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(shell).toHaveClass('theme-dark');
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toHaveAttribute('aria-pressed', 'true');
    expect(window.location.search).toContain('theme=dark');
  });

  it('opens a maintained plain-language glossary from About', () => {
    render(<LabApp page="overview" initialMode="SAMPLE" />);
    fireEvent.click(screen.getByRole('button', { name: /about sasa intelligence lab and glossary/i }));
    expect(screen.getByRole('dialog', { name: /sasa.*intelligence lab/i })).toBeInTheDocument();
    expect(screen.getByText('UNSCORED', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('dataset grain', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('configured capacity', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('candidate identity', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('crosswalk', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('retained snapshot', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('ULB', { selector: 'dt' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close about panel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches modes without mixing synthetic and sample values', () => {
    render(<LabApp page="overview" initialMode="DEMO" />);
    fireEvent.change(screen.getByRole('combobox', { name: /data mode/i }), { target: { value: 'SAMPLE' } });
    expect(screen.getByText(/authenticated, governed SASA evidence/i)).toBeInTheDocument();
    expect(screen.getAllByText(/6,509/).length).toBeGreaterThan(0);
    // The landing leads with the selected subject's finding, not a section label.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/decline at every step/i);
    expect(screen.getByLabelText('Operational review subjects')).toHaveTextContent(/Vehicle delivery.*Household toilets.*Legacy waste/i);
    expect(screen.getByLabelText('Four-month rural collection comparison')).toHaveTextContent('85,769');
    fireEvent.click(screen.getByRole('button', {name:/Household toilets/}));
    expect(screen.getByLabelText('Connected district and ULB review')).toHaveTextContent(/approvals awaiting completion/i);
    expect(screen.getByLabelText('Evidence scope and decision boundary')).toHaveTextContent(/OPEN GAP RADAR/i);
    expect(screen.queryByText(/102 ULBs rated/i)).not.toBeInTheDocument();
    expect(screen.queryByText('84%')).not.toBeInTheDocument();
  });

  it('supports an explicit unscored state in the radar', () => {
    render(<LabApp page="gap-radar" initialMode="DEMO" />);
    expect(screen.getAllByText('Unscored').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/two by two performance gap matrix/i)).toBeInTheDocument();
  });

  it('turns a completed local crosswalk into a compact governed summary', () => {
    render(<LabApp page="gap-radar" initialMode="SAMPLE" />);
    expect(screen.getByRole('heading', { name: /82 of 82 residual names carry a decision/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/crosswalk effect and remaining scoring gates/i)).toHaveTextContent(/235 observations/i);
    expect(screen.getByText(/open decision audit and transfer tools/i)).toBeInTheDocument();
    expect(screen.queryByText(/approve the obvious ones in bulk/i)).not.toBeInTheDocument();
  });

  it('shows evidence disclosure in diagnostics', () => {
    render(<LabApp page="diagnostics" initialMode="DEMO" initialUlbKey="demo-delta" />);
    expect(screen.getByRole('heading', { level: 2, name: /evidence inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/local fixture · not a sasa source record/i)).toBeInTheDocument();
  });

  it('updates the evidence inspector when a sample metric is selected', () => {
    render(<LabApp page="diagnostics" initialMode="SAMPLE" initialUlbKey="sample-narsipatnam" />);
    fireEvent.click(screen.getByRole('button', {name:/^Facilities /}));
    fireEvent.click(screen.getByRole('button', { name: /Processing facility/i }));
    expect(screen.getByText('total_tpd')).toBeInTheDocument();
    expect(screen.getByText('30', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText(/unreviewed — excluded from scoring/i, { selector: '.evidence-row b' })).toBeInTheDocument();
    expect(screen.getByText(/candidate identity awaiting review/i)).toBeInTheDocument();
    expect(screen.getByText('Grain')).toBeInTheDocument();
    expect(screen.getByText('Formula / check')).toBeInTheDocument();
  });

  it('labels readiness requirements as gates', () => {
    render(<LabApp page="data-readiness" initialMode="DEMO" />);
    expect(screen.getByRole('heading', { name: /activation gates/i })).toBeInTheDocument();
    expect(screen.getByText(/requirements, not current capabilities/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Evidence activation pipeline')).not.toBeInTheDocument();
  });

  it('shows and filters all authorized snapshots without implying scoring eligibility', () => {
    render(<LabApp page="data-readiness" initialMode="SAMPLE" />);
    const activationPipeline = screen.getByLabelText(/evidence activation pipeline/i);
    expect(activationPipeline).toHaveTextContent(/current responses retained/i);
    expect(activationPipeline).toHaveTextContent(new RegExp(String(readinessCatalogueStats.platformAvailable)));
    // Retained responses grow with every sync; assert the live figure, not a snapshot of it.
    expect(activationPipeline).toHaveTextContent(new RegExp(String(readinessCatalogueStats.freshResponsesRetained)));
    expect(activationPipeline).toHaveTextContent(/scoring eligible/i);
    expect(activationPipeline).toHaveTextContent(/unscored/i);
    expect(screen.getAllByText(/retained historical snapshot/i)).toHaveLength(44);
    
    // Thirteen are documented on paper only (3 PR + 10 CDMA whose keys 404 on live).
    // Nothing is documented-only any more: every granted dataset is retained.
    expect(screen.queryAllByText(/documented · ingestion pending/i, { selector: '.dataset-name span' })).toHaveLength(0);
    // Three are live and readable but not pulled, which reads differently and must.
    // Nothing is live-but-unpulled any more; all four were retained on 2026-09-08.
    expect(screen.queryAllByText(/live · [\d,]+ rows · complete pull pending/i, { selector: '.dataset-name span' })).toHaveLength(0);
    expect(screen.getByText(/pagination reconciled to the source total/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /search catalogue/i }), { target: { value: 'ITC WOW' } });
    // 'ITC WOW' matches two catalogue rows: the SAC programme and the LGD-coded
    // CDMA schools dataset, both retained.
    expect(screen.getByText('2 / 50')).toBeInTheDocument();
    expect(screen.getAllByText('ITC WOW Programme in Schools').length).toBeGreaterThan(0);
  });

  it('renders source-backed operational analytics in four internal tabs', () => {
    render(<LabApp page="operational-analytics" initialMode="SAMPLE" />);
    expect(screen.getByRole('heading', { name: /reported delivery is far behind procurement intent/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /vehicles: planned, ordered and supplied/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /compare ulbs on the same evidence/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/same-source ulb comparison/i)).toHaveTextContent(/E-Auto Service Model.*ULB grain/i);
    expect(screen.getByRole('combobox', { name: /browse another ulb/i })).toBeDisabled();
    expect(screen.getAllByText('1,910').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /sanitation delivery/i }));
    expect(screen.getByRole('heading', { name: /approvals are not converting into reported completions/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /household toilets: approval to completion/i })).toBeInTheDocument();
    expect(screen.getAllByText('8,499', { selector: 'b' })).toHaveLength(2);
    expect(screen.getAllByText('0.2%').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /pipeline drop-off/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /processing infrastructure/i }));
    expect(screen.getByRole('heading', { name: /legacy-waste balance and facility-status exceptions are ready for review/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /reported clearance, with 1.35 million remaining/i })).toBeInTheDocument();
    expect(screen.getByText('13,53,366')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /facility registry/i }));
    expect(screen.getByRole('heading', { name: /configured capacity by facility type/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /facility registry/i })).toBeInTheDocument();
    expect(screen.getAllByText(/configured capacity is not actual throughput or utilization/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /swachh outcomes/i }));
    expect(screen.getByRole('heading', { name: /2024 outcomes are a historical baseline/i })).toBeInTheDocument();
    expect(screen.getAllByText(/2024 Swachh Outcomes/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /see what overlaps before reading the distributions/i })).toBeInTheDocument();
    expect(screen.getByText(/ODF \+ rank candidates/i)).toBeInTheDocument();
  });

  it('opens the evidence movement lens without stacking the snapshot dashboard', () => {
    render(<LabApp page="operational-analytics" initialMode="SAMPLE" />);
    fireEvent.click(screen.getByRole('tab', { name: /between periods/i }));
    expect(screen.getByRole('heading', { name: /where reported vehicle supply changed/i })).toBeInTheDocument();
    expect(screen.getByText(/no movement among comparable pairs/i)).toBeInTheDocument();
    expect(screen.getByText(/same values returned/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /vehicles: planned, ordered and supplied/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /processing infrastructure/i }));
    expect(screen.getByRole('heading', { name: /where reported legacy-waste balance changed/i })).toBeInTheDocument();
    expect(screen.getByText(/largest absolute reported changes/i)).toBeInTheDocument();
    expect(screen.getByText('25', { selector: '.movement-kpis .is-lower strong' })).toBeInTheDocument();
  });

  it('does not turn an absent operational source-period into a zero-performance headline', () => {
    render(<LabApp page="operational-analytics" initialMode="SAMPLE" />);
    fireEvent.change(screen.getByRole('combobox', { name: /reported period/i }), { target: { value: '2026-03' } });
    const briefing = screen.getByLabelText('Operational evidence briefing');
    expect(briefing).toHaveTextContent('No retained ULB procurement rows for this selection.');
    expect(briefing).toHaveTextContent('Not returned');
    expect(briefing).not.toHaveTextContent('0.0%');
    expect(briefing).not.toHaveTextContent('far behind procurement intent');
    expect(screen.queryByLabelText('Reported stage quantities')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Same-source ULB comparison')).not.toBeInTheDocument();
  });

  it('keeps coverage, periods, and quality inside Data Readiness', () => {
    render(<LabApp page="data-readiness" initialMode="SAMPLE" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Coverage' }));
    expect(screen.queryByLabelText('Evidence activation pipeline')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view activation pipeline/i })).toBeInTheDocument();
    const limitingSources = screen.getByRole('heading', { name: /limiting evidence sources/i });
    expect(limitingSources).toBeInTheDocument();
    expect(limitingSources.closest('article')).toHaveTextContent(/every bar uses the same 123 observed ulb-name candidates/i);
    expect(screen.getByText(/“not returned” is kept distinct from zero/i)).toBeInTheDocument();
    expect(screen.getByText(/inspect candidate-level evidence matrix/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /full operational evidence breadth/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Periods' }));
    expect(screen.getByRole('heading', { name: /period availability/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /new file becomes evidence only after it clears four checks/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/next retained snapshot acceptance gate/i)).toHaveTextContent(/Trend still requires comparable repeated periods/i);
    fireEvent.click(screen.getByRole('tab', { name: 'Quality' }));
    expect(screen.getByRole('heading', { name: /evidence reconciliation workspace/i })).toBeInTheDocument();
    // The condition appears twice by design: once in the prioritised review inbox and
    // once in the reconciliation workspace it links to.
    expect(screen.getAllByText(/reported percentage does not reconcile/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('heading', { name: /review inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /activation details/i })).toBeInTheDocument();
  });

  it('keeps activation blockers visible after a condition is marked reviewed locally', () => {
    const {container} = render(<LabApp page="data-readiness" initialMode="SAMPLE" />);
    fireEvent.click(screen.getByRole('tab', {name:'Quality'}));
    const blockedCount = container.querySelector('.inbox-blocked b')?.textContent;
    // Reconciled retained exports and the rural comparison no longer create blockers.
    expect(blockedCount).toBe('2');
    fireEvent.click(screen.getAllByRole('button', {name:'Mark reviewed locally'})[0]);
    expect(container.querySelector('.inbox-blocked b')).toHaveTextContent(blockedCount!);
    expect(screen.getByText(/summed open condition counts · may overlap/i)).toBeInTheDocument();
  });

  it('opens a browse-first comparison tray that persists selected ULBs', () => {
    render(<LabApp page="operational-analytics" initialMode="SAMPLE" />);
    fireEvent.click(screen.getByRole('button', { name: /open ulb comparison tray/i }));
    expect(screen.getByRole('dialog', { name: /ulb comparison tray/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /browse a district to add/i })).toBeInTheDocument();
    const districtPicker = screen.getByRole('combobox', { name: /browse a district to add/i }) as unknown as HTMLSelectElement;
    const district = districtPicker.options[1]?.value;
    expect(district).toBeTruthy();
    fireEvent.change(districtPicker, { target: { value: district } });
    expect(screen.getByText(/sources returning evidence/i)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('sasa-compare-ulbs-v1') ?? '[]')).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /ulb comparison tray/i })).not.toBeInTheDocument();
  });

  it('exposes a governed evidence brief action without changing the evidence state', () => {
    render(<LabApp page="overview" initialMode="SAMPLE" />);
    expect(screen.getByRole('button', { name: /open executive evidence brief/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open executive evidence brief/i }));
    expect(screen.getByRole('dialog', {name:'Executive evidence brief'})).toBeInTheDocument();
    expect(screen.getByText(/authenticated, governed sasa evidence/i)).toBeInTheDocument();
  });

  it('explains why authenticated sample entities remain unscored', () => {
    render(<LabApp page="gap-radar" initialMode="SAMPLE" />);
    expect(screen.getByRole('heading', { name: 'Gap Radar' })).toBeInTheDocument();
    expect(screen.getByText('0', { selector: '.radar-zero strong' })).toBeInTheDocument();
    expect(screen.getByText(/entities eligible for scoring/i)).toBeInTheDocument();
    expect(screen.getByText(/working crosswalk reviewed locally/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/two by two performance gap matrix/i)).not.toBeInTheDocument();
  });
});

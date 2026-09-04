import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabApp } from '@/app/lab-app';

describe('application shell and screens', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders accessible primary navigation and mode control', () => {
    render(<LabApp page="overview" />);
    const navigation = screen.getByRole('complementary', { name: /primary navigation/i });
    expect(navigation).toBeInTheDocument();
    expect(navigation.querySelectorAll('nav a')).toHaveLength(5);
    expect(screen.getByRole('combobox', { name: /data mode/i })).toHaveValue('DEMO');
    expect(screen.getByRole('heading', { name: /what sasa data can tell us today/i })).toBeInTheDocument();
  });

  it('switches between light and dark presentation themes', () => {
    const { container } = render(<LabApp page="overview" />);
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
    render(<LabApp page="overview" />);
    fireEvent.change(screen.getByRole('combobox', { name: /data mode/i }), { target: { value: 'SAMPLE' } });
    expect(screen.getByText(/authenticated, governed SASA evidence/i)).toBeInTheDocument();
    expect(screen.getAllByText(/4,359/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /what needs attention/i })).toBeInTheDocument();
    expect(screen.getByText(/reported vehicle delivery is substantially behind procurement target/i)).toBeInTheDocument();
    expect(screen.getByText(/reported ihhl completion is very low relative to approvals/i)).toBeInTheDocument();
    expect(screen.queryByText('84%')).not.toBeInTheDocument();
  });

  it('supports an explicit unscored state in the radar', () => {
    render(<LabApp page="gap-radar" />);
    expect(screen.getAllByText('Unscored').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/two by two performance gap matrix/i)).toBeInTheDocument();
  });

  it('shows evidence disclosure in diagnostics', () => {
    render(<LabApp page="diagnostics" initialUlbKey="demo-delta" />);
    expect(screen.getByRole('heading', { level: 2, name: /evidence inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/local fixture · not a sasa source record/i)).toBeInTheDocument();
  });

  it('updates the evidence inspector when a sample metric is selected', () => {
    render(<LabApp page="diagnostics" initialMode="SAMPLE" initialUlbKey="sample-narsipatnam" />);
    fireEvent.click(screen.getByRole('button', { name: /Processing facility/i }));
    expect(screen.getByText('total_tpd')).toBeInTheDocument();
    expect(screen.getByText('30', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText(/unreviewed — excluded from scoring/i)).toBeInTheDocument();
    expect(screen.getByText(/candidate cross-source identity — not yet reviewed/i)).toBeInTheDocument();
    expect(screen.getByText('Grain')).toBeInTheDocument();
    expect(screen.getByText('Formula / check')).toBeInTheDocument();
  });

  it('labels readiness requirements as gates', () => {
    render(<LabApp page="data-readiness" />);
    expect(screen.getByRole('heading', { name: /activation gates/i })).toBeInTheDocument();
    expect(screen.getByText(/requirements, not current capabilities/i)).toBeInTheDocument();
  });

  it('shows and filters all authorized snapshots without implying scoring eligibility', () => {
    render(<LabApp page="data-readiness" initialMode="SAMPLE" />);
    const activationPipeline = screen.getByLabelText(/evidence activation pipeline/i);
    expect(activationPipeline).toHaveTextContent(/complete retained/i);
    expect(activationPipeline).toHaveTextContent(/29/);
    expect(activationPipeline).toHaveTextContent(/scoring eligible/i);
    expect(activationPipeline).toHaveTextContent(/unscored/i);
    expect(screen.getAllByText(/complete governed snapshot/i)).toHaveLength(29);
    
    // Thirteen are documented on paper only (3 PR + 10 CDMA whose keys 404 on live).
    expect(screen.getAllByText(/documented · ingestion pending/i, { selector: '.dataset-name span' })).toHaveLength(13);
    // Three are live and readable but not pulled, which reads differently and must.
    expect(screen.getAllByText(/live · [\d,]+ rows · complete pull pending/i, { selector: '.dataset-name span' })).toHaveLength(3);
    expect(screen.getByText(/pagination reconciled to the source total/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /search catalogue/i }), { target: { value: 'ITC WOW' } });
    // 'ITC WOW' now matches two catalogue rows: the live SAC programme and the
    // documented (404) CDMA schools dataset added from the revised guide.
    expect(screen.getByText('2 / 46')).toBeInTheDocument();
    expect(screen.getAllByText('ITC WOW Programme in Schools').length).toBeGreaterThan(0);
  });

  it('renders source-backed operational analytics in four internal tabs', () => {
    render(<LabApp page="operational-analytics" initialMode="SAMPLE" />);
    expect(screen.getByRole('heading', { name: /reported delivery is far behind procurement intent/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /collection procurement funnel/i })).toBeInTheDocument();
    expect(screen.getAllByText('1,910').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /sanitation delivery/i }));
    expect(screen.getByRole('heading', { name: /approvals are not converting into reported completions/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ihhl delivery funnel/i })).toBeInTheDocument();
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
    expect(screen.getByText(/only 5 GFC records are available/i)).toBeInTheDocument();
  });

  it('keeps coverage, periods, and quality inside Data Readiness', () => {
    render(<LabApp page="data-readiness" initialMode="SAMPLE" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Coverage' }));
    expect(screen.getByRole('heading', { name: /evidence coverage matrix/i })).toBeInTheDocument();
    expect(screen.getByText(/a blank means the source returned nothing, not a zero/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /full operational evidence breadth/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Periods' }));
    expect(screen.getByRole('heading', { name: /period availability/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Quality' }));
    expect(screen.getByRole('heading', { name: /evidence reconciliation workspace/i })).toBeInTheDocument();
    // The condition appears twice by design: once in the prioritised review inbox and
    // once in the reconciliation workspace it links to.
    expect(screen.getAllByText(/reported percentage does not reconcile/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('heading', { name: /review inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /activation details/i })).toBeInTheDocument();
  });

  it('explains why authenticated sample entities remain unscored', () => {
    render(<LabApp page="gap-radar" initialMode="SAMPLE" />);
    expect(screen.getByRole('heading', { name: /scoring starts once the operational and outcome data line up/i })).toBeInTheDocument();
    expect(screen.getByText('0', { selector: '.radar-zero strong' })).toBeInTheDocument();
    expect(screen.getByText(/entities eligible for scoring/i)).toBeInTheDocument();
    expect(screen.getByText(/ULB identity not reviewed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/two by two performance gap matrix/i)).not.toBeInTheDocument();
  });
});

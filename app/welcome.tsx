'use client';

import {useEffect, useRef, useState, type MouseEvent} from 'react';
import {WELCOME_SEEN_KEY} from '@/lib/welcome-entry';
import {BrandMark} from './brand-mark';
import {welcomeMapKey, welcomeSegregationKey} from '@/lib/welcome-map-key';
import './welcome.css';

const layers = [
  {id: 'collection', label: 'Collection', title: 'Households collected from', definition: 'Households collected from, as a share of all households in the register.', key: welcomeMapKey},
  {id: 'segregation', label: 'Segregation', title: 'Households segregating', definition: 'Households segregating, as a share of all households in the register, so a household not collected from counts as not segregating.', key: welcomeSegregationKey},
] as const;

function WelcomePlate() {
  const [active, setActive] = useState<(typeof layers)[number]['id']>('collection');
  const layer = layers.find(item => item.id === active)!;
  const examples = layer.key.examples.map(row => `${row.district} ${row.display} across ${row.reporting} urban local bodies`).join('. ');

  return <figure className="welcome-plate">
    <div className="welcome-plate-toolbar">
      <div className="welcome-view-switch" role="group" aria-label="District map measure">
        {layers.map(item => <button key={item.id} type="button" aria-pressed={active === item.id} aria-controls="welcome-evidence" onClick={() => setActive(item.id)}>{item.label}</button>)}
      </div>
      <time className="welcome-date">{layer.key.period}</time>
    </div>
    <div id="welcome-evidence" className="welcome-image-window">
      <div className={`welcome-map-art art-${layer.id}`} key={active} role="img" aria-label={`${layer.title} by district. ${examples}.`}/>
    </div>
    <figcaption aria-live="polite" aria-atomic="true">
      <strong className="welcome-caption-title">{layer.title}</strong>
      <p className="welcome-map-definition">{layer.definition} Each district adds up the households of its urban local bodies, the same figures as the Goals screen.</p>
      <div className="welcome-key">{layer.key.bands.map(band => <span key={band.label}><i style={{background:band.color}}/>{band.label}</span>)}<span><i className="key-hatch"/>No matched reading</span></div>
      <small className="welcome-map-period">{layer.key.mapUlbCount} urban local bodies · {layer.key.mapped} of {layer.key.total} district shapes · 2022 boundaries{layer.key.offMap.map(row => <span key={row.district}> · {row.district} {row.display}, {row.reporting} urban local bodies, has no 2022 boundary and is not drawn</span>)}</small>
    </figcaption>
  </figure>;
}

export function WelcomeScreen() {
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function enter(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const root = document.documentElement;
    if (root.dataset.sasaWelcome === 'leaving') return;
    try { window.localStorage.setItem(WELCOME_SEEN_KEY, '1'); } catch { /* Entry still works in private sessions. */ }

    const revealOverview = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      if (!url.searchParams.has('mode')) url.searchParams.set('mode', 'governed');
      window.history.replaceState(window.history.state, '', url);
      delete root.dataset.sasaWelcome;
      document.getElementById('main-content')?.focus({preventScroll: true});
      window.scrollTo({top: 0, behavior: 'instant'});
    };

    if (!window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) {
      revealOverview();
    } else {
      root.dataset.sasaWelcome = 'leaving';
      timer.current = window.setTimeout(revealOverview, 220);
    }
  }

  return <main className="welcome-screen" aria-labelledby="welcome-heading">
    <div className="welcome-frame">
      <header className="welcome-masthead">
        <div className="welcome-brand"><BrandMark/><span><strong>SASA</strong><small>Intelligence Lab</small></span></div>
        <span className="welcome-locale" lang="te">ఆంధ్రప్రదేశ్</span>
      </header>
      <div className="welcome-spread">
        <section className="welcome-copy">
          <p className="welcome-place">For Swachha Andhra Corporation</p>
          <h1 id="welcome-heading"><span>Sanitation in</span><br/><em>Andhra Pradesh.</em></h1>
          <p className="welcome-description">Explore urban waste collection, segregation and treatment through the records of Andhra Pradesh’s towns and cities.</p>
          <a className="welcome-enter" href="?mode=governed" onClick={enter}>
            Enter the lab <span aria-hidden="true">→</span>
          </a>
        </section>
        <WelcomePlate/>
      </div>
      <footer className="welcome-colophon">
        <div className="welcome-service-signature" aria-label="Household collection, waste segregation and treatment">
          <div className="welcome-service-art" aria-hidden="true"/>
          <div className="welcome-service-labels" aria-hidden="true"><span>Collection</span><span>Segregation</span><span>Treatment</span></div>
        </div>
        <div className="welcome-credit-line">
          <span className="welcome-programme">Swachha Andhra <i aria-hidden="true">/</i> Swarna Andhra</span>
          <span className="welcome-signature" role="img" aria-label="An exploration by Pruthvi Yannam" title="An exploration by Pruthvi Yannam">py.</span>
        </div>
      </footer>
    </div>
  </main>;
}

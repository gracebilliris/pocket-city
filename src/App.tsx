import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { COSTS, GRID_SIZE, createCity, deserializeCity, getStats, isRoadConnected, nextDay, placeTile, serializeCity } from './simulation';
import type { City, TileType } from './simulation';
import './App.css';

const SAVE_KEY = 'pocket-city-save-v1';
const tools: { type: TileType; name: string; detail: string; key: string }[] = [
  { type: 'road', name: 'Road', detail: 'Connect your neighborhood', key: '1' },
  { type: 'house', name: 'House', detail: 'A little place to call home', key: '2' },
  { type: 'park', name: 'Park', detail: 'Room to breathe & bloom', key: '3' },
  { type: 'shop', name: 'Shop', detail: 'Local jobs, happy neighbors', key: '4' },
  { type: 'service', name: 'Service', detail: 'Care for your community', key: '5' },
  { type: 'empty', name: 'Bulldoze', detail: 'Make space for a new idea', key: '6' },
];

function TileArt({ type, variant = 0 }: { type: TileType; variant?: number }) {
  return <svg viewBox="0 0 64 72" fill="none" aria-hidden="true" className={`tile-art art-${type}`}>
    {type === 'house' && <>
      <path d="M9 35 33 23 55 35 31 48Z" fill="#728c72" opacity=".18" />
      <path d="M14 31 33 21 51 31V52L32 62 14 51Z" fill={variant % 2 ? '#f5d399' : '#f5baaa'} />
      <path d="M32 41 51 31V52L32 62Z" fill={variant % 2 ? '#d9b477' : '#d99286'} />
      <path d="m9 32 22-24 25 25-24 12Z" fill={variant % 2 ? '#678c86' : '#bc7565'} />
      <path d="m31 8 25 25-24 12Z" fill={variant % 2 ? '#426b67' : '#9b5b51'} />
      <path d="M42 13v13l5 4V15Z" fill="#e5c4a0" />
      <path d="M20 39v9l6 3v-9Z" fill="#fff5da" />
      <path d="m38 45 7-4v12l-7 4Z" fill="#5a7774" />
      <path d="m37 43 9-5v3l-9 5Z" fill="#fae0b7" />
    </>}
    {type === 'road' && <>
      <path d="M0 24 31 9 64 25V55L33 71 0 55Z" fill="#abbdb2" />
      <path d="M0 29 32 13 64 29V51L32 67 0 51Z" fill="#718780" />
      <path d="m0 40 8 4m9 5 10 5m10 1 10-5m9-5 8-4" stroke="#f1e7c9" strokeWidth="2" strokeDasharray="5 6" />
    </>}
    {type === 'park' && <>
      <path d="m5 49 27-14 27 14-27 15Z" fill="#91b781" />
      <path d="M21 27v26m23-25v22" stroke="#8b8061" strokeWidth="4" />
      <path d="M21 8C8 8 5 27 9 33c5 8 24 7 26-4C37 20 31 7 21 8Z" fill="#6caa86" />
      <path d="M44 15c-10-1-16 14-12 21 4 7 20 7 23-1 3-9-3-19-11-20Z" fill="#438978" />
      <path d="m19 51 13 6 11-6" stroke="#e2d7a8" strokeWidth="4" />
      <circle cx="11" cy="49" r="2" fill="#f3b4a2" /><circle cx="48" cy="53" r="2" fill="#f5dc8e" />
    </>}
    {type === 'shop' && <>
      <path d="m9 29 25-12 22 12v25L32 66 9 54Z" fill="#f1d6a5" />
      <path d="M32 41 56 29v25L32 66Z" fill="#d4b77f" />
      <path d="m7 28 27-13 25 13-27 14Z" fill="#6d9d97" />
      <path d="M8 36 32 48v8L8 44Z" fill="#ed967f" />
      <path d="m32 48 25-13v8L32 56Z" fill="#d37865" />
      <path d="M14 40v7m9-3v8m17-10v9m9-13v8" stroke="#fff1d2" strokeWidth="5" />
      <path d="m39 55 10-5v9l-10 5Z" fill="#5a7774" />
      <path d="m27 17 10-5 10 5-10 5Z" fill="#f8ead2" />
    </>}
    {type === 'service' && <>
      <path d="m9 30 25-12 22 12v25L32 67 9 55Z" fill="#d4e4dd" />
      <path d="M32 43 56 30v25L32 67Z" fill="#a2c3b9" />
      <path d="M6 29 33 15l26 14-27 15Z" fill="#5b938a" />
      <path d="M15 37v11l10 5V42Z" fill="#fff9df" />
      <path d="m41 43 8-4v9l-8 4Z" fill="#f5eed3" />
      <path d="m39 56 10-5v9l-10 5Z" fill="#527e77" />
      <path d="M31 7v17m-8-8h16" stroke="#df8877" strokeWidth="5" />
    </>}
    {type === 'empty' && <>
      <path d="m13 43 19-10 20 10-20 11Z" fill="#edc49a" />
      <path d="m18 38 14-7 15 7-15 8Z" fill="#e5a56d" />
      <path d="m29 19 7-3 15 22-8 4Z" fill="#c48b58" />
      <path d="m14 21 17-9 8 4-17 10Z" fill="#526f67" />
      <path d="M14 21v8l8 5v-8Z" fill="#6d8d80" />
      <path d="m22 26 17-10v8L22 34Z" fill="#3c5a54" />
    </>}
  </svg>;
}

function MiniIcon({ name }: { name: 'sun' | 'people' | 'bag' | 'heart' | 'coin' | 'arrow' | 'leaf' }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'sun' && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
    {name === 'people' && <><circle cx="9" cy="7" r="3" /><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5" /></>}
    {name === 'bag' && <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12c6 4 12 4 18 0m-9 1v3" /></>}
    {name === 'heart' && <path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 4 12 8 15 4-3 13-10 8-15Z" />}
    {name === 'coin' && <><ellipse cx="12" cy="7" rx="8" ry="4" /><path d="M4 7v10c0 5 16 5 16 0V7M4 12c0 5 16 5 16 0" /></>}
    {name === 'arrow' && <path d="M4 12h16m-6-6 6 6-6 6" />}
    {name === 'leaf' && <><path d="M20 3C8 1 1 8 5 15s17 4 15-12ZM5 20 16 8" /></>}
  </svg>;
}

function loadCity(): City {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    return (saved && deserializeCity(saved)) || createCity();
  } catch {
    return createCity();
  }
}

export default function App() {
  const [city, setCity] = useState<City>(loadCity);
  const [tool, setTool] = useState<TileType>('road');
  const [activeTile, setActiveTile] = useState(40);
  const [notice, setNotice] = useState('A fresh start. Your little city is full of possibilities.');
  const [saved, setSaved] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [preset, setPreset] = useState<'blank' | 'village'>('blank');
  const [showGuide, setShowGuide] = useState(true);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const stats = useMemo(() => getStats(city), [city]);
  const selected = tools.find((item) => item.type === tool)!;
  const houses = city.tiles.filter((tile) => tile === 'house').length;
  const roads = city.tiles.filter((tile) => tile === 'road').length;
  const greenery = city.tiles.filter((tile) => tile === 'park').length;
  const net = stats.income - stats.expenses;

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, serializeCity(city));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [city]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (resetOpen || event.altKey || event.ctrlKey || event.metaKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const item = tools.find((candidate) => candidate.key === event.key);
      if (item) { event.preventDefault(); setTool(item.type); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetOpen]);

  useEffect(() => {
    if (resetOpen) modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [resetOpen]);

  function build(index: number) {
    try {
      const updated = placeTile(city, index, tool);
      setCity(updated);
      if (updated === city) {
        setNotice(`This square is already ${tool === 'empty' ? 'empty' : `a ${tool}`}.`);
      } else {
        const access = tool !== 'empty' && tool !== 'road' && tool !== 'park' && !isRoadConnected(updated, index);
        setNotice(tool === 'empty' ? 'A clean slate. This square is ready for something new.' : `${selected.name} placed! ${access ? 'Add an adjacent road connected to the left edge for access.' : tool === 'road' ? 'Keep connecting roads to the left edge of town.' : 'A little more life in your neighborhood.'}`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let destination = index;
    if (event.key === 'ArrowRight') destination = Math.min(99, index + 1);
    else if (event.key === 'ArrowLeft') destination = Math.max(0, index - 1);
    else if (event.key === 'ArrowDown') destination = Math.min(99, index + GRID_SIZE);
    else if (event.key === 'ArrowUp') destination = Math.max(0, index - GRID_SIZE);
    else if (event.key === 'Home') destination = Math.floor(index / GRID_SIZE) * GRID_SIZE;
    else if (event.key === 'End') destination = Math.floor(index / GRID_SIZE) * GRID_SIZE + 9;
    else return;
    event.preventDefault();
    setActiveTile(destination);
    tileRefs.current[destination]?.focus();
  }

  function advance() {
    try {
      const updated = nextDay(city);
      const arrivals = updated.population - city.population;
      setCity(updated);
      setNotice(`Good morning, mayor. Day ${updated.day}: ${arrivals > 0 ? `${arrivals} new neighbors arrived!` : arrivals < 0 ? `${Math.abs(arrivals)} residents moved out. Check road access and housing.` : 'Your neighborhood is settling in.'}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not advance the day.');
    }
  }

  function closeModal() {
    setResetOpen(false);
    restartRef.current?.focus();
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#" aria-label="Pocket City home" onClick={(event) => event.preventDefault()}>
        <span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m4 14 12-9 12 9v14H4Z" fill="currentColor" /><path d="M12 27V16h8v11" stroke="#f7f5e9" strokeWidth="3" /><path d="M22 5v6" stroke="currentColor" strokeWidth="4" /></svg></span>
        <span>pocket<span className="brand-light">city</span><small>A LITTLE WORLD, MADE BY YOU</small></span>
      </a>
      <div className="header-right"><span className="slow-note">No rush. Just a little growing.</span><button ref={restartRef} className="text-button restart-button" onClick={() => setResetOpen(true)}><span aria-hidden="true">↻</span> New city</button></div>
    </header>

    <main>
      <section className="intro" aria-labelledby="page-title">
        <div><div className="eyebrow"><span /> YOUR OWN SMALL CORNER OF THE WORLD</div><h1 id="page-title">Big dreams. <em>Little city.</em></h1><p>Lay a road, plant a tree, make a place to belong.</p></div>
        <div className="day-pill"><span className="day-sun"><MiniIcon name="sun" /></span><span><small>A FRESH LITTLE START</small><strong>Day {city.day} <span>·</span> Your story begins</strong></span></div>
      </section>

      <section className="stats-strip" aria-label="City statistics">
        <div className="stat"><span className="stat-icon mint"><MiniIcon name="coin" /></span><div><span className="stat-label">City budget</span><strong>${city.budget.toLocaleString()}<small className={net < 0 ? 'negative' : ''}>{net >= 0 ? '+' : '−'}${Math.abs(net)} / day</small></strong></div></div>
        <div className="stat"><span className="stat-icon peach"><MiniIcon name="people" /></span><div><span className="stat-label">Population</span><strong>{stats.population}<small>of {stats.capacity} spaces</small></strong></div></div>
        <div className="stat"><span className="stat-icon lavender"><MiniIcon name="bag" /></span><div><span className="stat-label">Local jobs</span><strong>{stats.jobs}<small>{stats.jobs ? 'opportunities to thrive' : 'a fresh opportunity'}</small></strong></div></div>
        <div className="stat"><span className="stat-icon butter"><MiniIcon name="heart" /></span><div><span className="stat-label">Happiness</span><strong>{stats.happiness}%<small>{stats.happiness >= 75 ? 'life is pretty lovely' : 'room to grow together'}</small></strong></div></div>
      </section>

      <div className="builder-layout">
        <aside className="tool-panel" aria-label="Building tools">
          <div className="panel-heading"><div><span className="eyebrow">THE BUILDING BLOCKS</span><h2>Make it yours.</h2></div><span className="tiny-spark" aria-hidden="true">✳</span></div>
          <div className="tools">{tools.map((item) => <button key={item.type} className={`tool-button ${tool === item.type ? 'selected' : ''}`} aria-label={item.name} aria-pressed={tool === item.type} onClick={() => setTool(item.type)}>
            <span className={`tool-art icon-bg-${item.type}`}><TileArt type={item.type} /></span><span className="tool-copy"><strong>{item.name}<span className="tool-cost">{item.type === 'empty' ? 'Free' : `$${COSTS[item.type]}`}</span></strong><small>{item.detail}</small></span><kbd>{item.key}</kbd>
          </button>)}</div>
          <div className="tool-tip"><span aria-hidden="true">✦</span><p>{tool === 'road' ? 'Every great city starts with a road. Connect yours to the left edge.' : tool === 'house' ? 'Homes need an adjacent, connected road. New neighbors arrive the next day.' : tool === 'park' ? 'A park within two squares of a connected home makes life a little happier.' : tool === 'shop' ? 'A connected shop creates 6 jobs and earns $8 daily, before upkeep.' : tool === 'service' ? 'Connected services support homes within three squares and create 2 jobs.' : 'Bulldozing is free, but there are no refunds. Replacing a building costs the full price.'}</p></div>
          <div className="keyboard-hint"><kbd>1</kbd>–<kbd>6</kbd> choose <span>·</span> click a square to build</div>
        </aside>

        <section className="city-panel" aria-label="Your city">
          <div className="city-heading"><div><span className="live-dot" /> <h2>Your little neighborhood</h2><span className="plot-count">10 × 10 plots</span></div><span className={`save-status ${saved ? '' : 'save-warning'}`}><span aria-hidden="true">{saved ? '✓' : '!'}</span> {saved ? 'Autosaved' : 'Save unavailable'}</span></div>
          <div className={`city-landscape tool-mode-${tool}`}>
            <div className="landscape-caption"><span aria-hidden="true">☀</span> A good day to grow something.</div>
            <span className="landscape-cloud cloud-one" aria-hidden="true" /><span className="landscape-cloud cloud-two" aria-hidden="true" />
            <div className="board-wrap">
              <span className="entrance-label" aria-hidden="true">WAY IN <span>→</span></span>
              <div className="city-grid" role="group" aria-label="City building grid. Use arrow keys to navigate, and Enter or Space to build." style={{ '--grid-size': GRID_SIZE } as CSSProperties}>
                {city.tiles.map((type, index) => {
                  const disconnected = type !== 'empty' && type !== 'road' && type !== 'park' && !isRoadConnected(city, index);
                  return <button key={index} ref={(element) => { tileRefs.current[index] = element; }} className={`city-tile tile-${type} variation-${index % 4} ${index === 40 ? 'entrance-tile' : ''}`} aria-label={`Row ${Math.floor(index / GRID_SIZE) + 1}, column ${index % GRID_SIZE + 1}: ${type}`} title={`${type === 'empty' ? 'Empty plot' : `${type[0].toUpperCase()}${type.slice(1)}`}${disconnected ? ' · Needs road access' : ''} — click to ${tool === 'empty' ? 'bulldoze' : `build ${tool}`}`} tabIndex={activeTile === index ? 0 : -1} onFocus={() => setActiveTile(index)} onKeyDown={(event) => moveFocus(event, index)} onClick={() => build(index)}>
                    {type !== 'empty' ? <TileArt type={type} variant={index} /> : <><span className="plot-dot" /><span className="build-preview"><TileArt type={tool} /></span></>}
                    {disconnected && <span className="access-warning" aria-hidden="true">!</span>}
                  </button>;
                })}
              </div>
              <span className="board-edge-label" aria-hidden="true">A LITTLE SPACE. ENDLESS POSSIBILITIES.</span>
            </div>
            <div className="landscape-tree tree-one" aria-hidden="true">♠</div><div className="landscape-tree tree-two" aria-hidden="true">♠</div><div className="landscape-tree tree-three" aria-hidden="true">♠</div>
            <div className="map-legend"><span><i className="legend-dot" /> Buildable land</span><span>100 little possibilities</span></div>
          </div>
          <div className="city-bottom"><div className="selection-status"><span className="selection-dot" /><span><strong>{selected.name} selected</strong><small>{tool === 'empty' ? 'Click a square to clear it · no refund' : `Click a square to build · $${COSTS[tool]} per plot`}</small></span></div><button className="next-day" onClick={advance} aria-label="Next day"><MiniIcon name="sun" /> Next day <MiniIcon name="arrow" /></button></div>
          <div className="notice" role="status" aria-live="polite"><span aria-hidden="true">✧</span>{notice}</div>
        </section>
      </div>

      {showGuide && <section className="getting-started" aria-label="Quick start tutorial">
        <div className="guide-title"><span className="eyebrow">SMALL STEPS, HAPPY PLACES</span><h2>A little guide to getting started.</h2></div>
        <div className={`guide-step ${roads ? 'complete' : ''}`}><span className="step-number">{roads ? '✓' : '01'}</span><div><strong>Find your way in</strong><p>Start a road at the left edge.</p></div></div>
        <div className={`guide-step ${stats.connectedHomes ? 'complete' : ''}`}><span className="step-number">{stats.connectedHomes ? '✓' : '02'}</span><div><strong>Make yourself at home</strong><p>Build a house beside your road.</p></div></div>
        <div className={`guide-step ${city.day ? 'complete' : ''}`}><span className="step-number">{city.day ? '✓' : '03'}</span><div><strong>Let life move in</strong><p>Tap Next day. Meet your neighbors.</p></div></div>
        <button className="dismiss-guide" aria-label="Dismiss tutorial" onClick={() => setShowGuide(false)}>×</button>
      </section>}

      <section className="civic-cards" aria-label="Neighborhood insights">
        <article className="civic-card green-card"><span className="civic-icon"><MiniIcon name="leaf" /></span><div><h3>A greener kind of happy.</h3><p>{greenery ? `${greenery} little ${greenery === 1 ? 'park is' : 'parks are'} bringing nature closer to home.` : 'A pocket of green makes a world of difference. Plant a park near your homes.'}</p></div><span className="card-decoration" aria-hidden="true">✳</span></article>
        <article className="civic-card peach-card"><span className="civic-icon"><MiniIcon name="people" /></span><div><h3>Good neighbors. Great connections.</h3><p>{houses ? `${stats.connectedHomes} of ${houses} homes have road access. Roads connect people to possibility.` : 'Homes, shops, and services need a road connected to the left edge of your city.'}</p></div></article>
        <article className="civic-card cream-card"><span className="civic-icon"><MiniIcon name="coin" /></span><div><h3>A little balance goes a long way.</h3><p>Daily income <strong>${stats.income}</strong> · upkeep <strong>${stats.expenses}</strong>. Residents and local shops help your city thrive.</p></div></article>
      </section>
    </main>
    <footer className="site-footer"><span>Made for little moments of possibility.</span><span>Build thoughtfully. Grow happily. <span aria-hidden="true">✳</span></span></footer>

    {resetOpen && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <div ref={modalRef} className="reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" onKeyDown={(event) => {
        if (event.key === 'Escape') closeModal();
        if (event.key === 'Tab') {
          const buttons = Array.from(modalRef.current?.querySelectorAll<HTMLButtonElement>('button') || []);
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <span className="modal-spark" aria-hidden="true">✳</span><span className="eyebrow">ANOTHER LITTLE POSSIBILITY</span><h2 id="reset-title">A fresh patch of possibility?</h2><p id="reset-description">Starting a new city replaces your current neighborhood and its saved progress. Choose your new beginning.</p>
        <div className="preset-options"><button aria-pressed={preset === 'blank'} className={preset === 'blank' ? 'active' : ''} onClick={() => setPreset('blank')}><strong>A blank canvas</strong><span>100 open plots · $1,500</span></button><button aria-pressed={preset === 'village'} className={preset === 'village' ? 'active' : ''} onClick={() => setPreset('village')}><strong>A little head start</strong><span>A ready-made village · $1,050</span></button></div>
        <div className="modal-actions"><button className="cancel-button" onClick={closeModal}>Keep my city</button><button className="next-day" onClick={() => { setCity(createCity(preset)); setNotice(preset === 'blank' ? 'A fresh canvas. Start with a road along the left edge.' : 'Welcome to the village! Your new neighbors are settling in.'); setShowGuide(true); closeModal(); }}>Start new city <MiniIcon name="arrow" /></button></div>
      </div>
    </div>}
  </div>;
}

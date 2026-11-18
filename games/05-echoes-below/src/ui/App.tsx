import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type Phaser from 'phaser';
import { createGame } from '../game/config';
import { ITEMS, RECIPES, STATION_LABELS } from '../game/data/items';
import { EVENT, events } from '../game/events';
import { gameStore } from '../game/GameStore';
import type { Stack, UISnapshot } from '../game/types';

const ItemGlyph = ({ stack }: { stack: Stack | null }) => {
  if (!stack) return <span className="empty-dot">·</span>;
  const item = ITEMS[stack.id];
  return <span className={`item-glyph item-${item.category}`} style={{ '--item': `#${item.color.toString(16).padStart(6, '0')}` } as CSSProperties} />;
};

export function App() {
  const gameHost = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [ui, setUi] = useState<UISnapshot>(() => gameStore.snapshot());
  const [guide, setGuide] = useState(true);

  useEffect(() => {
    if (gameHost.current) game.current = createGame(gameHost.current);
    const sync = (next: UISnapshot) => setUi(next);
    events.on(EVENT.UI, sync); gameStore.emit();
    return () => { events.off(EVENT.UI, sync); game.current?.destroy(true); };
  }, []);

  const selected = ui.slots[ui.selected];
  const selectedItem = selected ? ITEMS[selected.id] : undefined;

  return (
    <main className="game-shell">
      <div ref={gameHost} id="phaser-game" aria-label="Echoes Below game world" />
      <div className="vignette" />

      <header className="top-hud hud-panel">
        <div className="brand"><i className="brand-mark" /><span>ECHOES<br /><b>BELOW</b></span></div>
        <div className="health-wrap">
          <div className="health-copy"><span>VITALITY</span><b>{ui.health} / {ui.maxHealth}</b></div>
          <div className="health-track"><i style={{ width: `${ui.health / ui.maxHealth * 100}%` }} /></div>
          <span className="defense">◆ {ui.defense} DEF</span>
        </div>
        <div className="world-status">
          <span className={ui.isNight ? 'orb moon' : 'orb sun'}>{ui.isNight ? '◐' : '✦'}</span>
          <div><b>{ui.timeLabel}</b><span>{ui.biome} · {ui.depth}</span></div>
        </div>
      </header>

      {ui.boss && <section className="boss-hud"><span>{ui.boss.name}</span><div><i style={{ width: `${ui.boss.health / ui.boss.maxHealth * 100}%` }} /></div><b>{Math.ceil(ui.boss.health)} / {ui.boss.maxHealth}</b></section>}

      <aside className="quest-card hud-panel">
        <span className="eyebrow">FIELD NOTES</span>
        <b>The song beneath</b>
        <p>{gameStore.stats.bossDefeated ? 'The Warden is gone. Forge its Rift Core into final equipment.' : 'Build a bench, smelt iron, harvest moonstone, then awaken the violet shrine.'}</p>
        <div className="depth-pips"><i className="done" /><i className={ui.depth !== 'Surface' ? 'done' : ''} /><i className={ui.depth === 'Deep Caverns' ? 'done' : ''} /></div>
      </aside>

      <aside className="controls hud-panel">
        <span className="eyebrow">CONTROLS</span>
        <dl><dt>A D</dt><dd>Move</dd><dt>SPACE</dt><dd>Jump</dd><dt>LMB</dt><dd>Mine / attack / use</dd><dt>RMB</dt><dd>Place / interact</dd><dt>E</dt><dd>Inventory</dd><dt>ESC</dt><dd>Pause</dd></dl>
      </aside>

      {guide && <section className="onboarding hud-panel">
        <button onClick={() => setGuide(false)} aria-label="Dismiss guide">×</button>
        <span className="eyebrow">WAYFINDER BRIEFING</span>
        <b>Welcome to the Shattered Reach</b>
        <p>Use your copper pick on nearby ground and your axe on trees. Drops are physical—walk over them to collect.</p>
        <small>Press <kbd>E</kbd> to craft after gathering wildwood.</small>
      </section>}

      <div className="hint"><span>◈</span>{ui.hint}</div>
      <Hotbar slots={ui.slots.slice(0, 10)} selected={ui.selected} />
      <div className="selected-label"><b>{selectedItem?.name ?? 'Empty hand'}</b><span>{selectedItem?.description ?? 'Select an item from your pack'}</span></div>

      {ui.inventoryOpen && <InventoryPanel ui={ui} />}
      {ui.paused && <PausePanel />}
    </main>
  );
}

function Hotbar({ slots, selected }: { slots: Array<Stack | null>; selected: number }) {
  return <nav className="hotbar" aria-label="Hotbar">
    {slots.map((stack, index) => {
      const item = stack ? ITEMS[stack.id] : undefined;
      return <button key={index} className={selected === index ? 'selected' : ''} onClick={() => events.emit(EVENT.SELECT_SLOT, index)} title={item ? `${item.name}: ${item.description}` : 'Empty slot'}>
        <span className="slot-number">{index === 9 ? 0 : index + 1}</span><ItemGlyph stack={stack} />{stack && stack.qty > 1 && <b>{stack.qty}</b>}
      </button>;
    })}
  </nav>;
}

function InventoryPanel({ ui }: { ui: UISnapshot }) {
  const available = useMemo(() => new Set(ui.stations), [ui.stations]);
  return <div className="modal-backdrop">
    <section className="inventory-panel panel-frame">
      <header><div><span className="eyebrow">EXPEDITION KIT</span><h2>Inventory</h2></div><button className="close" onClick={() => events.emit(EVENT.TOGGLE_INVENTORY)}>×</button></header>
      <p className="inventory-help">Select a hotbar slot, then click a pack item to swap it into that slot.</p>
      <div className="inventory-grid">
        {ui.slots.map((stack, index) => {
          const item = stack ? ITEMS[stack.id] : undefined;
          return <button key={index} className={`${index < 10 ? 'hot-slot' : ''} ${index === ui.selected ? 'selected' : ''}`} onClick={() => index < 10 ? events.emit(EVENT.SELECT_SLOT, index) : events.emit(EVENT.MOVE_SLOT, index)} title={item ? `${item.name} — ${item.description}` : 'Empty'}>
            <span className="slot-number">{index < 10 ? (index === 9 ? 0 : index + 1) : ''}</span><ItemGlyph stack={stack} />{stack && <b>{stack.qty}</b>}
          </button>;
        })}
      </div>
      <footer><span>Seed</span><code>{gameStore.seed}</code><button onClick={() => { gameStore.save(); gameStore.toast('Progress saved locally'); }}>Save now</button></footer>
    </section>
    <section className="craft-panel panel-frame">
      <header><div><span className="eyebrow">BLUEPRINTS</span><h2>Crafting</h2></div></header>
      <div className="stations">{(['hand', 'workbench', 'furnace', 'anvil'] as const).map((station) => <span className={available.has(station) ? 'active' : ''} key={station}>{STATION_LABELS[station]}</span>)}</div>
      <div className="recipe-list">
        {RECIPES.map((recipe) => {
          const output = ITEMS[recipe.output.id];
          const hasStation = recipe.station === 'hand' || available.has(recipe.station);
          const canMake = gameStore.inventory.canCraft(recipe, ui.stations);
          return <button key={recipe.id} disabled={!canMake} onClick={() => events.emit(EVENT.CRAFT, recipe.id)}>
            <ItemGlyph stack={recipe.output} />
            <span><b>{output.name} <em>×{recipe.output.qty}</em></b><small>{recipe.ingredients.map((part) => `${ITEMS[part.id].name} ${gameStore.inventory.count(part.id)}/${part.qty}`).join(' · ')}</small></span>
            <i className={hasStation ? 'station-ok' : ''}>{hasStation ? 'CRAFT' : STATION_LABELS[recipe.station]}</i>
          </button>;
        })}
      </div>
    </section>
  </div>;
}

function PausePanel() {
  return <div className="modal-backdrop pause-backdrop"><section className="pause-panel panel-frame">
    <span className="eyebrow">EXPEDITION SUSPENDED</span><h1>Paused</h1><p>Your world is safe and progress is stored locally every ten seconds.</p>
    <button onClick={() => events.emit(EVENT.TOGGLE_PAUSE)}>Return to the Reach</button><small>or press ESC</small>
  </section></div>;
}

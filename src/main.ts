import './style.css'
import {
  advance, canMatch, canPower, canTarget, cast, columns, draw, encounters, equip, match, maxHp,
  newGame, powerCost, powers, rankText, suits,
} from './game.ts'
import type { Card, Game, Suit, TargetPower } from './game.ts'

const suitArt: Record<Suit, string> = {
  str: '...##.##.... / ..########.. / ..##.#.#.##. / .#.#.#.#.##. / #..########. / #.##......#. / ##..####..#. / .###......#. / ..##.....##. / ...#######.. / ...#.....#.. / ...#######..',
  int: '............ / ..###.###... / .####.####.. / ##.##.#.###. / #.###.##.##. / #####.#####. / ##.##.##.### / .#.##.##..## / .####.#####. / ..####.###.. / ....##.#.... / ............',
  wis: '....####.... / ..##....##.. / .#...##...#. / #...####...# / #...####...# / .#...##...#. / ..##....##.. / ....####....',
  dex: '......###... / .....###.... / ....###..... / ...###...... / ..########.. / .....####... / ....###..... / ...###...... / ..##........ / .#..........',
  con: '..###..###.. / .#####.####. / ###########. / ###########. / .#########.. / ..#######... / ...#####.... / ....###..... / .....#......',
  chr: '.....##..... / .....##..... / ....####.... / .##########. / ..########.. / ...######... / ...######... / ..###..###.. / ..##....##..',
}
function icon(suit: Suit) {
  const path = suitArt[suit].split(' / ').map((row, y, rows) =>
    Array.from(row, (cell, x) => cell === '#' ? `M${x} ${y + Math.floor((12 - rows.length) / 2)}h1v1h-1z` : '').join('')
  ).join('')
  return `<svg viewBox="0 0 12 12" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path d="${path}"/></svg>`
}

const app = document.querySelector<HTMLDivElement>('#app')!
const dialogs = document.querySelector<HTMLDivElement>('#dialogs')!
const saveKey = 'gate-nine-v1'
let game = newGame()
let target: TargetPower | 'dex' | undefined
let powerInfo: Suit | undefined

try {
  const raw = localStorage.getItem(saveKey)
  if (raw) {
    const saved = JSON.parse(raw) as Omit<Game, 'gold' | 'dazzled'> & Partial<Pick<Game, 'gold' | 'dazzled'>>
    if (saved.tableau?.length === columns && encounters[saved.stage] && saved.active && saved.spent && saved.energy) {
      game = { ...saved, gold: saved.gold ?? 0, dazzled: saved.dazzled ?? false }
    }
  }
} catch { /* A fresh run remains available without storage. */ }

function save() {
  try { localStorage.setItem(saveKey, JSON.stringify(game)) } catch { /* Storage is optional. */ }
}

function cardLabel(card: Card) {
  return `${rankText(card.rank)} · ${powers[card.suit].label}`
}

function face(card: Card) {
  return `<span class="card-index">${rankText(card.rank)}</span>
    <span class="card-symbol">${icon(card.suit)}</span>
    <span class="card-suit">${powers[card.suit].label}</span>`
}

function hero() {
  const room = encounters[game.stage]
  const image = `${import.meta.env.BASE_URL}${room.art}-pixel.png`
  return `<section class="encounter" style="--scene:url('${image}')" aria-label="Current encounter">
    <div class="encounter-copy"><div class="overline">${room.place}</div><h2>${room.name}</h2>
      <div class="progress" aria-label="Encounter ${game.stage + 1} of ${encounters.length}">
        ${encounters.map((_, index) => `<i class="${index === game.stage ? 'current' : index < game.stage ? 'past' : ''}" aria-hidden="true"></i>`).join('')}
        Encounter ${game.stage + 1} of ${encounters.length}</div></div>
    ${game.phase === 'battle' ? `<div class="intent ${game.dazzled ? 'protected' : ''}">
      <strong>${game.dazzled ? 'Next draw protected' : `-${room.damage} HP per draw`}</strong></div>` : ''}
  </section>`
}

function stack(cards: Card[], index: number) {
  const card = cards.at(-1)
  const below = cards.at(-2)
  const matching = card && canMatch(game, card)
  const eligible = target === 'dex' ? false : target ? canTarget(game, target, index) : matching
  const revealed = below?.revealed ? ` Behind: ${cardLabel(below)}.` : ''
  return `<div class="stack" style="--depth:${Math.max(0, cards.length - 1)}">
    ${cards.slice(0, -1).map((covered, depth) =>
      `<div class="card back behind ${covered.revealed ? covered.suit + ' revealed' : ''}" style="--level:${depth}" aria-hidden="true">
        ${covered.revealed ? `<span class="peek">${rankText(covered.rank)}${icon(covered.suit)}</span>` : ''}</div>`).join('')}
    ${card ? `<button class="card face ${card.suit} ${eligible ? target ? 'target' : 'match' : 'muted-card'}"
      data-action="card-${index}" ${eligible ? '' : 'disabled'}
      aria-label="${target && eligible ? powers[target].name + ': ' : ''}${cardLabel(card)}. Column ${index + 1}, ${cards.length - 1} covered.${revealed}">
      ${face(card)}</button>` : `<div class="card vacant" aria-label="Empty column ${index + 1}">◇</div>`}
  </div>`
}

function board() {
  const remaining = game.tableau.reduce((total, pile) => total + pile.length, 0)
  return `<section class="panel board" aria-label="Card table">
    <div class="panel-title"><h2>Tableau</h2><span class="table-stats"><span>${remaining} card${remaining === 1 ? '' : 's'} left</span>
      <span class="gold"><span aria-hidden="true">◉</span> <b>${game.gold}</b> gold</span></span></div>
    <div class="tableau" style="--layers:${encounters[game.stage].rows - 1}">${game.tableau.map(stack).join('')}</div>
    <div class="divider" aria-hidden="true">✦</div>
    <div class="play-area">
      <div class="streak"><strong>${game.streak}</strong><span>Streak</span></div>
      <div class="pile"><div class="card face active ${game.active.suit}" role="img" aria-label="Active card: ${cardLabel(game.active)}">${face(game.active)}</div><span>Active card</span></div>
      <div class="pile"><button class="card back stock" data-action="draw" aria-label="Draw, ${game.stock.length} cards left"
        ${game.phase === 'battle' && game.stock.length ? '' : 'disabled'}><span aria-hidden="true">✺</span><b>${game.stock.length}</b></button><span>Draw pile</span></div>
    </div>
    <div class="message"><p id="game-notice" class="notice" role="status">${target ? targetPrompt(target) : game.notice}</p>
      ${target ? '<button data-action="cancel-target">Cancel</button>' : ''}</div>
  </section>`
}

function targetPrompt(suit: TargetPower | 'dex') {
  const instruction = {
    str: 'Choose an exposed card to lower by one rank.',
    int: 'Choose a card with another card behind it to move to the first empty column.',
    wis: 'Choose a stack to reveal the card immediately behind its exposed card.',
    dex: 'Equip: choose another suit icon to give it 1 energy.',
  }
  return instruction[suit]
}

function health() {
  return `<section class="panel health" aria-label="Health">
    <strong>${game.hp}/${maxHp} HP</strong>
      <div class="health-pips" role="meter" aria-label="Health" aria-valuenow="${game.hp}" aria-valuemin="0" aria-valuemax="${maxHp}">
        ${Array.from({ length: maxHp }, (_, i) => `<span class="${i < game.hp ? 'filled' : ''}"></span>`).join('')}</div>
  </section>`
}

function powerDescription(suit: Suit) {
  const power = powers[suit]
  return `<strong>${power.name}</strong><p>${power.detail}</p>
    ${suit === 'dex' ? '' : `<small>Costs ${powerCost} ${power.label} energy.</small>`}`
}

function powerBar() {
  const equipping = target === 'dex'
  return `<section class="panel powers ${equipping ? 'equipping' : ''}" aria-label="Powers">
    <div class="power-list">${suits.map(suit => {
      const power = powers[suit]
      const destination = equipping && suit !== 'dex'
      const label = equipping ? destination ? `Give ${power.label} 1 energy` : 'Cancel Equip' :
        `${power.name}, ${game.energy[suit]} ${power.label} energy`
      return `<div class="power-slot"><button data-action="power-${suit}" class="power ${suit} ${canPower(game, suit) ? 'ready' : ''} ${target === suit ? 'selected' : ''} ${destination ? 'equip-target' : ''}"
        aria-label="${label}" aria-describedby="${equipping ? 'game-notice' : `hint-${suit}`}" aria-expanded="${powerInfo === suit}">
        <span class="power-icon">${icon(suit)}</span><b>${game.energy[suit]}</b>
      </button><div class="power-tooltip" role="tooltip" id="hint-${suit}">${powerDescription(suit)}</div></div>`
    }).join('')}</div>
    ${powerInfo ? `<div class="power-popover" role="group" aria-label="${powers[powerInfo].name}">
      ${powerDescription(powerInfo)}
      <div class="popover-actions">
        <button data-action="close-power">Close</button>
      </div></div>` : ''}
  </section>`
}

function render(focus?: string) {
  app.innerHTML = `<header class="shell page-head">
    <h1>Adventure Solitaire</h1>
    <nav aria-label="Game controls"><button data-action="help">Help</button>
      <button data-action="restart">New run</button></nav>
  </header>
  <main class="shell">${hero()}${health()}${board()}${powerBar()}</main>
  <footer class="shell"><span><kbd>D</kbd> or <kbd>Space</kbd> to draw</span><span>Best streak <b>${game.best}</b></span></footer>`
  if (focus) {
    const buttons = Array.from(app.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const next = buttons.find(button => button.dataset.action === focus) ??
      app.querySelector<HTMLButtonElement>('.target, .match, [data-action="draw"]:not(:disabled)')
    next?.focus({ preventScroll: true })
  }
}

function modal(title: string, html: string, locked = false) {
  dialogs.querySelector('dialog')?.remove()
  const dialog = document.createElement('dialog')
  dialog.setAttribute('aria-labelledby', 'dialog-title')
  dialog.innerHTML = `<h2 id="dialog-title">${title}</h2>${html}`
  dialog.addEventListener('close', () => dialog.remove())
  if (locked) dialog.addEventListener('cancel', event => event.preventDefault())
  dialogs.append(dialog)
  dialog.showModal()
}

function showPhase() {
  if (game.phase === 'clear') {
    modal('Guardian defeated', `<p>Every column cleared. Recover up to 3 HP and continue to ${encounters[game.stage + 1].place}.</p>
      <button class="primary" data-action="advance">Continue</button>`, true)
  }
  if (game.phase === 'victory') {
    modal('The gate is open', `<p>You cleared all three encounters. Your longest streak was ${game.best}.</p>
      <button class="primary" data-action="start">Play again</button>`, true)
  }
  if (game.phase === 'defeat') {
    modal('Run ended', `<p>${game.notice} Your longest streak was ${game.best}.</p>
      <button class="primary" data-action="start">Try again</button>`, true)
  }
}

function update(focus?: string) {
  save()
  render(focus)
  showPhase()
}

function useActiveAction(changed: boolean, focus: string) {
  if (!changed) return
  target = undefined
  powerInfo = undefined
  update(focus)
}

function closePower() {
  if (!powerInfo) return
  const focus = `power-${powerInfo}`
  powerInfo = undefined
  render(focus)
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return
  const button = event.target.closest<HTMLButtonElement>('button[data-action]')
  if (!button || button.disabled) return
  const action = button.dataset.action!
  if (action === 'help') {
    modal('How to play', `<ol>
      <li>Match exposed cards one rank above or below the active card. The loop runs 8, 9, 1/10, 2, 3. Clear all seven columns to win an encounter.</li>
      <li>Matching or drawing a card, including the opening card, earns 1 energy of its suit. Each power spends 2 energy of the matching suit. Equip also spends 1 gold to give another suit 1 energy. Tap that suit’s icon to choose it.</li>
      <li>Tap a suit to activate its power. Choose an exposed card for Grapple, Tactical, or Perceive. Recover heals 1 HP immediately. Dazzle protects your next draw.</li>
      <li>Every draw breaks your streak and triggers the guardian’s attack. You start the run with 10 HP.</li>
      <li>Each match after the fifth earns gold equal to your current streak minus five.</li>
    </ol><button class="primary" data-action="close">Back to game</button>`)
    return
  }
  if (action === 'restart') {
    modal('Start a new run?', '<p>This replaces your saved run.</p><div class="dialog-actions"><button data-action="close">Keep playing</button><button class="primary" data-action="start">Start new run</button></div>')
    return
  }
  if (action === 'close') return button.closest('dialog')?.close()
  if (action === 'close-power') return closePower()
  if (action === 'cancel-target') {
    const lastTarget = target
    target = undefined
    return render(`power-${lastTarget}`)
  }
  if (action === 'start' || action === 'advance') {
    if (action === 'start') game = newGame()
    else if (!advance(game)) return
    dialogs.querySelector('dialog')?.remove()
    target = undefined
    powerInfo = undefined
    return update('draw')
  }
  if (action === 'draw') return useActiveAction(draw(game), action)
  if (action.startsWith('card-')) {
    if (target === 'dex') return
    const column = Number(action.slice(5))
    return useActiveAction(target ? cast(game, target, column) : match(game, column), action)
  }
  if (action.startsWith('power-')) {
    const suit = action.slice(6) as Suit
    if (target === 'dex') {
      if (suit !== 'dex') return useActiveAction(equip(game, suit), action)
      target = undefined
      return render(action)
    }
    if (!canPower(game, suit)) {
      if (powerInfo === suit) return closePower()
      powerInfo = suit
      return render('close-power')
    }
    powerInfo = undefined
    if (suit === 'dex') {
      target = 'dex'
      return render('power-str')
    }
    if (suit === 'con' || suit === 'chr') return useActiveAction(cast(game, suit), action)
    if (suit === 'str' || suit === 'int' || suit === 'wis') {
      target = suit
      render()
      const first = app.querySelector<HTMLButtonElement>('.target')
      first?.focus()
    }
  }
})

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.repeat || dialogs.querySelector('dialog[open]')) return
  if (event.key === 'Escape' && powerInfo) return closePower()
  if (event.key === 'Escape' && target) {
    const focus = `power-${target}`
    target = undefined
    return render(focus)
  }
  if (event.code === 'Space' && event.target instanceof Element && event.target.closest('button')) return
  if ((event.code === 'KeyD' || event.code === 'Space') && !event.ctrlKey && !event.altKey && !event.metaKey && draw(game)) {
    event.preventDefault()
    useActiveAction(true, 'draw')
  }
})

update()

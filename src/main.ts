import './style.css'
import {
  advance, canMatch, canPower, canTarget, cast, columns, draw, encounters, equip, match, maxHp,
  newGame, powers, rankText, suits,
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
    type LegacyFields = 'gold' | 'dazzled' | 'powerCosts'
    const saved = JSON.parse(raw) as Omit<Game, LegacyFields> & Partial<Pick<Game, LegacyFields>>
    if (saved.tableau?.length === columns && encounters[saved.stage] && saved.active && saved.spent && saved.energy) {
      game = {
        ...saved,
        gold: saved.gold ?? 0,
        dazzled: saved.dazzled ?? false,
        powerCosts: saved.powerCosts ?? { str: 2, int: 2, wis: 2, dex: 2, con: 2, chr: 2 },
      }
      game.notice = game.notice.replace(/^Drew .*? energy\. /, '')
        .replace(/^Matched .*? energy\./, 'Matched.')
        .replace(/^(Equip spent \d+ Dex) and 1 gold/, '$1').trim()
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
    <h2>${game.stage + 1}. ${room.name}</h2>
    ${game.phase === 'battle' ? `<div class="intent ${game.dazzled ? 'protected' : ''}">
      <strong>${game.dazzled ? 'Next draw protected' : `-${room.damage} HP per draw`}</strong></div>` : ''}
  </section>`
}

function stack(cards: Card[], index: number) {
  const card = cards.at(-1)
  const coveredCards = cards.slice(0, -1)
  const matching = card && canMatch(game, card)
  const eligible = target === 'dex' ? false : target ? canTarget(game, target, index) : matching
  const revealed = coveredCards.filter(card => card.revealed).reverse().map(cardLabel)
  const revealedLabel = revealed.length ? ` Behind: ${revealed.join(', ')}.` : ''
  return `<div class="stack" style="--depth:${Math.max(0, cards.length - 1)}">
    ${coveredCards.map((covered, depth) =>
      `<div class="card back behind ${covered.revealed ? covered.suit + ' revealed' : ''}" style="--level:${depth}" aria-hidden="true">
        ${covered.revealed ? `<span class="peek">${rankText(covered.rank)}${icon(covered.suit)}</span>` : ''}</div>`).join('')}
    ${card ? `<button class="card face ${card.suit} ${eligible ? target ? 'target' : 'match' : 'muted-card'}"
      data-action="card-${index}" ${eligible ? '' : 'disabled'}
      aria-label="${target && eligible ? powers[target].name + ': ' : ''}${cardLabel(card)}. Column ${index + 1}, ${coveredCards.length} covered.${revealedLabel}">
      ${face(card)}</button>` : `<div class="card vacant" aria-label="Empty column ${index + 1}">◇</div>`}
  </div>`
}

function board() {
  return `<section class="panel board" aria-label="Card table">
    <div class="tableau" style="--layers:${encounters[game.stage].rows - 1}">${game.tableau.map(stack).join('')}</div>
    <div class="play-area">
      ${health()}
      <div class="card face active ${game.active.suit}" role="img" aria-label="Active card: ${cardLabel(game.active)}">${face(game.active)}</div>
      <button class="card back stock" data-action="draw" aria-label="Draw, ${game.stock.length} cards left"
        ${game.phase === 'battle' && game.stock.length ? '' : 'disabled'}><span aria-hidden="true">✺</span><b>${game.stock.length}</b></button>
      <div class="gold-coin" role="img" aria-label="${game.gold} gold">${game.gold}</div>
      <div class="streak">STREAK <b>${game.streak}/${game.best}</b></div>
    </div>
    <div class="message"><p id="game-notice" class="notice" role="status">${target ? targetPrompt(target) : game.notice}</p>
      ${target ? '<button data-action="cancel-target">Cancel</button>' : ''}</div>
  </section>`
}

function targetPrompt(suit: TargetPower | 'dex') {
  const instruction = {
    str: 'Choose an exposed card to remove.',
    dex: 'Equip: choose another suit icon to give it 1 energy.',
  }
  return instruction[suit]
}

function health() {
  return `<div class="health" role="meter" aria-label="HP" aria-valuenow="${game.hp}" aria-valuemin="0" aria-valuemax="${maxHp}">
    <strong>${game.hp}</strong>
  </div>`
}

function powerDescription(suit: Suit) {
  const power = powers[suit]
  return `<strong>${power.name}</strong><p>${power.detail}</p>
    <small>Costs ${game.powerCosts[suit]} ${power.label} energy.</small>`
}

function powerBar() {
  const equipping = target === 'dex'
  return `<section class="panel powers ${equipping ? 'equipping' : ''}" aria-label="Powers">
    <div class="power-list">${suits.map(suit => {
      const power = powers[suit]
      const cost = game.powerCosts[suit]
      const destination = equipping && suit !== 'dex'
      const label = equipping ? destination ? `Give ${power.label} 1 energy` : 'Cancel Equip' :
        `${power.name}, ${game.energy[suit]} of ${cost} ${power.label} energy`
      return `<div class="power-slot"><button data-action="power-${suit}" class="power ${suit} ${canPower(game, suit) ? 'ready' : ''} ${target === suit ? 'selected' : ''} ${destination ? 'equip-target' : ''}"
        aria-label="${label}" aria-describedby="${equipping ? 'game-notice' : `hint-${suit}`}" aria-expanded="${powerInfo === suit}">
        <span class="power-icon">${icon(suit)}</span><span class="power-label">${power.label.toUpperCase()}</span>
        <b class="power-energy">${game.energy[suit]}/${cost}</b>
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
  <main class="shell">${hero()}${board()}${powerBar()}</main>`
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
    modal('Guardian defeated', `<p>Every column cleared. Recover up to 3 HP and face ${encounters[game.stage + 1].name}.</p>
      <button class="primary" data-action="advance">Continue</button>`, true)
  }
  if (game.phase === 'victory') {
    modal('The gate is open', `<p>You cleared ${game.stage + 1} encounters. Your longest streak was ${game.best}.</p>
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
      <li>Matching or drawing a card, including the opening card, earns 1 energy of its suit. Each power button shows the energy you have and the amount it costs. Equip gives another suit 1 energy. Tap that suit’s icon to choose it.</li>
      <li>Tap a suit to activate its power. Choose an exposed card to remove with Strike. Tactical and Perceive activate immediately. Recover heals 1 HP. Dazzle protects your next draw.</li>
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
    if (suit !== 'str') return useActiveAction(cast(game, suit), action)
    target = suit
    render()
    app.querySelector<HTMLButtonElement>('.target')?.focus()
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

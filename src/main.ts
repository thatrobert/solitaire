import './style.css'
import {
  advance, canMatch, canPower, canTarget, cast, columns, draw, drawPile, encounters, equip, match, maxHp,
  newGame, powers, rankText, stayInEncounter, suits,
} from './game.ts'
import type { Card, CardModifier, Game, Joker, Suit, TargetPower } from './game.ts'

const suitPaths: Record<Suit, string> = {
  str: `M17 22v-5c1.4-1.2 3.7-3 4-4.9.3-1.6-.7-2.9-2.3-3.3V6.7
    C18.7 4.8 16.3 4.2 15.2 5.7 15.2 2.5 12 2.2 10.9 5.1 10.7 2.2 7.4 2.3 6.6 5.3
    5.6 3.8 2.8 4.4 2.8 7.1v5.5c0 2.6.9 4.5 2.5 6.2V22z
    M15.2 5.7v1M10.9 5.1v2M6.6 5.3v1.6`,
  int: `M12 5.5C10 2 5.6 2.5 5 5.6 2.6 6.2 1.4 8.6 2.5 10.9
    .5 12.6 1.2 16 3.5 17.2 3.3 20.4 7.3 22.1 9 19.6 10.5 20 12 18.9 12 17.1
    12 18.9 13.5 20 15 19.6 16.7 22.1 20.7 20.4 20.5 17.2
    22.8 16 23.5 12.6 21.5 10.9 22.6 8.6 21.4 6.2 19 5.6 18.4 2.5 14 2 12 5.5Z
    M12 5.5v11.6M5.8 9.4c2 0 3.3 1.4 3.3 3.3m-5.6 4.5c.5-1.3 1.5-2.1 2.8-2.2
    M18.2 9.4c-2 0-3.3 1.4-3.3 3.3m5.6 4.5c-.5-1.3-1.5-2.1-2.8-2.2`,
  wis: `M1 12c2.5-4.4 6.6-7.1 11-7.1s8.5 2.7 11 7.1c-2.5 4.4-6.6 7.1-11 7.1S3.5 16.4 1 12z
    M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z`,
  dex: 'M13.6 1 3 14h8.3l-1 9L21 10h-8.4z',
  con: 'M12 21.5 3.8 13.6C-2.2 7.8 5.7.1 12 6.1c6.3-6 14.2 1.7 8.2 7.5z',
  cha: 'M12 1.3 15.2 8l7.4 1-5.4 5.2 1.3 7.4-6.5-3.5-6.5 3.5 1.3-7.4L1.4 9l7.4-1z',
}

const jokerArt: Record<Joker, { label: string; path: string }> = {
  fool: {
    label: 'Fool',
    path: `M5.5 16c.7-3.1-.2-5.6-2.1-7.7 3.2-.8 5.9.4 8.1 3.1-.5-3.4.6-5.7 3.1-7.2
      -.1 2.8.7 4.8 2.4 6.7 1.3-1.5 2.4-2.3 4-2.3-1.8 2.1-2.5 4.6-2.5 7.4
      M5.5 16h13v3.5c-3.8 1.3-9.2 1.3-13 0z
      M3 7a1.1 1.1 0 1 0 0 2.2A1.1 1.1 0 1 0 3 7z
      M14.8 2.3a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 1 0 0-2.2z
      M21.3 7.3a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 1 0 0-2.2z`,
  },
  door: {
    label: 'Door',
    path: 'M3 22V10a9 9 0 0 1 18 0v12zM6.5 22V10a5.5 5.5 0 0 1 11 0v12M12 4.5V22m3-8h.2',
  },
}

function cardIcon(card: Card) {
  const path = card.joker ? jokerArt[card.joker].path : suitPaths[card.suit]
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`
}

const modifierIcons: Record<CardModifier, { label: string; path: string }> = {
  shield: { label: 'Shield', path: 'M12 2 3 5v6c0 5.5 3.5 9.1 9 11 5.5-1.9 9-5.5 9-11V5z' },
  drop: { label: 'Blood drop', path: 'M12 1C10 5.7 4.5 11.3 4.5 15.5a7.5 7.5 0 0 0 15 0C19.5 11.3 14 5.7 12 1z' },
  bomb: { label: 'Bomb', path: 'M12 7V5h3.2c.5-2.5 2.6-4 5.3-4v2c-1.6 0-2.6.7-3 2H19v3.6c1.9 1.5 3 3.8 3 6.4a8.5 8 0 1 1-10-8z' },
}

const app = document.querySelector<HTMLDivElement>('#app')!
const dialogs = document.querySelector<HTMLDivElement>('#dialogs')!
const saveKey = 'gate-nine-v1'
const legacyEncounterArts = ['sentinel', 'keeper', 'regent', 'wyrm']
let game = newGame()
let target: TargetPower | 'dex' | undefined
let powerInfo: Suit | undefined

try {
  const raw = localStorage.getItem(saveKey)
  if (raw) {
    type LegacyFields = 'gold' | 'dazzled' | 'powerCosts' | 'scenarioDeck'
    const { encounterArt, ...saved } = JSON.parse(raw, (key, value) => {
      if (key === 'suit' && value === 'chr') return 'cha'
      if (key === 'id' && typeof value === 'string' && value.startsWith('chr-')) return `cha-${value.slice(4)}`
      if ((key === 'energy' || key === 'powerCosts') && value?.chr !== undefined) {
        const { chr, ...counts } = value
        return { ...counts, cha: counts.cha ?? chr }
      }
      return value
    }) as Omit<Game, LegacyFields> & Partial<Pick<Game, LegacyFields>> & { encounterArt?: string }
    const savedArt = encounterArt ?? legacyEncounterArts[saved.stage]
    const stage = encounters.findIndex(encounter => encounter.art === savedArt)
    if (saved.tableau?.length === columns && stage >= 0 && saved.active && saved.spent && saved.energy) {
      game = {
        ...saved,
        stage,
        scenarioDeck: saved.scenarioDeck ?? saved.stock.map(card => ({ ...card, id: `scenario-${card.id}` })),
        gold: saved.gold ?? 0,
        dazzled: saved.dazzled ?? false,
        powerCosts: saved.powerCosts ?? { str: 2, int: 2, wis: 2, dex: 2, con: 2, cha: 2 },
      }
      if (encounters[stage].layout === 'ruins') {
        for (const card of game.tableau.flat()) {
          if (card.modifier === 'drop') card.modifier = 'bomb'
        }
      }
      game.notice = game.notice.replace(/^Drew .*? energy\. /, '')
        .replace(/^Matched .*? energy\./, 'Matched.')
        .replace(/^(Equip spent \d+ Dex) and 1 gold/, '$1')
        .replace(/^Tactical moved /, 'Cleave moved ')
        .replace(/\bChr\b/g, 'Cha').trim()
    }
  }
} catch { /* A fresh run remains available without storage. */ }

function save() {
  try {
    localStorage.setItem(saveKey, JSON.stringify({ ...game, encounterArt: encounters[game.stage].art }))
  } catch { /* Storage is optional. */ }
}

function cardLabel(card: Card) {
  return card.joker ? `The ${jokerArt[card.joker].label}` : `${rankText(card.rank)} · ${powers[card.suit].label}`
}

function face(card: Card) {
  if (card.joker) return `<span class="card-symbol">${cardIcon(card)}</span>`
  const modifier = card.modifier
  return `<span class="card-index">${rankText(card.rank)}</span>
    <span class="card-symbol">${cardIcon(card)}</span>
    <span class="card-suit">${powers[card.suit].label}</span>
    ${modifier ? `<svg class="card-modifier ${modifier}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="${modifierIcons[modifier].path}"/></svg>` : ''}`
}

function hero() {
  const room = encounters[game.stage]
  const image = `${import.meta.env.BASE_URL}${room.art}-pixel.png`
  const addsCard = room.layout === 'ruins'
  const protectedDraw = room.damage > 0 && game.dazzled
  const drawNote = addsCard ? '+1 card per draw' : protectedDraw ? 'Next draw damage blocked' : `-${room.damage} HP per draw`
  return `<section class="encounter" style="--scene:url('${image}')" aria-label="Current encounter">
    <h2>${room.name}</h2>
    ${game.phase === 'battle' && (addsCard || room.damage > 0) ? `<div class="intent ${protectedDraw ? 'protected' : ''}">
      <strong>${drawNote}</strong></div>` : ''}
  </section>`
}

function stack(cards: Card[], index: number) {
  const card = cards.at(-1)
  const coveredCards = cards.slice(0, -1)
  const matching = card && canMatch(game, card)
  const eligible = target === 'dex' ? false : target ? canTarget(game, target, index) : matching
  const revealed = coveredCards.filter(card => card.revealed).reverse().map(cardLabel)
  const revealedLabel = revealed.length ? ` Behind: ${revealed.join(', ')}.` : ''
  const modifierLabel = card?.modifier ? ` ${modifierIcons[card.modifier].label}.` : ''
  return `<div class="stack" style="--depth:${Math.max(0, cards.length - 1)}">
    ${coveredCards.map((covered, depth) =>
      `<div class="card back behind ${covered.revealed ? `${covered.joker ? 'joker' : covered.suit} revealed` : ''}" style="--level:${depth}" aria-hidden="true">
        ${covered.revealed ? `<span class="peek">${covered.joker ? '' : rankText(covered.rank)}${cardIcon(covered)}</span>` : ''}</div>`).join('')}
    ${card ? `<button class="card face ${card.joker ? 'joker' : card.suit} ${eligible ? target ? 'target' : 'match' : 'muted-card'}"
      data-action="card-${index}" ${eligible ? '' : 'disabled'}
      aria-label="${target && eligible ? powers[target].name + ': ' : ''}${cardLabel(card)}.${modifierLabel} Column ${index + 1}, ${coveredCards.length} covered.${revealedLabel}">
      ${face(card)}</button>` : `<div class="card vacant" aria-label="Empty column ${index + 1}">◇</div>`}
  </div>`
}

function board() {
  const room = encounters[game.stage]
  const drawLabel = room.layout === 'ruins' ? 'Draw from the player deck' : 'Draw from the guardian deck'
  const cardsLeft = drawPile(game).length
  return `<section class="panel board" aria-label="Card table">
    <div class="tableau" style="--layers:${room.rows - 1}">${game.tableau.map(stack).join('')}</div>
    <div class="play-area">
      ${health()}
      <div class="card face active ${game.active.joker ? 'joker' : game.active.suit}" role="img" aria-label="Active card: ${cardLabel(game.active)}">${face(game.active)}</div>
      <button class="card back stock" data-action="draw" aria-label="${drawLabel}, ${cardsLeft} cards left"
        ${game.phase === 'battle' && cardsLeft ? '' : 'disabled'}><span aria-hidden="true">✺</span><b>${cardsLeft}</b></button>
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
      const energy = game.energy[suit]
      const destination = equipping && suit !== 'dex'
      const label = equipping ? destination ? `Give ${power.label} 1 energy` : 'Cancel Equip' :
        `${power.name}, ${energy} of ${cost} ${power.label} energy`
      const state = `${suit} ${canPower(game, suit) ? 'ready' : ''} ${target === suit ? 'selected' : ''} ${destination ? 'equip-target' : ''}`
      return `<div class="power-slot">
        <button type="button" class="power ${state}" data-action="power-${suit}" aria-label="${label}"
          aria-describedby="${equipping ? 'game-notice' : `hint-${suit}`}" aria-expanded="${powerInfo === suit}">
          <span class="power-label">${power.label.toUpperCase()}</span>
          <b class="power-energy${energy >= 10 ? ' long-count' : ''}">${energy}/${cost}</b>
          <img class="power-title-icon" src="${import.meta.env.BASE_URL}power-icons/power-${suit}.png" width="18" height="18" alt="">
          <span class="power-name">${power.name}</span>
        </button>
        <div class="power-tooltip" role="tooltip" id="hint-${suit}">${powerDescription(suit)}</div>
      </div>`
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
  if (game.phase === 'door') {
    modal('The Door', `<p>You found a hidden door!</p>
      <div class="dialog-actions"><button data-action="stay" autofocus>Stay</button>
      <button class="primary" data-action="advance">Go through it</button></div>`, true)
  }
  if (game.phase === 'clear') {
    const title = encounters[game.stage].layout === 'ruins' ? 'Ancient Ruins cleared' : 'Guardian defeated'
    modal(title, `<p>Every column cleared. Recover up to 3 HP and face ${encounters[game.stage + 1].name}.</p>
      <button class="primary" data-action="advance">Continue</button>`, true)
  }
  if (game.phase === 'victory') {
    modal('The gate is open', `<p>Your longest streak was ${game.best}.</p>
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
      <li>Matching or drawing a suited card, including the opening card, earns 1 energy of its suit. Each power button shows the energy you have and the amount it costs. Equip gives another suit 1 energy. Tap that suit’s icon to choose it.</li>
      <li>Tap a suit to activate its power. Choose an exposed card to remove with Strike. Cleave and Perceive activate immediately. Recover heals 1 HP. Dazzle protects your next draw.</li>
      <li>A shield absorbs the first match or Strike. A blood drop costs 1 HP on a match. Strike removes blood-drop cards safely.</li>
      <li>Each exposed bomb costs 1 HP at the end of every turn. Remove it or cover it to stop the damage. In Ancient Ruins, draws place a card on a random column and leave the active card in place.</li>
      <li>Jokers match any card. The Fool becomes the active card and matches any card next. The Door lets you leave for the next encounter.</li>
      <li>Every draw breaks your streak and can cost HP. You start the run with 10 HP.</li>
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
  if (action === 'start' || action === 'advance' || action === 'stay') {
    if (action === 'start') game = newGame()
    else if (!(action === 'advance' ? advance(game) : stayInEncounter(game))) return
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

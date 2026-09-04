// Units, personas and constants for GRANDIOSE — THE COLUMN.
//
// Everything here is data. No logic, no DOM. The engine imports it; the tests
// import it; the interface will import it. If a number is wrong, it is wrong in
// exactly one place.
//
// CANON. Every unit is from Grandiose: The Rise to Power (S. T. Chalk, 2026).
// `q` is the line shown with the unit and `qv: 1` means it is the author's,
// lifted from the manuscript and trimmed only at its ends or re-cased at its
// start. `nv: 1` means the UNIT was invented for the game even where its line is
// his -- two different questions, and the interface must not blur them. The
// manuscript is NOT in this repository and must not be: the repository is public
// and the novel is his.
//
// ALL TWELVE LINES ARE NOW THE AUTHOR'S, checked word by word against the
// manuscript. Seven of them were marked "written for the game" and were not --
// four were verbatim and had simply never been checked, and three were his words
// stitched, which have been restored to the sentences they came from. The
// failure ran BOTH ways: an early draft gave Varan a line that reads exactly
// like the book and appears in it zero times, and the correction to that
// over-corrected into telling him five of his own sentences were mine.

export const BUILD = 'column-v36';

/* ------------------------------------------------------------- the battlefield */
// Portrait. The armies start at opposite ends of a field deeper than it is wide,
// because that is the shape of the phone this is played on. Distances are in
// field units, not pixels — the renderer scales them and the engine never knows
// what a pixel is.
export const FIELD = { w: 100, d: 140 };

// One tick is a tenth of a second of game time. The resolver is fixed-timestep
// and seeded, so a battle is a pure function of (armyA, armyB, seed) and can be
// replayed exactly. That is the only reason any figure below can be asserted.
export const TICK = 0.1;
export const MAX_TICKS = 3000;          // 5 minutes; a battle this long is a draw

/* -------------------------------------------------------------------- the units */
// THREE WEIGHT CLASSES, per Sam. A card deploys bodies according to its class
// and nothing else, so battlefield population is bounded by construction rather
// than by tuning:
//
//   heavy  1 body    medium  2 bodies    light  3 bodies
//
// `count` is DERIVED from the class and is not a field a card may set, because
// the previous roster let a Crawler Swarm deploy ten and that one number put 171
// bodies on a phone screen by the end of a match.
//
// THESE ARE NOT EQUAL-POWER CARDS, deliberately. The earlier roster tried to put
// every card near the same count^2 x hp x dps; Sam's direction rejects that.
// A heavy is individually formidable, a light is weak per body and earns its
// place through numbers, and the classes are meant to be strategically
// different rather than mathematically identical. Balance comes from counters:
//
//   light swarms overwhelm slow single-target attackers
//   AOE punishes light, because three bodies stand close enough to share a blast
//   heavy hp absorbs AOE efficiently, because a splash hits one body not three
//   damage-over-time ignores armour, so it is what punishes a heavy
//   fast units bypass a frontline and reach ranged and support
//
// Good composition should have several of those running at once, which is why
// the go/no-go now measures MIXED armies rather than single-card ones.
//
// Fields (count is derived; w is the class):
//
//   w      'heavy' | 'medium' | 'light' — decides how many bodies deploy
//   hp     health of each body
//   dmg    damage per attack, before the defender's armour
//   rate   ticks between attacks
//   rng    attack range in field units. <= 4 is melee for targeting purposes
//   spd    field units per tick
//   arm    flat damage subtracted from every incoming hit, to a floor of 1
//   splash radius of area damage around the target
//   tgt    'near' | 'big' | 'back'  — who it shoots, among what it can reach
//   move   'line' (default) | 'seek'. A LINE card advances with the rest of its
//          army and holds formation; a SEEK card leaves the line and crosses for
//          whatever `tgt` names. Three cards seek, and the book says so of each:
//          the Karkinos "hauled itself over the wall's crown", the crawlers move
//          "up the walls and along the ceiling, moving in all planes at once",
//          and the fireship's whole purpose is to reach the enemy's centre.
//          One global movement rule was tried and it deleted those three units:
//          the counter graph went 3 of 3 to 0 of 3 and all three fell out of
//          every cycle, because their identity is WHERE THEY WALK.
//   defl   fraction of RANGED damage refused. The Kraken rule: a shield tuned
//          for weapons fire that slow things pass straight through
//   dot    damage per tick applied for `dotT` ticks after a hit
//   aura   damage per tick to every enemy within `auraR`, needing no attack
//   boom   { r, d } detonation on death
//
// These numbers are a FIRST GUESS, chosen to make the counter-graph expressible
// rather than balanced. test/matchup.mjs exists to tell us they are wrong.
export const WEIGHT = { heavy: 1, medium: 2, light: 3 };

/* ------------------------------------------------------------------ upgrades */
// Sam's design point 3: reinforcement cards AND upgrade cards. A reinforcement
// pick adds a card, and therefore bodies. An UPGRADE pick adds nothing to the
// field and makes what is already standing on it stronger.
//
// That is the answer to the crowd. A match currently ends with about 107 bodies
// on a 393pt-wide screen, and no amount of drawing fixes a field that dense; the
// upgrade pick is the only lever that reduces it without touching the round
// structure or the square law, because a pick spent on an upgrade is a pick not
// spent on three more crawlers.
//
// An upgrade is offered ONLY for a unit type the army already fields. An upgrade
// to nothing is a wasted pick and the player cannot be asked to guess whether it
// applies. Each level multiplies health and every damage channel; it never
// touches `count`, armour, range or speed, so an upgrade makes a card more of
// itself and cannot turn it into a different card.
//
// These three numbers are a first guess. test/match.mjs measures what they do to
// army size and to how often the draft decides the battle.
export const UPGRADE = {
  step: 0.35,     // +35% health and damage per level
  max: 3,         // levels above base
  chance: 0.5     // how often an eligible offered card arrives as an upgrade
};

/* ------------------------------------------------------------------- merging */
// Sam's note 27, and design point 4 -- specified in the very first design and
// unbuilt for the whole of this project's life.
//
// Two copies of a card become ONE carrying both, so the bodies halve and each is
// worth far more. That is the axis the game has been short of: nine grounds and
// five mechanisms were measured and only REACH ever worked, because everything
// tried scaled an advantage that already existed. Merging asks a different
// question -- fewer and tougher against more and softer -- which is the game's
// own stated counter mechanism, since AOE punishes light cards precisely because
// three bodies stand close enough to share a blast.
//
// THE DOSE IS MEASURED AND IT IS NOT DOUBLE, which is what Sam specified and
// what his own condition ruled out. At exactly 2.0x a merge is the WORST thing a
// pick can buy on all twelve cards -- upgrade 64.7%, add a third 62.9%, merge
// 55.4% -- and the reason is arithmetic: an upgrade leaves 2 cards at 1.35x,
// which is 2.7 cards' worth, while a merge at double leaves 1 card holding 2.0.
// Least strength AND fewest bodies recommends nothing.
//
// Cards where merging beats BOTH alternatives, 300 pairings a card:
//
//   2.0x  0 of 12      2.4x  5 of 12      2.7x  10 of 12      3.2x  12 of 12
//
// 2.4x is chosen because a pick that is always right is a tax on not taking it.
// At this dose merging is right on five cards and wrong on the rest -- wrong on
// the Fireship, whose value is detonations per death and who therefore wants
// bodies, and on the Amabie, which wants more shots rather than bigger ones.
export const MERGE = {
  step: 2.4,      // what one merged card carries, against one unmerged copy
  chance: 0.4     // how often an eligible offered card arrives as a merge
};

export const UNITS = [
  // ---- heavy: one body, individually formidable -------------------------
  { id: 'walker', n: 'Walker', w: 'heavy',
    hp: 820, dmg: 75, rate: 26, rng: 20, spd: 0.35, arm: 4, splash: 8, tgt: 'near',
    q: 'The walker was four stories of articulated war machine.', qv: 1 },

  { id: 'brute', n: 'Brute', w: 'heavy',
    hp: 980, dmg: 70, rate: 18, rng: 4, spd: 0.62, arm: 3, tgt: 'near',
    q: 'It went through a Union squad the way weather goes through paper.', qv: 1 },

  { id: 'ultra', n: 'Ultra Armor', w: 'heavy',
    hp: 780, dmg: 72, rate: 11, rng: 5, spd: 0.62, arm: 12, tgt: 'near',
    q: 'Every round the survivors put on them skidded off the black plate like rain off glass.', qv: 1 },

  { id: 'amabie', n: 'Amabie', w: 'heavy',
    hp: 300, dmg: 130, rate: 32, rng: 62, spd: 0.28, splash: 16, tgt: 'big',
    q: 'A walking artillery piece the size of a customs house.', qv: 1 },

  // ---- medium: two bodies, specialised roles -----------------------------
  // SIX legs. The manuscript says both -- "waiting on its four vast legs" of one
  // machine, Samuel's, and "crab-bodied urban mechs ... on six legs apiece,
  // railguns folded along their backs" of the squads. A previous session read
  // the first, called six an invention, and wrote that down; the card is the
  // TYPE, so it is six. It breaches by climbing -- over the wall rather than
  // through the gate -- which is why it seeks.
  { id: 'karkinos', n: 'Karkinos', w: 'medium',
    hp: 380, dmg: 40, rate: 10, rng: 6, spd: 1.6, tgt: 'back', move: 'seek',
    q: 'Front legs punching anchor-deep into the plate and stone, rear legs following.', qv: 1 },

  // INVENTED. "Deflector" appears in the manuscript zero times -- the name and
  // the unit are written for the game. Only its line is the author's, and that
  // line is the Kraken's shield, which is where the property comes from.
  { id: 'deflector', n: 'Deflector', w: 'medium',
    hp: 420, dmg: 26, rate: 12, rng: 4, spd: 0.72, defl: 0.85, tgt: 'near',
    q: 'Its shields are tuned for weapons fire. Pods fall through.', qv: 1, nv: 1 },

  { id: 'volt', n: 'Volt Battery', w: 'medium',
    hp: 330, dmg: 0, rate: 999, rng: 0, spd: 0.78, aura: 1.5, auraR: 18, tgt: 'near',
    q: 'The volt round’s enormous older sibling, charged projectiles that didn’t need to hit to hurt.', qv: 1 },

  // Damage over time is not reduced by armour, which is what makes this the
  // answer to a heavy rather than one more ranged attacker.
  { id: 'acid', n: 'Acid Thrower', w: 'medium',
    hp: 230, dmg: 12, rate: 14, rng: 30, spd: 0.65, dot: 6, dotT: 60, tgt: 'big',
    q: 'The stuff clung to shields and ate through, sheeted across hulls and kept eating.', qv: 1 },

  // ---- light: three bodies, strong in numbers, soft to AOE ---------------
  { id: 'line', n: 'Line Infantry', w: 'light',
    hp: 215, dmg: 33, rate: 8, rng: 3, spd: 1.05, tgt: 'near',
    q: 'You’re soldiers of the Union. The fleet has not fired. Until it fires, you check your sectors.', qv: 1 },

  { id: 'swarm', n: 'Crawler Swarm', w: 'light',
    hp: 155, dmg: 27, rate: 4, rng: 2, spd: 2.1, tgt: 'big', move: 'seek',
    q: 'They hit the crowded street the way current hits a shoal.', qv: 1 },

  { id: 'neurite', n: 'Neurite', w: 'light',
    hp: 180, dmg: 31, rate: 9, rng: 32, spd: 0.85, tgt: 'near',
    q: 'They aren’t animals. Whatever is behind their eyes was aiming.', qv: 1 },

  { id: 'fireship', n: 'Fireship', w: 'light',
    hp: 175, dmg: 4, rate: 20, rng: 3, spd: 1.15, tgt: 'near', move: 'seek', boom: { r: 15, d: 120 },
    q: 'Set autopilot, best speed, into the swarm’s central mass.', qv: 1 }
];

/* ------------------------------------------------------------ the specials */
// THREE CARDS THE DRAFT NEVER OFFERS. One a weight class, bought at the market
// and one of each a side, and they are the answer to two problems at once:
//
//   · the economy had no sink. Income is about 102 credits a match with nothing
//     over 44 to spend it on, so credits piled up. A special costs more than one
//     market visit, which makes saving across visits a decision for the first time.
//   · the roster had no growth path that did not cost the counter graph. Adding
//     cards to the DRAFT pool would re-derive all of it -- 86% of pairings
//     decisive, 126 cycles, every unit the best answer to something. Shop-only
//     cards touch none of it, because a single-type pairing never sees them.
//
// `sp` marks a card as special: `offer()` refuses to deal it, the market sells
// it, and `count` is its own rather than its class's, because a special is
// allowed to break the rule that keeps the DRAFT honest.
//
// EACH ONE MUST STILL LOSE TO SOMETHING. A special that answers everything is
// not a prize, it is the end of the game.
//
// THE NUMBERS ARE MEASURED, not chosen. The question a special has to pass is
// the one a player actually faces at the market: this, or the ordinary cards the
// same credits would buy, added to the column I already have? At the first guess
// all three LOST that comparison -- 19-28% -- so they were worth having and
// strictly worse value, which is a trap rather than a prize. Scaled until each
// sits near an even choice: the Kraken and the Purifier needed half again, and
// the Adarnas needed three times, because six light bodies against three cards
// is the square law and more bodies could not fix it -- twenty-four of them
// still lost.
//
// All three are the author's, checked against the manuscript by name and by
// description. "Lancer" was checked too and is a person.
export const SPECIALS = [
  // "limbs, each one longer than a cruiser, moving with a fluid, boneless
  // wrongness" -- it took a battleship "and squeezed". Its shields are the
  // Deflector's rule, so the real thing outranking the copy is right. Answered
  // by acid, because damage over time ignores armour and a shield tuned for
  // weapons fire does not stop it.
  { id: 'kraken', n: 'Kraken', w: 'heavy', sp: 'heavy', cost: 90, count: 1,
    hp: 2400, dmg: 285, rate: 22, rng: 5, spd: 0.5, arm: 6, defl: 0.6, tgt: 'near',
    q: 'The volleys broke against its shields and armor like weather.', qv: 1 },

  // "They burned the orbitals, then the cities, then the croplands, and then
  // they stayed in orbit an extra day to burn the forests." Area denial as a
  // doctrine: long reach, a wide blast, and ground that keeps burning. Answered
  // by anything that crosses the field, because it is slow and thin.
  { id: 'purifier', n: 'Purifier', w: 'medium', sp: 'medium', cost: 75, count: 1,
    hp: 510, dmg: 135, rate: 30, rng: 48, spd: 0.3, splash: 20, dot: 4, dotT: 40, tgt: 'big',
    q: 'Their doctrine held that the life itself was the contamination.', qv: 1 },

  // "The Adarnas dropped through smoke the whole way down ... a platoon at his
  // back." A platoon delivered at the line of contact rather than marched to it,
  // which is what `drop` means. Answered by splash: six bodies standing together
  // is exactly what area damage is for.
  { id: 'adarnas', n: 'Adarnas', w: 'light', sp: 'light', cost: 70, count: 6, drop: 1,
    hp: 570, dmg: 90, rate: 7, rng: 3, spd: 1.2, tgt: 'near',
    q: 'The Adarnas dropped through smoke the whole way down.', qv: 1 }
];

UNITS.push(...SPECIALS);

// Derived for a draft card, its own for a special.
UNITS.forEach(u => { if (!u.sp) u.count = WEIGHT[u.w]; });

// The draft pool: everything the offer may deal. One place, so a special can
// never arrive as a free pick.
export const DRAFT = UNITS.filter(u => !u.sp);

export const BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));

/* ------------------------------------------------------------------- the match */
// Sam's structure, taken as given:
//   five lives; three picks a round, each one a blind simultaneous commitment
//   revealed to both sides before the next; the round ends when one army is
//   wiped out; the loser drops a life, everything resets to starting positions,
//   and the loser opens the next round with one extra pick.
export const RULES = {
  lives: 5,
  picksPerRound: 3,
  loserBonusPicks: 1,
  offer: 3,             // cards shown per pick
  maxRounds: 20         // a match is 5-9 rounds; this only catches a runaway
};

/* -------------------------------------------------------------------- the market */
// Stage one of Sam's survival loop, built inside the match that already exists
// rather than as a new mode. Two rules and one screen:
//
//   · a side earns 1 for every BODY it still has standing when a round ends,
//     and the winner also takes a flat purse
//   · every third round a market opens and both sides spend
//
// THE SURVIVOR MONEY IS THE POINT, and it is his. A win with one survivor and a
// win with twenty are currently identical -- the game does not reward winning
// cleanly at all, anywhere. This is the only rule that does.
//
// Money for KILLS was proposed and cut: a side is already paid for winning, and
// paying per kill pays you for losing rounds in which you did damage, which is
// the extra-pick comeback a second time. Two sources, not three, so income is
// predictable enough for a player to plan and for a sweep to tune.
//
// THE ECONOMY IS IN THE ENGINE AND BOTH SIDES USE IT. A shop that only the
// interface knew about could not be swept, and the first question it has to
// answer is whether paying the winner turns the match into a snowball --
// alternation sits at 55% and match.mjs measures exactly that.
//
// The market sells what the draft CANNOT: a named card instead of a random
// offer, a level on a card you choose, a life, a wider offer next round. Money
// buying certainty is what makes a drafting game feel like progress; a shop
// selling +10% damage sells nothing.
//
// Every number here is a first guess.
// Credits, ₡ — the same coin as Grandiose, because it is the same universe and
// two names for one currency across two games in one book is two things to
// learn for no reason.
export const COIN = '₡';

export const SHOP = {
  every: 3,        // rounds between markets
  // BOTH sides take the purse and only the winner is paid for survivors, which
  // is Sam's balancing call. Paying the purse to the winner alone pushed
  // round-to-round alternation from 55% to 62% against a 65% ceiling: winning
  // bought the money that bought the next win. The flat half is now income and
  // the survivor half is the reward, so a bad round still leaves you able to buy.
  purse: 10,       // to BOTH sides at a round's end
  // PRICED AGAINST THE INCOME, and re-priced when the income changed. Paying the
  // purse to both sides took total payout across a match from ~125 to ~218, so
  // the same prices were suddenly half price: army sizes went from 38 to 44
  // bodies a side and the field got denser, which is the one thing the counters
  // cannot afford. Multiplied by the change in income rather than guessed.
  card: 21,        // any one card in the roster, chosen
  upgrade: 18,     // one level on a card you name
  life: 44,
  offer: 14        // next round you are offered four cards instead of three
};

/* ------------------------------------------------- kit, sabotage and orders */
// Three more things the market sells, and they are three different SHAPES of
// decision rather than three more ways to be stronger:
//
//   EQUIPMENT is permanent and army-wide. It attaches to a ROLE rather than to a
//   card, so it rewards a column that has leaned one way -- and every target is
//   derived from stats the resolver already reads, so no card has to be told
//   what it is.
//
//   SABOTAGE is the only thing you can buy that makes THEM weaker. Its value
//   depends on their army rather than yours, which means it is the one purchase
//   that makes you look at the other half of the field -- and you can, because
//   every counter is named and drawn.
//
//   AN ORDER lasts one round. It is what a spell would have been: Sam asked
//   about spells and the answer was no, because a cast during a battle is either
//   a timed input -- which ends the battle being a pure function of two armies
//   and a seed, and with it every figure in this project -- or it is
//   pre-committed, in which case it is this.
// PRICED ON WHAT THEY MEASURED AS WORTH, against the ordinary cards the same
// credits buy, added to the same column. And with one asymmetry stated rather
// than assumed: KIT CARRIES BETWEEN MATCHES AND CARDS DO NOT, because the army
// is redrafted every match. A single-match measurement is therefore a floor for
// a piece of kit and exact for an order, which lasts a round.
// THESE LAST THE MATCH, NOT THE RUN, and the copy said otherwise in three places
// for as long as kit has existed. Kit is a token in the army list (`eq:plate`),
// and a run redrafts the army from nothing every match -- `playRun` carries
// credits, lives and boosters forward and nothing else, which is what the run
// screen itself tells the player. So the button in the shop was promising
// something the engine does not do, on a purchase the player pays 30 for before
// they can find out. The price is unaffected: it was measured over a single
// match, which makes it exact here rather than the floor the pricing note called
// it. WHETHER kit should carry is a live design question and Sam's; that it must
// not SAY it carries while it does not is neither.
export const KIT = [
  { id: 'plate',  n: 'Ablative plate', cost: 30,
    d: 'Every heavy of yours takes 10 less from each hit, for the rest of this match.' },
  { id: 'sights', n: 'Range-finders',  cost: 30,
    d: 'Everything of yours that shoots past 6 reaches 8 further, for the rest of this match.' },
  { id: 'drill',  n: 'Field drill',    cost: 30,
    d: 'Every light body of yours carries 70 more health, for the rest of this match.' }
];
// `left` is the FRACTION OF HEALTH THE TARGET KEEPS, not the fraction taken off,
// and it is 0.4 rather than 0.5. It was called `half` while holding 0.4 -- nothing
// read the name so nothing was wrong on screen (the interface derives the figure
// it prints from this number), but a constant whose name disagrees with its value
// is a trap laid for whoever tunes it next.
export const SABOTAGE = { cost: 26, left: 0.4 };
export const ORDERS = [
  { id: 'march',  n: 'Forced march',  cost: 11,
    d: 'Next round only: your column advances at double pace and your seekers run harder.' },
  { id: 'volley', n: 'Sustained fire', cost: 20,
    d: 'Next round only: everything of yours that shoots past 6 fires a quarter faster.' }
];
export const BY_KIT = Object.fromEntries(KIT.map(k => [k.id, k]));
export const BY_ORDER = Object.fromEntries(ORDERS.map(k => [k.id, k]));

/* ---------------------------------------------------------------------- a run */
// Stage two. A run is match after match: the army is redrafted every time,
// because the draft is the game and a carried army makes match two a formality,
// and the CREDITS carry, because saving for something is a decision.
//
// The opponent ramps with every match survived — a head start in credits, and an
// extra pick a round every few matches. It is stated on the screen before each
// match rather than hidden, so a loss is legible.
export const RUN = {
  ramp: 18,        // credits the opponent starts with, per match already survived
  pickEvery: 3,    // matches between the opponent gaining an extra pick each round
  // THREE OFFERED, AND YOU MUST BEAT ALL NINE -- Sam's note 26. The run was a
  // fixed sequence; it is a route now, chosen three at a time out of whoever is
  // left. Shuffling the whole ladder was measured first and halved the run (1.81
  // matches to 0.96, a third of runs ending at the first match) because the order
  // is the difficulty curve and a shuffle can open on the Purifiers. Choosing
  // keeps the curve in the player's hands instead of taking it away: order is
  // worth a factor of ten -- easiest-first 1.81 against hardest-first 0.18 --
  // which makes the route the largest single decision in the game.
  //
  // FINISHING MEANS ALL NINE, and it is meant to be nearly out of reach: the best
  // seat in the harness has reached 8. That is Sam's call and it is the book's --
  // the Neurex do not negotiate, do not tire and do not stop, so a run ends in
  // how far you got rather than in a victory screen.
  offeredOpponents: 3,
  // NINE OPPONENTS, six factions, in rising order of what a floor player scores
  // against them. It was five; Sam's note 18 added four and the run got longer
  // with them, which lands on top of note 19 rather than beside it.
  // MEASURED, not guessed. Floor-seat win rate against each: Vex 88, Neurex 88,
  // Overseer 85, Hale 81, Leader 78, Harlow 43, Varan 28, Vale 21, Purifiers 1 --
  // and against the `ace` seat the tail reads Harlow 84, Varan 60, Vale 56,
  // Purifiers 24. So the run climbs for both seats, and for the first time it
  // ENDS on something a competent player loses to three times in four.
  order: ['vex', 'neurex', 'overseer', 'hale', 'leader', 'harlow', 'varan', 'vale', 'purifier'],
  // LIVES CARRY AND ONLY THE MARKET SELLS THEM. Sam's rule, and it is what turns
  // credits into a real decision: every purse is a choice between a stronger
  // column now and staying alive to draft another one. The OPPONENT resets to
  // full every match, because they are a new opponent -- you are the one running
  // the gauntlet, and a wounded opponent carried forward would make every match
  // after the first a formality.
  carryLives: true,
  offered: 3       // boosters shown after a match survived
};

/* ------------------------------------------------------------------ boosters */
// Stage three. After a match survived you choose one of three; the opponent
// takes one at random. Same count, and the asymmetry is the CHOICE.
//
// RE-CUT TWICE, and the second cut is the one that mattered.
//
// The first pool was economy -- more credits, cheaper shelves, double salvage --
// and only "a fourth pick" moved a run at all. Re-measured after the specials,
// the kit and the rewritten shopper had tripled the economy, it came out the
// same. So the pool went draft-shaped: five boosters that changed what you were
// offered, what a pick was worth, or how many you got.
//
// THREE OF THOSE FIVE THEN MEASURED AS NOTHING, once the measurement itself was
// fixed. The arm had been "prefer X, take something ELSE when X is not offered",
// so every arm was collecting real boosters and beat a do-nothing control
// whatever X was -- a booster id the engine does not implement scored +0.58 in
// it. Isolated properly, over 300 runs an arm: Veterans +0.92 matches, a fourth
// pick +0.44, and Standing muster, Requisition and Wider muster at +0.09, +0.09
// and +0.05, none of them separable from noise.
//
// WHAT SURVIVED SAYS WHAT THE GAME IS. The two that worked change how many picks
// you get and what a pick is worth. The three that did not change what you are
// OFFERED and what the market CHARGES -- and being shown five cards instead of
// three is worth a twentieth of a match, which says the third card was never the
// binding constraint. Economy has now measured dead on this axis three separate
// times and the offer once, so neither is represented here any more.
//
// THE REPLACEMENTS WERE MEASURED THE SAME WAY AND THREE MORE DIED. Reserves (two
// picks to open a match) +0.06 at 1.2 sigma. Field surgeons (a life back each
// match) +0.06 at 1.2 sigma. Attrition (the opponent's ramp halved, designed
// deliberately to GROW with the run) +0.06 at 1.1 sigma. Eight boosters have now
// been measured against a do-nothing control across three separate designs, and
// they line up in one table:
//
//   Veterans        every card, from the moment you take it        +0.86
//   A fourth pick   +1 pick a round, about +7 a match              +0.42
//   The Vanguard    +1 pick a round LOST, about +3.5 a match       +0.13
//   the other five  offer-shaped, economy-shaped, or a fixed few   +0.05 to +0.09
//
// THE CONSTRAINT IS THE RUN, NOT THE POOL. A run survives 1.44 matches from this
// seat, and the first booster only arrives after match one -- so a booster gets
// one or two matches to matter. Anything that scales with run length is worth
// nothing because there is no run length; that is why Attrition, built for
// exactly that, measured the same as the fillers it replaced. Only a booster
// that acts at once and on EVERYTHING is worth much, and Veterans is the only
// one of those anybody has thought of.
//
// SO: THREE, and not a fourth invented to round the number up. Three offered
// after each match means the whole pool is on screen and the decision is the
// ORDER -- Veterans first compounds hardest, the fourth pick pays sooner -- which
// is a smaller decision than intended and an honest one. Whether the booster slot
// should carry more than that is a question about how long a run is, and that is
// Sam's.
//
// The Vanguard is the novel's own argument as a rule. The Leader spends eleven
// thousand crew to take the Dominion's undefended core and tells the council the
// sacrifice purchased the war; the extra pick for losing a round already says
// that, and this says it twice.
// SAM'S NOTE 17. `A fourth pick` is OUT and `Wider muster` is back in its place,
// which is his call and his reasoning: four different cards a round is decisive
// against somebody who does not have it, while choosing better out of five is
// tactical rather than simply more.
//
// AND THE POOL IS BIGGER, because three offered out of three is not a decision.
// Everything below is measured on the `ace` seat rather than on the floor player
// every earlier booster table used -- which matters more than it sounds. The
// finding that killed five of them was "a run survives 1.44 matches, so a booster
// gets one or two matches to matter, and anything that scales with run length is
// worth nothing because there is no run length". A competent seat survives 3.55.
// The premise of that finding is gone, so the boosters it killed are worth asking
// about again rather than assumed dead.
/** WHAT THE THREE BATTLE-SIDE BOOSTERS ARE WORTH, in one place, because the
 *  resolver reads them and two sweeps price them and a number written twice
 *  disagrees. Every one of these was measured at two doses before it shipped --
 *  three separate things tonight turned out to be the right idea at the wrong
 *  size, so building one size and calling the idea dead is no longer good
 *  enough. */
export const BATTLE = {
  // EVERY ONE OF THESE IS THE MEASURED DOSE, not the obvious one, and the two
  // that needed raising are the two whose obvious dose was Sam's own words.
  //
  //   absorbed   one body a battle  +0.00 (0.1σ)   five  +0.27 (2.8σ)
  //   repair     0.9 a tick         +0.03 (0.4σ)   3.5   +0.23 (2.6σ)
  //   pods       blast 12 / dmg 60  +0.42 (4.5σ)   16/110 +0.72 (7.0σ), too big
  //
  // His note was "once per round a random unit revives", and once a battle
  // measures exactly nothing -- the fourth time tonight that a good idea was the
  // wrong size rather than the wrong idea. Five is what puts it beside the rest
  // of the pool instead of below it.
  repair:   3.5,                 // health a tick, to a body under half, both sides
  // ABSORBED IS A CAPTURE NOW, not a revive -- Sam's note 30. It takes one of
  // THEIR bodies when it falls and stands it up on your side, whole. The novel
  // is unambiguous about which of the two the Neurex do: the pod chamber is
  // storage -- "alive, preserved, filed" -- and nothing in that room gets up,
  // while the passage that describes a taken thing ACTING is the city being
  // digested: "It was not destruction... This was conversion." The booster was
  // named for consumption and built as first aid.
  //
  // A capture is roughly DOUBLE the swing of a revive -- one body off them and
  // one onto you -- and settled.mjs already priced that: the loser winning
  // outright goes 5% at +1 body to 23% at +2. So the count below is measured
  // downward from the revive's five rather than inherited from it.
  absorbed: 5,                   // bodies taken off them a battle, whole
  // WHERE A TAKEN BODY STANDS UP, and it is the difference between the booster
  // working and being dead on arrival: left where it fell it is alone inside
  // their formation and may not swing once. Sam's lean was home and both arms
  // were measured. Read ONCE at the top of resolve() so a sweep can set it
  // between arms without any battle reading a value that moved under it.
  captureHome: true,             // true: it walks back to your line. false: it stands where it fell
  // HALF A FIRESHIP'S, DERIVED. It was 60 beside a Fireship carrying 120, which
  // is the same figure written twice and agreeing by luck -- and the dose is the
  // thing most likely to move. Sam's note 28. The RADIUS stays its own number and
  // deliberately smaller: a booster that matched the specialist's reach as well as
  // its rule would leave the card with nothing of its own.
  pods:     { r: 12, d: BY_ID.fireship.boom.d / 2 }
};

export const BOOSTS = [
  { id: 'compact',  n: 'The Compact',    d: 'One card of your column marches into the next match, at the level it reached.' },
  { id: 'surgeons', n: 'Field surgeons', d: 'The first life you lose in each match is given back.' },
  { id: 'vanguard', n: 'The Vanguard',   d: 'A round you lose buys two picks, not one.' },
  // BACK, at full strength, and the reason is Sam's rather than a re-measurement:
  // it was cut for being the one prize in a pool of five you saw most of every
  // match. A random three of eight changes that arithmetic -- a strong booster
  // you are only sometimes offered is exciting rather than mandatory.
  { id: 'veterans', n: 'Veterans',       d: 'Every card you draft arrives already upgraded once.' },
  // REPLACES WIDER MUSTER, which measured dead four separate times on two seats
  // (+0.08, -0.15, -0.38, +0.03). More cards offered does not help when the
  // problem is which cards win; this is the other axis -- not more, but chosen.
  // AN EXTRA CARD, not a substituted pick -- Sam's replacement, and the old text
  // described the old booster exactly while the engine had stopped doing it.
  { id: 'ledger',   n: 'The Ledger',     d: 'One card of your choosing joins your column before each match, already upgraded once and on top of every pick you are owed.' },
  // THE THREE BATTLE-SIDE ONES. They are worth trying because settled.mjs
  // falsified the reason they were thought impossible: one extra body from the
  // first tick rescues 44% of the pairings that were "decided", so there is
  // room in a battle. All three are PERSISTENT AND EVERYWHERE, which is what
  // the old revive was not -- it acted once, at a random place and time.
  // THE NUMBER IS READ, NOT TYPED. It said "Five" beside a constant that says 5,
  // which is the same figure written twice in one file -- and the dose is the
  // thing most likely to move, so the copy is the half that would have gone
  // stale. The card is a capture now: their body, not yours back.
  { id: 'absorbed', n: 'Absorbed',       d: `Their bodies are taken as they fall — ${BATTLE.absorbed} a battle, each standing up whole on your line to fight for you.` },
  { id: 'repair',   n: 'Field repair',   d: 'Your wounded bodies mend a little every moment, up to half their health.' },
  { id: 'pods',     n: 'Escape pods',    d: 'Every body of yours is rigged: it detonates where it falls.' }
];
export const BY_BOOST = Object.fromEntries(BOOSTS.map(b => [b.id, b]));

/* ----------------------------------------------------------------- the personas */
// The personality IS the drafting policy. Voice lines can come later; a persona
// that only talks is decoration. Each `pick` receives the offered cards and the
// board so far and returns an index.
//
// Named for the book's own auditors and spenders. The descriptions are written
// for the game, not quoted, except where marked.
// MAPS. Sam's note 18, and cosmetic for now BY HIS INSTRUCTION -- ground only.
// Nothing here is read by the resolver, so not one figure in this folder is
// re-derived by any of it, which is exactly why it is the right thing to do
// first: nine of them can be looked at on a phone before anyone decides which
// want teeth.
//
// EVERY ONE IS A PLACE IN THE BOOK, and `q` is the sentence it is drawn from,
// marked `qv` like a unit's line. The roster already separates the author's words
// from mine on every card; a map is no different, and there are nine of them.
/* ------------------------------------------------------------------ terrain */
// HIS NOTE 20. The maps were cosmetic and that was the point; this is the first
// thing that makes one mean something, and it is the answer he has been holding
// for the composition red since it first went red.
//
// It is worth building now because of what settled.mjs measured: a battle-side
// effect the size of one card of nine changes a third of the pairings that were
// "decided". Before that measurement the project's own reasoning predicted
// terrain to be dead along with everything else that happens inside a battle.
//
// COVER PROTECTS WHOEVER IS STANDING IN IT, rather than blocking a line between
// two points. Both readings of "cover that blocks range" are buildable; this one
// is chosen because it is POSITIONAL -- it rewards a composition for being
// somewhere, instead of penalising every ranged card everywhere, which is what
// fog would do and is nearer a nerf than a change of play style.
//
// The band sits across the middle of the field, which is where the two lines
// meet: side 0 deploys from y=10 and side 1 from y=130, so both advance into it.
// A body inside it refuses `cut` of the damage from any attacker further away
// than `beyond`. Melee is untouched by construction -- the whole point is that
// closing with something in cover is how you answer it.
//
// Terrain is FIXED PER MAP and SHOWN BEFORE THE DRAFT, both Sam's decisions. A
// map is a place and a place does not rearrange itself between rounds; and a
// board you cannot see before you commit is a coin flip rather than a decision.
export const TERRAIN = {
  // FIVE MECHANISMS, NINE GROUNDS. Sam's decision is that every map carries its
  // own feature, so the variety lives across a run rather than inside one board
  // -- which is what the round-one measurement said terrain actually does: cover
  // did not flatten the pool, it changed who was at the top of it. Nine boards
  // each with a different best answer is that finding used on purpose.
  //
  // Where two maps share a mechanism they do not share its numbers or its
  // placement, and that is stated rather than hidden: a thin band across the
  // middle and a band covering half the field are different battles.
  //
  // `says` is the sentence the chooser prints before the first pick. It is here,
  // beside the numbers it describes, because interface copy that lives away from
  // its figures goes stale in meaning while its digits stay right -- an upkeep
  // bill in this repository once quoted one vassal's cost for the whole bench.

  // --- cover: refuses fire from a distance. Closing with it is the answer. ---
  // --- choke: ground narrower than the army crossing it. Packs bodies. ---
  // THE MANUSCRIPT'S, and the most specific battlefield in the novel: the line
  // has to come up the cut because it is the only grade the walkers can climb,
  // and it bunches as the grade forces it together. An earlier pass read "cuts"
  // as cover and built shelter where the book wrote a funnel.
  // TWO PROPERTIES OF ONE PLACE rather than two mechanisms bolted together: a
  // terrace cut is a narrow defile with high sides, so nothing shoots far in it
  // and its walls shelter you from fire off the plain above. Both read off the
  // geography, and together they measure 4.0% formalities against a flat 12.3%
  // -- the best ground in the game, tied with the tribute ship.
  //
  // A CHOKE WAS BUILT FIRST AND MEASURED WORSE THAN A FLAT FIELD, in four
  // variants. See the document: it is the one place where the most faithful
  // reading of the manuscript made the worst game, and it is recorded rather
  // than quietly dropped.
  cuts:    { n: 'The terrace cut', art: 'defile', what: 'the cut walls',
             cap: 24, from: 58, to: 82, beyond: 12, cut: 0.45 },
  // "the great crossroads, the market of markets" -- so a market, not a thin
  // line of stalls at the centre, which was the weakest ground of the nine at
  // 11.0%. A dense market with wide cover measures 5.5%.
  //
  // AND IT IS DELIBERATELY THE ONE GROUND WITH NO RANGE CAP. Adding narrow
  // lanes to it measured 4.5%, a point better -- and taken, six of the nine
  // grounds would cap reach and the set would be one mechanism at nine
  // settings. The point costs less than the variety does.
  stalls:  { n: 'The market of markets', art: 'stalls', what: 'the stalls and awnings',
             from: 52, to: 88, beyond: 12, cut: 0.55 },

  // --- ROUGH GROUND AND EXPOSURE ARE GONE. Both measured worse than a flat
  // field on every map that carried them, and both failed the same way: they
  // scale an advantage that already exists rather than asking a new question.
  // A choke measured worse still. The rules went with them rather than being
  // left unreferenced. See the document.

  // The Neurex's chamber, read again off the page: "It was circular and vast,
  // and the walls were pods. They rose in tiers." The pods are on the WALLS and
  // the floor is open -- an earlier pass put them on the floor and slowed
  // everything crossing it, which is neither what the sentence says nor a good
  // game. A vast enclosed room is a room: you cannot shoot across it.
  clutter: { n: 'The pod chamber', cap: 26 },

  // Vex's ship, and the scene is a stateroom aboard it rather than open
  // wreckage: "a vessel assembled from the corpses of at least nine other
  // vessels, in a stateroom decorated with trophies". Bulkheads cap the reach;
  // the salvage bolted through it gives cover.
  wreck:   { n: 'The salvaged decks', art: 'plating', what: 'the bolted-on plates',
             cap: 22, from: 58, to: 82, beyond: 12, cut: 0.45 },

  // --- fire: costs you for standing there at all, and ignores armour. ---
  embers:  { n: 'Burning stubble', art: 'embers', from: 46, to: 94, burn: 1.6 },

  // --- close: caps every weapon's reach. A room, not a field. ---
  // "I signed the instrument of vassalage in a ROOM aboard one of their tribute
  // ships. They kept me waiting four hours." A cargo hold was invented; the
  // sentence says a room, and the room is where the Union was made a vassal.
  hold:    { n: 'The legate\'s room', cap: 20 },
  chamber: { n: 'The chamber', cap: 30 },

  // Vale's plaza is not open ground, which is what an earlier pass called it:
  // "At the plaza's centre stood the stage, flanked by two towers of Vale's
  // smiling face". A stage and two towers are structures in the middle of it --
  // they break the sightlines and they shelter whatever is behind them.
  open:    { n: 'The stage and towers', art: 'stage', what: 'the stage and its towers',
             cap: 34, from: 62, to: 78, beyond: 12, cut: 0.55 },

  // AND ONE BOARD IS DELIBERATELY BARE, which is a decision rather than an
  // omission and is marked as one. Enigma's parade ground is a drill square:
  // two hundred soldiers in ranks, two flags, and the Overseer watching from
  // the stand. There is nothing on it to use, and the honest mechanic for a
  // place with nothing on it is nothing.
  //
  // It costs something and the cost is measured: a bare board is the flat
  // control, 12.3% formalities against 4.0% on the best ground. What it buys is
  // a neutral board in the run -- somewhere the draft is the whole answer -- and
  // the most faithful reading of the one scene in the novel that is explicitly
  // about having nowhere to hide.
  //
  // `flat: true` is load-bearing. A ground that reaches the resolver and changes
  // nothing is the failure mode this project has shipped before; the guard in
  // terrain.mjs fails any ground that moves no battles UNLESS it says here that
  // it means to.
  stand:   { n: 'The drill square', flat: true }
};

export const MAPS = [
  { id: 'eden', terrain: 'stalls', n: 'Eden — the crossroads',
    q: 'Eden had been the heart of the Union\u2019s trade network in the days when we were a syndicate worth fearing: the great crossroads, the market of markets.', qv: 1 },
  // THE FIRST MAP WITH TERRAIN, and the manuscript picked it rather than a
  // coin: the terrace cuts are the one grade the walkers can climb, so an
  // armoured line has to come up them under fire. Cover is what that is.
  { id: 'terraces', terrain: 'cuts', n: 'Horizon — the terrace cuts',
    q: 'Their whole armored line has to come up the terrace cuts, here \u2014 it\u2019s the only grade the walkers can climb.', qv: 1 },
  { id: 'tribute', terrain: 'hold', n: 'The tribute ship',
    q: 'I signed the instrument of vassalage in a room aboard one of their tribute ships. They kept me waiting four hours.', qv: 1 },
  { id: 'parade', terrain: 'stand', n: 'The reviewing stand, Enigma',
    q: 'It moved both flags with the same indifference \u2014 the Union\u2019s silver-on-blue, and above it, on the taller pole, the black insignia of the Onyx Dominion.', qv: 1 },
  { id: 'raven', terrain: 'wreck', n: 'The Raven\u2019s Claw',
    q: 'A vessel assembled from the corpses of at least nine other vessels, in a stateroom decorated with trophies whose provenance I chose not to examine.', qv: 1 },
  { id: 'warroom', terrain: 'chamber', n: 'The war room',
    q: 'The war room of the Union Palace held the whole galaxy in light above its table.', qv: 1 },
  { id: 'plaza', terrain: 'open', n: 'The plaza',
    q: 'At the plaza\u2019s center stood the stage, flanked by two towers of Vale\u2019s smiling face, and an empty podium with its small bouquet of microphones waiting like the future.', qv: 1 },
  { id: 'croplands', terrain: 'embers', n: 'The burned croplands',
    q: 'They burned the orbitals, then the cities, then the croplands, and then they stayed in orbit an extra day to burn the forests.', qv: 1 },
  { id: 'pods', terrain: 'clutter', n: 'The Pod Room',
    q: 'It was circular and vast, and the walls were pods \u2014 and the occupied pods gave off a faint interior light, so that the great dark room glowed in patches, like votive candles in a drowned church.', qv: 1 }
];
/** WHAT A GROUND DOES, IN CLAUSES, DERIVED FROM ITS OWN NUMBERS.
 *
 *  Every one of these used to be a `says` string typed beside the fields it
 *  described -- which is a number written twice, and the copy is always the half
 *  that goes stale. An upkeep bill in this repository once quoted one vassal's
 *  cost for a whole bench, and a card said kit lasted "the rest of the run" for
 *  an engine that redrafts every match. Both read perfectly.
 *
 *  So the sentence is generated. Change `cap: 24` and the screen says 24 in the
 *  same breath; there is no second place to forget.
 *
 *  ONE CLAUSE PER PROPERTY, not one sentence per ground: five of the nine now do
 *  two things, and a run-on line is how a player stops reading the thing that
 *  tells them what the board is. */
export function groundSays(g) {
  if (!g) return [];
  if (g.flat) return ['No cover, no obstacle — nothing here to use.'];
  const out = [];
  if (g.cap) out.push(`Nothing shoots further than ${g.cap}.`);
  // EVERY `what` IS PLURAL, so one verb is always right and no ground needs a
  // flag someone has to remember. Capitalised properly rather than by swapping a
  // leading 't', which worked only because every noun so far begins "the".
  if (g.cut) {
    const w = g.what || 'it';
    out.push(`${w[0].toUpperCase()}${w.slice(1)} refuse ${Math.round(g.cut * 100)}% of fire from beyond ${g.beyond}.`);
  }
  if (g.burn) out.push(`${g.burn} damage a tick to anything standing in it.`);
  return out;
}

export const BY_MAP = Object.fromEntries(MAPS.map(m => [m.id, m]));

/* ----------------------------------------------------------------- the personas */
// The personality IS the drafting policy. Voice lines can come later; a persona
// that only talks is decoration.
//
// NINE NOW, AND SIX FACTIONS. It was five, of which three were Union -- Sam's
// note 18: "we need to make sure we have variety rather than almost everyone
// being from the Union". The book carries Union, the Onyx Dominion, Basileia,
// the Purifiers, the Neurex and the syndicates, and every one of them is now
// somebody you play.
//
// `d` IS WRITTEN FOR THE GAME AND SAYS SO. Units carry `qv` and `nv` so the
// roster can tell Sam whose line is whose; personas carried no mark at all, and
// every one of these descriptions is mine. `dv: 0` states it rather than leaving
// it to be assumed -- the whole point of the marks is that he can strike mine
// without opening a file.
export const PERSONAS = {
  varan: {
    n: 'Varan', f: 'Onyx Dominion', map: 'tribute', dv: 0,
    d: 'Drafts to deny. Takes what you need rather than what he needs \u2014 the auditor reading for the shape of what is not there.'
  },
  harlow: {
    n: 'Harlow', f: 'Union', map: 'eden', dv: 0,
    d: 'Drafts to keep. Durable, refuses trades, nothing dies that did not have to.'
  },
  hale: {
    n: 'Hale', f: 'Union', map: 'terraces', dv: 0,
    d: 'Drafts to schedule. Front-loads, presses tempo, closes early.'
  },
  vex: {
    n: 'Vex', f: 'The syndicates', map: 'raven', dv: 0,
    d: 'Drafts to profit. Takes the biggest number on the card, every time.'
  },
  leader: {
    n: 'The Leader', f: 'Union', map: 'warroom', dv: 0,
    d: 'Drafts to spend. Concedes early rounds deliberately to buy the late one.'
  },
  overseer: {
    n: 'The Overseer', f: 'Onyx Dominion', map: 'parade', dv: 0,
    d: 'Drafts what you drafted. It does not choose \u2014 it records, and everything you take goes in the file it reads back at you.'
  },
  vale: {
    n: 'Adran Vale', f: 'Basileia', map: 'plaza', dv: 0,
    d: 'Drafts to be seen. Takes the monument over the crowd \u2014 what a hundred thousand people would recognise on a banner.'
  },
  purifier: {
    n: 'The Purifiers', f: 'The Purifiers', map: 'croplands', dv: 0,
    d: 'Drafts to erase. The only opponent that never looks at your column, because nothing you hold is worth pricing.'
  },
  neurex: {
    n: 'The Neurex', f: 'The Neurex', map: 'pods', dv: 0,
    d: 'Does not draft. It becomes what it consumes \u2014 whatever you field most of is what comes back at you.'
  }
};

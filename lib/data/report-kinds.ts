// ─── The trip-report taxonomy ────────────────────────────────────────────────
//
// A trip report is a light skeleton (where / when / how) plus any number of
// ITEMS, each of a KIND. That is the whole idea: a biker adds fuel stops and a
// service centre, a remote worker adds WiFi and SIM coverage, a family adds
// viewpoints and food. Nobody has to fill in anyone else's form.
//
// THIS FILE IS THE TAXONOMY. It is data, not code paths: the form, the report
// page and the browse filters all render from it. Adding a kind, or a field on
// an existing kind, is an edit here and nothing else - no migration, no switch
// statement, no new component. That is why trip_report_items.details is jsonb.
//
// The shape of the list was checked against what report formats elsewhere in
// the world actually capture, and extended where India and two-wheelers differ:
//   * iOverlander's place categories contributed `water` (potable refill) and
//     `warning` (hazard / do-not-stop-here), both of which we would otherwise
//     have missed, plus the mechanic/parts and checkpoint framing.
//   * Park4Night's spot fields contributed the toilets / water / safe-overnight
//     questions on `parking` and `camping`.
//   * Team-BHP and xBhp drive/ride reports are consistently organised around
//     fuel stops (litres, price, "last bunk before X"), toll totals, road
//     surface by stretch and food halts - which is why `fuel`, `toll`,
//     `road_condition` and `food` carry the fields they do, and why the trip
//     skeleton asks for the vehicle and the running cost.
//   * Ladakh/Spiti trip write-ups contributed the ILP / permit-and-photocopies
//     shape of `checkpoint` and the "carry a jerry can" field on `fuel`.
//   * `sim` is ours. No general travel site records which network actually had
//     signal, and in the Indian hills that is one of the most useful facts a
//     traveller can leave behind.

export type ReportFieldType = 'text' | 'number' | 'select' | 'bool' | 'textarea'

export interface KindField {
  key: string
  label: string
  type: ReportFieldType
  /** Offered values. With `open`, they are suggestions rather than a closed set. */
  options?: readonly string[]
  /** Renders as a combobox that also accepts anything typed. */
  open?: boolean
  unit?: string
  placeholder?: string
  help?: string
}

/** A question chip plus the sentence it drops into the textarea to be finished. */
export interface WritingPrompt {
  q: string
  scaffold: string
}

export type KindGroup = 'road' | 'sleep' | 'signal' | 'places' | 'practical'

export interface ReportKind {
  id: string
  label: string
  icon: string
  group: KindGroup
  blurb: string
  namePlaceholder: string
  /** `stretch` items are a length of road rather than a point, so they ask for from/to. */
  geo: 'point' | 'stretch'
  fields: readonly KindField[]
  prompts: readonly WritingPrompt[]
}

export const KIND_GROUPS: { id: KindGroup; label: string }[] = [
  { id: 'road',      label: 'On the road' },
  { id: 'sleep',     label: 'Where you slept' },
  { id: 'signal',    label: 'Signal & working' },
  { id: 'places',    label: 'Places & things' },
  { id: 'practical', label: 'Practical stuff' },
]

// ─── Shared option lists ─────────────────────────────────────────────────────
// Curated, so typing "ji" offers "Jio". All of them are `open`, because a
// closed list would be wrong the day a new network or brand appears.

export const SIM_NETWORKS = ['Jio', 'Airtel', 'Vi (Vodafone Idea)', 'BSNL', 'MTNL'] as const
export const FUEL_BRANDS = ['Indian Oil', 'HP', 'Bharat Petroleum', 'Reliance', 'Nayara', 'Shell', 'Jio-bp'] as const
export const FUEL_TYPES = ['Petrol', 'Petrol (premium)', 'Diesel', 'CNG', 'LPG'] as const
export const STAY_KINDS = [
  'Homestay', 'Hotel', 'Resort', 'Guesthouse', 'Hostel', 'Campsite',
  'Someone’s house', 'PWD / govt rest house', 'Monastery / ashram', 'Tent / camper',
] as const
export const BOOKED_VIA = ['Walk-in', 'Phone call', 'WhatsApp', 'Airbnb', 'Booking.com', 'MakeMyTrip', 'Agoda', 'Goibibo', 'Through a local'] as const
export const BIKE_MAKES = ['Royal Enfield', 'Honda', 'Hero', 'Bajaj', 'TVS', 'Yamaha', 'KTM', 'Suzuki', 'Jawa', 'Any make', 'Roadside mechanic'] as const
export const EV_CONNECTORS = ['CCS2', 'CHAdeMO', 'Type 2 AC', 'Bharat AC-001', 'Bharat DC-001', '3-pin 15A', 'Proprietary (Ather / Ola)'] as const
export const EV_NETWORK_NAMES = ['Tata Power', 'Ather Grid', 'Statiq', 'ChargeZone', 'Zeon', 'ChargeMOD', 'Ola Hypercharger', 'Jio-bp pulse', 'Hotel / private'] as const
export const CUISINES = ['South Indian', 'North Indian', 'Chinese', 'Continental', 'Tibetan / Ladakhi', 'Seafood', 'Bakery / cafe', 'Dhaba', 'Street food'] as const
export const DIET = ['Pure veg', 'Veg + non-veg', 'Mostly non-veg', 'Vegan options', 'Jain food available'] as const
export const SURFACES = ['Smooth tarmac', 'Patchy tarmac', 'Broken / potholed', 'Gravel', 'Dirt track', 'Water crossing', 'Snow / ice', 'Under construction'] as const
export const CROWD = ['Empty', 'Quiet', 'Busy', 'Packed'] as const
export const TIME_OF_DAY = ['Sunrise', 'Morning', 'Midday', 'Afternoon', 'Sunset', 'Night'] as const

// ─── Fields every kind gets ──────────────────────────────────────────────────
// name, location, rating, cost, notes and photos are handled by the form itself
// rather than declared per kind - they are the same on all of them.

const OPEN_NOW: KindField = {
  key: 'open_status', label: 'Was it open?', type: 'select',
  options: ['Yes', 'No - closed', 'Seasonal - closed for the season', 'Did not check'],
}

const TIMINGS: KindField = {
  key: 'timings', label: 'Timings', type: 'text', placeholder: 'e.g. 6am - 10pm, closed Tuesdays',
}

// ─── The kinds ───────────────────────────────────────────────────────────────

export const REPORT_KINDS: readonly ReportKind[] = [
  // ── Where you slept ──────────────────────────────────────────────────────
  {
    id: 'stay',
    label: 'Stay',
    icon: '🏡',
    group: 'sleep',
    blurb: 'Homestay, hotel, campsite, or the random house that put you up.',
    namePlaceholder: 'Name of the place (or "the blue house past the bridge")',
    geo: 'point',
    fields: [
      { key: 'stay_type', label: 'Type', type: 'select', options: STAY_KINDS, open: true },
      { key: 'cost_per_night', label: 'Cost per night', type: 'number', unit: '₹' },
      { key: 'rooms', label: 'Rooms taken', type: 'number' },
      { key: 'host_name', label: 'Host name', type: 'text', placeholder: 'Who looked after you' },
      { key: 'host_phone', label: 'Host phone', type: 'text', help: 'Only if they are happy being contacted. This goes on a public page.' },
      { key: 'booked_via', label: 'Booked via', type: 'select', options: BOOKED_VIA, open: true },
      { key: 'hot_water', label: 'Hot water', type: 'select', options: ['Yes, all day', 'Bucket / geyser on request', 'Mornings only', 'None'] },
      { key: 'heating', label: 'Heating / blankets', type: 'select', options: ['Room heater', 'Bukhari / fireplace', 'Extra blankets only', 'Nothing - it was cold'] },
      { key: 'parking', label: 'Parking', type: 'select', options: ['Secure, off-road', 'On the street', 'Covered', 'None'] },
      { key: 'food_included', label: 'Food included', type: 'select', options: ['Breakfast', 'Breakfast + dinner', 'All meals', 'None'] },
      { key: 'would_return', label: 'Would you stay again?', type: 'bool' },
    ],
    prompts: [
      { q: 'How did you find it?', scaffold: 'We found this place by ' },
      { q: 'What was the room actually like?', scaffold: 'The room was ' },
      { q: 'How were the hosts?', scaffold: 'The hosts were ' },
      { q: 'Anything you wish you had known?', scaffold: 'One thing to know before booking: ' },
      { q: 'Would you send a friend here?', scaffold: 'I would / would not send a friend here because ' },
    ],
  },
  {
    id: 'camping',
    label: 'Camping spot',
    icon: '⛺',
    group: 'sleep',
    blurb: 'Wild camp, campsite, or a place you slept in the vehicle.',
    namePlaceholder: 'The spot (e.g. "flat ground by the stream, 3km past the pass")',
    geo: 'point',
    fields: [
      { key: 'camp_type', label: 'Type', type: 'select', options: ['Wild / free camp', 'Paid campsite', 'Slept in the vehicle', 'Tented camp (operator run)'] },
      { key: 'permission', label: 'Permission needed?', type: 'select', options: ['None - open land', 'Asked a local / farmer', 'Forest dept permit', 'Paid the site', 'Not sure - we just did'] },
      { key: 'ground', label: 'Ground', type: 'select', options: ['Flat and firm', 'Sloping', 'Rocky', 'Soft / muddy', 'Sand'] },
      { key: 'water_source', label: 'Water nearby?', type: 'bool' },
      { key: 'toilets', label: 'Toilets', type: 'select', options: ['Clean toilets', 'Basic toilets', 'None'] },
      { key: 'felt_safe', label: 'Felt safe overnight?', type: 'bool' },
      { key: 'phone_signal', label: 'Phone signal there', type: 'select', options: ['Full', 'Patchy', 'None'] },
    ],
    prompts: [
      { q: 'Why was this a good spot?', scaffold: 'This worked as a camp spot because ' },
      { q: 'How cold did it get?', scaffold: 'Overnight it got down to roughly ' },
      { q: 'Anyone come by?', scaffold: 'During the night ' },
      { q: 'Would you camp here again?', scaffold: 'I would camp here again if ' },
    ],
  },

  // ── Signal & working ─────────────────────────────────────────────────────
  {
    id: 'sim',
    label: 'SIM / mobile signal',
    icon: '📱',
    group: 'signal',
    blurb: 'Which network actually worked, and exactly where it stopped.',
    namePlaceholder: 'Where you tested it (town, pass, stretch of road)',
    geo: 'point',
    fields: [
      { key: 'network', label: 'Network', type: 'select', options: SIM_NETWORKS, open: true },
      { key: 'connection_type', label: 'Connection', type: 'select', options: ['5G', '4G / LTE', '3G', '2G / calls only', 'No service'] },
      { key: 'plan_type', label: 'Prepaid or postpaid', type: 'select', options: ['Prepaid', 'Postpaid'], help: 'Some restricted areas only accept postpaid connections.' },
      { key: 'bars', label: 'Signal bars', type: 'select', options: ['4-5 bars', '2-3 bars', '1 bar', 'Nothing'] },
      { key: 'data_speed_mbps', label: 'Rough data speed', type: 'number', unit: 'Mbps' },
      { key: 'calls_worked', label: 'Calls worked', type: 'bool' },
      { key: 'dropped_out_at', label: 'Where it died completely', type: 'text', placeholder: 'e.g. "nothing after the second checkpost"' },
      { key: 'came_back_at', label: 'Where it came back', type: 'text', placeholder: 'e.g. "signal returned entering Keylong"' },
    ],
    prompts: [
      { q: 'Which network would you carry next time?', scaffold: 'If I did this trip again I would carry ' },
      { q: 'Where exactly did it drop out?', scaffold: 'Signal held until ' },
      { q: 'Could you actually use it?', scaffold: 'With that signal I could / could not ' },
      { q: 'Did anyone else have signal when you did not?', scaffold: 'Someone with a different network ' },
    ],
  },
  {
    id: 'wifi',
    label: 'WiFi',
    icon: '📶',
    group: 'signal',
    blurb: 'Real numbers from a real test - the thing you cannot find anywhere else.',
    namePlaceholder: 'Where (the stay, the cafe, the co-working place)',
    geo: 'point',
    fields: [
      { key: 'download_mbps', label: 'Download', type: 'number', unit: 'Mbps' },
      { key: 'upload_mbps', label: 'Upload', type: 'number', unit: 'Mbps' },
      { key: 'tested_with', label: 'Tested with', type: 'select', options: ['Speedtest / Ookla', 'Fast.com', 'Google speed test', 'Just by using it'], open: true },
      { key: 'time_tested', label: 'Time of day tested', type: 'select', options: TIME_OF_DAY, open: true },
      { key: 'video_calls', label: 'Held up for a video call', type: 'bool' },
      { key: 'power_backup', label: 'Stayed up during a power cut', type: 'select', options: ['Yes - inverter / generator', 'No - died with the power', 'No power cut while we were there'] },
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'e.g. BSNL fibre, Airtel Xstream, JioFiber' },
      { key: 'password_needed', label: 'Free / open to guests', type: 'bool' },
    ],
    prompts: [
      { q: 'Did the WiFi hold up for a video call?', scaffold: 'On a video call the connection ' },
      { q: 'What time of day did it get worse?', scaffold: 'It was noticeably slower around ' },
      { q: 'What happened when the power went?', scaffold: 'When the power went out, ' },
      { q: 'Could you actually work a full day here?', scaffold: 'For a full working day this would ' },
    ],
  },

  // ── On the road ──────────────────────────────────────────────────────────
  {
    id: 'fuel',
    label: 'Petrol bunk',
    icon: '⛽',
    group: 'road',
    blurb: 'Where you refuelled - and the warning about where you should have.',
    namePlaceholder: 'Bunk name or landmark',
    geo: 'point',
    fields: [
      { key: 'brand', label: 'Brand', type: 'select', options: FUEL_BRANDS, open: true },
      { key: 'fuel_type', label: 'Fuel', type: 'select', options: FUEL_TYPES, open: true },
      { key: 'price_per_litre', label: 'Price per litre', type: 'number', unit: '₹' },
      { key: 'litres', label: 'Litres taken', type: 'number' },
      OPEN_NOW,
      { key: 'queue', label: 'Queue', type: 'select', options: ['None', 'A few minutes', 'Long - 20 min+'] },
      { key: 'payment', label: 'Payment', type: 'select', options: ['UPI worked', 'Card worked', 'Cash only', 'UPI kept failing'] },
      { key: 'last_fuel_warning', label: 'Last fuel before…', type: 'text', placeholder: 'e.g. "last bunk before Sarchu - 240km of nothing"' },
      { key: 'spare_fuel_advised', label: 'Carry a spare can from here', type: 'bool' },
    ],
    prompts: [
      { q: 'Where did you last refuel before this?', scaffold: 'The previous fuel stop was at ' },
      { q: 'How far is the next one?', scaffold: 'After this the next fuel is roughly ' },
      { q: 'Was the fuel any good?', scaffold: 'The fuel itself seemed ' },
      { q: 'Anything odd about the stop?', scaffold: 'Worth knowing: ' },
    ],
  },
  {
    id: 'road_condition',
    label: 'Road stretch',
    icon: '🛣️',
    group: 'road',
    blurb: 'A length of road rather than a point - surface, hairpins, whether to ride it at night.',
    namePlaceholder: 'What you would call this stretch',
    geo: 'stretch',
    fields: [
      { key: 'from', label: 'From', type: 'text', placeholder: 'Start of the stretch' },
      { key: 'to', label: 'To', type: 'text', placeholder: 'End of the stretch' },
      { key: 'distance_km', label: 'Length', type: 'number', unit: 'km' },
      { key: 'surface', label: 'Surface', type: 'select', options: SURFACES, open: true },
      { key: 'hairpins', label: 'Hairpins', type: 'number', help: 'Roughly. Ghat roads are usually signposted with a count.' },
      { key: 'traffic', label: 'Traffic', type: 'select', options: ['Empty', 'Light', 'Heavy', 'Convoy / trucks'] },
      { key: 'blockage', label: 'Landslide / closure', type: 'select', options: ['None', 'Cleared but active zone', 'One-way / single file', 'Closed - we turned back', 'Timed opening only'] },
      { key: 'night_riding', label: 'Ride it at night?', type: 'select', options: ['Fine', 'Doable but slow', 'Avoid', 'Absolutely not'] },
      { key: 'time_taken_hours', label: 'Time taken', type: 'number', unit: 'hrs' },
      { key: 'ground_clearance', label: 'Low car would struggle', type: 'bool' },
    ],
    prompts: [
      { q: 'What was the road surface like?', scaffold: 'The surface between these two points was ' },
      { q: 'Where were the bad bits?', scaffold: 'The worst section was ' },
      { q: 'How long did it actually take?', scaffold: 'It took us ' },
      { q: 'Would you do it at night or in rain?', scaffold: 'In the dark or in rain I would ' },
      { q: 'What vehicle would you bring?', scaffold: 'The right vehicle for this stretch is ' },
    ],
  },
  {
    id: 'bike_service',
    label: 'Service centre / mechanic',
    icon: '🔧',
    group: 'road',
    blurb: 'Who fixed you, what it cost, and whether they were straight with you.',
    namePlaceholder: 'Workshop name, or "the mechanic opposite the bus stand"',
    geo: 'point',
    fields: [
      { key: 'makes_handled', label: 'Makes handled', type: 'select', options: BIKE_MAKES, open: true },
      { key: 'authorised', label: 'Authorised service centre', type: 'bool' },
      { key: 'work_done', label: 'What they did', type: 'text', placeholder: 'e.g. chain + sprocket, clutch cable' },
      { key: 'puncture_repair', label: 'Puncture repair', type: 'select', options: ['Tube', 'Tubeless', 'Both', 'No'] },
      { key: 'spares', label: 'Spares in stock', type: 'select', options: ['Good stock', 'Basics only', 'Had to order', 'Nothing'] },
      TIMINGS,
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'fair_pricing', label: 'Priced fairly', type: 'select', options: ['Fair - charged what he said', 'Slightly over', 'Clearly overcharged tourists'] },
      { key: 'wait_time', label: 'Wait', type: 'text', placeholder: 'e.g. same day, 2 hours, next morning' },
    ],
    prompts: [
      { q: 'What went wrong with the vehicle?', scaffold: 'The problem was ' },
      { q: 'Did they know what they were doing?', scaffold: 'The work they did was ' },
      { q: 'What did it cost, honestly?', scaffold: 'They charged ' },
      { q: 'Would you trust them again?', scaffold: 'I would go back here because ' },
    ],
  },
  {
    id: 'ev_charging',
    label: 'EV charging',
    icon: '🔌',
    group: 'road',
    blurb: 'Whether the charger was actually working when you got there.',
    namePlaceholder: 'Charger location',
    geo: 'point',
    fields: [
      { key: 'network', label: 'Network', type: 'select', options: EV_NETWORK_NAMES, open: true },
      { key: 'connector', label: 'Connector', type: 'select', options: EV_CONNECTORS, open: true },
      { key: 'power_kw', label: 'Rated power', type: 'number', unit: 'kW' },
      { key: 'working', label: 'Was it working?', type: 'select', options: ['Yes', 'Partly - one gun dead', 'No', 'App would not start it'] },
      { key: 'cost', label: 'Cost', type: 'text', placeholder: 'e.g. ₹18/kWh, free for guests' },
      { key: 'wait', label: 'Wait for a free bay', type: 'select', options: ['None', 'Under 30 min', 'Over an hour'] },
      { key: 'amenities', label: 'Somewhere to wait', type: 'select', options: ['Cafe / restaurant', 'Shade and a bench', 'Nothing at all'] },
    ],
    prompts: [
      { q: 'Did it actually start charging?', scaffold: 'Getting the session started ' },
      { q: 'How long for how much range?', scaffold: 'We added roughly ' },
      { q: 'Would you rely on this one?', scaffold: 'I would / would not plan a route around this charger because ' },
    ],
  },
  {
    id: 'toll',
    label: 'Toll',
    icon: '🎫',
    group: 'road',
    blurb: 'What it cost and whether FASTag behaved.',
    namePlaceholder: 'Toll plaza name',
    geo: 'point',
    fields: [
      { key: 'amount_one_way', label: 'One way', type: 'number', unit: '₹' },
      { key: 'amount_return', label: 'Return / same-day', type: 'number', unit: '₹' },
      { key: 'vehicle_class', label: 'Vehicle class', type: 'select', options: ['Two-wheeler (usually free)', 'Car / jeep / van', 'LCV', 'Bus / truck'] },
      { key: 'fastag', label: 'FASTag', type: 'select', options: ['Worked', 'Failed - paid cash', 'Lane was cash only'] },
      { key: 'queue', label: 'Queue', type: 'select', options: ['None', 'A few minutes', '20 min+'] },
    ],
    prompts: [
      { q: 'What did the whole route cost in tolls?', scaffold: 'Total tolls for this leg came to ' },
      { q: 'Any way around it?', scaffold: 'There is an alternative route that ' },
    ],
  },
  {
    id: 'checkpoint',
    label: 'Checkpost / permit',
    icon: '🛂',
    group: 'road',
    blurb: 'ILP, forest gate, army checkpost - what they asked for.',
    namePlaceholder: 'Checkpost or permit office',
    geo: 'point',
    fields: [
      { key: 'permit_needed', label: 'Permit needed', type: 'select', options: ['Inner Line Permit (ILP)', 'Forest / wildlife permit', 'Environmental fee', 'Protected Area Permit', 'None - just ID'], open: true },
      { key: 'where_to_get', label: 'Where to get it', type: 'text', placeholder: 'e.g. online portal, DC office in Leh, at the gate' },
      { key: 'cost', label: 'Cost per person', type: 'number', unit: '₹' },
      { key: 'documents', label: 'Documents asked for', type: 'text', placeholder: 'e.g. Aadhaar, RC, DL, passport photos' },
      { key: 'photocopies', label: 'Photocopies to carry', type: 'number', help: 'Checkposts keep a copy each. Riders routinely carry 6-10.' },
      TIMINGS,
      { key: 'manned_by', label: 'Manned by', type: 'select', options: ['Police', 'Army / ITBP', 'Forest dept', 'Local council', 'Unmanned'] },
      { key: 'foreigners', label: 'Different rules for foreigners', type: 'bool' },
    ],
    prompts: [
      { q: 'What exactly did they ask for?', scaffold: 'At the checkpost they asked for ' },
      { q: 'How long did it take?', scaffold: 'The whole stop took ' },
      { q: 'What would have made it easier?', scaffold: 'Next time I would arrive with ' },
    ],
  },
  {
    id: 'warning',
    label: 'Warning',
    icon: '⚠️',
    group: 'road',
    blurb: 'Somewhere to be careful, or not stop at all.',
    namePlaceholder: 'Where',
    geo: 'point',
    fields: [
      { key: 'hazard', label: 'What kind', type: 'select', options: ['Landslide / rockfall zone', 'Accident black spot', 'Aggressive dogs', 'Wildlife on the road', 'Theft / snatching', 'Overcharging / scam', 'Do not stop after dark', 'Flooding / water crossing'], open: true },
      { key: 'when', label: 'When it is worst', type: 'select', options: ['Any time', 'After dark', 'Monsoon', 'Winter / snow', 'Weekends'] },
      { key: 'severity', label: 'How serious', type: 'select', options: ['Be aware', 'Genuinely risky', 'Avoid entirely'] },
    ],
    prompts: [
      { q: 'What happened, or nearly happened?', scaffold: 'What happened here was ' },
      { q: 'What should someone do differently?', scaffold: 'If you are coming through here, ' },
    ],
  },

  // ── Places & things ──────────────────────────────────────────────────────
  {
    id: 'viewpoint',
    label: 'Viewpoint',
    icon: '🏔️',
    group: 'places',
    blurb: 'The reason people come. Including whether it was worth the queue.',
    namePlaceholder: 'Name of the viewpoint',
    geo: 'point',
    fields: [
      { key: 'best_time', label: 'Best time of day', type: 'select', options: TIME_OF_DAY, open: true },
      { key: 'crowd', label: 'Crowd', type: 'select', options: CROWD },
      { key: 'entry_fee', label: 'Entry fee', type: 'number', unit: '₹' },
      { key: 'camera_fee', label: 'Camera / drone fee', type: 'text' },
      { key: 'parking', label: 'Parking', type: 'select', options: ['Free and easy', 'Paid', 'Roadside only', 'Nightmare'] },
      { key: 'walk', label: 'Walk from parking', type: 'text', placeholder: 'e.g. 200m flat, 20 min uphill' },
      { key: 'photo_worthy', label: 'Worth the detour', type: 'bool' },
      { key: 'safety', label: 'Safety', type: 'select', options: ['Railings, fine', 'Unfenced drops', 'Slippery when wet', 'Keep children close'] },
      { key: 'view_blocked_by', label: 'View spoiled by', type: 'text', placeholder: 'e.g. cloud after 11am, new construction' },
    ],
    prompts: [
      { q: 'What can you actually see from here?', scaffold: 'From here you can see ' },
      { q: 'When should someone turn up?', scaffold: 'Get here by ' },
      { q: 'Was it worth it?', scaffold: 'Compared to the other viewpoints nearby, this one ' },
      { q: 'Anything that ruins it?', scaffold: 'The one thing that spoils it is ' },
    ],
  },
  {
    id: 'food',
    label: 'Food',
    icon: '🍽️',
    group: 'places',
    blurb: 'Restaurant, dhaba, tea stall, the aunty with the good parathas.',
    namePlaceholder: 'Name of the place',
    geo: 'point',
    fields: [
      { key: 'cuisine', label: 'Cuisine', type: 'select', options: CUISINES, open: true },
      { key: 'diet', label: 'Veg / non-veg', type: 'select', options: DIET, open: true },
      { key: 'cost_for_two', label: 'Cost for two', type: 'number', unit: '₹' },
      { key: 'must_order', label: 'Order this', type: 'text', placeholder: 'The one dish' },
      TIMINGS,
      { key: 'wait', label: 'Wait for a table', type: 'select', options: ['Walked straight in', '10-20 min', 'Over half an hour'] },
      { key: 'clean', label: 'Clean', type: 'select', options: ['Spotless', 'Fine', 'Rough but the food was good', 'Would not eat there again'] },
      { key: 'parking', label: 'Parking outside', type: 'bool' },
    ],
    prompts: [
      { q: 'What did you order?', scaffold: 'We ordered ' },
      { q: 'Would you stop here again?', scaffold: 'On the way back I would ' },
      { q: 'Who is this right for?', scaffold: 'This is a good stop if you ' },
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    icon: '🛍️',
    group: 'places',
    blurb: 'Markets, mills, co-operatives, whatever you actually carried home.',
    namePlaceholder: 'Shop, market or street',
    geo: 'point',
    fields: [
      { key: 'what_to_buy', label: 'What to buy here', type: 'text', placeholder: 'e.g. tea, eucalyptus oil, pashmina, spices' },
      { key: 'shop_type', label: 'Type', type: 'select', options: ['Local market', 'Government emporium', 'Co-operative', 'Factory outlet / mill', 'Mall', 'Roadside stalls'], open: true },
      { key: 'price_paid', label: 'What you paid', type: 'text', placeholder: 'e.g. ₹400/kg after bargaining' },
      { key: 'bargaining', label: 'Bargaining', type: 'select', options: ['Fixed price', 'Some room', 'Haggle hard - start at half', 'Tourist pricing'] },
      TIMINGS,
      { key: 'payment', label: 'Payment', type: 'select', options: ['UPI', 'Card', 'Cash only'] },
      { key: 'genuine', label: 'Seemed genuine', type: 'bool' },
    ],
    prompts: [
      { q: 'What is actually worth buying here?', scaffold: 'The thing worth buying here is ' },
      { q: 'How much should someone pay?', scaffold: 'A fair price is around ' },
      { q: 'How do you spot the fakes?', scaffold: 'To tell the real thing from the tourist version, ' },
    ],
  },
  {
    id: 'trek_start',
    label: 'Trek / walk',
    icon: '🥾',
    group: 'places',
    blurb: 'Where a walk starts, and what it takes to do it.',
    namePlaceholder: 'Trail or trailhead name',
    geo: 'point',
    fields: [
      { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['Easy stroll', 'Moderate', 'Hard', 'Serious - proper gear'] },
      { key: 'duration_hours', label: 'Round trip', type: 'number', unit: 'hrs' },
      { key: 'distance_km', label: 'Distance', type: 'number', unit: 'km' },
      { key: 'ascent_m', label: 'Climb', type: 'number', unit: 'm' },
      { key: 'guide_needed', label: 'Guide required', type: 'select', options: ['No', 'Recommended', 'Compulsory'] },
      { key: 'permit_needed', label: 'Permit / fee', type: 'text' },
      { key: 'water_on_route', label: 'Water on the route', type: 'bool' },
      { key: 'start_by', label: 'Start by', type: 'text', placeholder: 'e.g. 6am, before the cloud comes in' },
    ],
    prompts: [
      { q: 'How hard was it really?', scaffold: 'Compared to what the signs said, the walk was ' },
      { q: 'What should someone carry?', scaffold: 'Carry ' },
      { q: 'Is the trail easy to follow?', scaffold: 'The path itself is ' },
    ],
  },

  // ── Practical stuff ──────────────────────────────────────────────────────
  {
    id: 'water',
    label: 'Drinking water',
    icon: '💧',
    group: 'practical',
    blurb: 'Where to refill. On a long hill run this matters more than people expect.',
    namePlaceholder: 'Where',
    geo: 'point',
    fields: [
      { key: 'source', label: 'Source', type: 'select', options: ['RO / filtered point', 'Tap - safe', 'Spring / stream', 'Shop selling cans', 'Hand pump'], open: true },
      { key: 'cost', label: 'Cost', type: 'text', placeholder: 'e.g. free, ₹5 per bottle refill' },
      { key: 'safe_to_drink', label: 'Drank it without treating', type: 'bool' },
      { key: 'bottle_refill', label: 'Can you refill your own bottle', type: 'bool' },
    ],
    prompts: [
      { q: 'Would you drink it untreated?', scaffold: 'We drank it ' },
      { q: 'Where is the next one?', scaffold: 'The next reliable water after this is ' },
    ],
  },
  {
    id: 'atm_bank',
    label: 'ATM / bank',
    icon: '🏧',
    group: 'practical',
    blurb: 'Cash still runs the hills. Note the one that had money in it.',
    namePlaceholder: 'Bank / ATM location',
    geo: 'point',
    fields: [
      { key: 'bank', label: 'Bank', type: 'text', placeholder: 'e.g. SBI, HDFC, J&K Bank' },
      { key: 'had_cash', label: 'Had cash', type: 'select', options: ['Yes', 'No - empty', 'Out of order'] },
      { key: 'withdrawal_limit', label: 'Per-withdrawal limit', type: 'number', unit: '₹' },
      { key: 'upi_accepted_nearby', label: 'Do shops nearby take UPI', type: 'select', options: ['Widely', 'Some do', 'Cash only around here'] },
      { key: 'last_atm_before', label: 'Last ATM before…', type: 'text', placeholder: 'e.g. "last one before Hanle"' },
    ],
    prompts: [
      { q: 'How much cash should someone carry?', scaffold: 'I would carry at least ' },
      { q: 'Where does cash stop being optional?', scaffold: 'Past this point, cash is ' },
    ],
  },
  {
    id: 'hospital_pharmacy',
    label: 'Hospital / pharmacy',
    icon: '🏥',
    group: 'practical',
    blurb: 'Where help is, especially at altitude.',
    namePlaceholder: 'Name of the hospital, clinic or chemist',
    geo: 'point',
    fields: [
      { key: 'facility', label: 'Type', type: 'select', options: ['Government hospital', 'Private hospital', 'Primary health centre', 'Clinic', 'Pharmacy / chemist', 'Army medical'] },
      { key: 'open_24h', label: 'Open 24 hours', type: 'bool' },
      { key: 'oxygen', label: 'Oxygen available', type: 'bool', help: 'The question that matters above 3,000m.' },
      { key: 'altitude_sickness', label: 'Treats altitude sickness', type: 'bool' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'nearest_bigger', label: 'Nearest bigger hospital', type: 'text' },
    ],
    prompts: [
      { q: 'What did you need it for?', scaffold: 'We went here because ' },
      { q: 'How were you treated?', scaffold: 'The care was ' },
      { q: 'What should someone bring in their own kit?', scaffold: 'Carry your own ' },
    ],
  },
  {
    id: 'parking',
    label: 'Parking',
    icon: '🅿️',
    group: 'practical',
    blurb: 'Especially in the towns where there genuinely is none.',
    namePlaceholder: 'Where',
    geo: 'point',
    fields: [
      { key: 'cost', label: 'Cost', type: 'text', placeholder: 'e.g. ₹50 for the day' },
      { key: 'secure', label: 'Secure / attended', type: 'bool' },
      { key: 'overnight_ok', label: 'Overnight allowed', type: 'bool' },
      { key: 'space_for', label: 'Fits', type: 'select', options: ['Two-wheelers', 'Cars', 'SUV / camper', 'Anything'] },
      { key: 'busy_times', label: 'Full by', type: 'text', placeholder: 'e.g. full by 9am at weekends' },
    ],
    prompts: [
      { q: 'How hard was it to find a space?', scaffold: 'Finding a space took ' },
      { q: 'Where would you park instead?', scaffold: 'If this is full, try ' },
    ],
  },
  {
    id: 'laundry',
    label: 'Laundry / showers',
    icon: '🧺',
    group: 'practical',
    blurb: 'Week two of any long trip, this is the thing you are looking for.',
    namePlaceholder: 'Where',
    geo: 'point',
    fields: [
      { key: 'service', label: 'Service', type: 'select', options: ['Laundry - drop off', 'Self-service machines', 'Hot showers', 'Both laundry and showers'] },
      { key: 'cost', label: 'Cost', type: 'text', placeholder: 'e.g. ₹60/kg, ₹100 per shower' },
      { key: 'turnaround', label: 'Turnaround', type: 'text', placeholder: 'e.g. same day, 24 hours' },
      TIMINGS,
    ],
    prompts: [
      { q: 'Did the clothes come back in one piece?', scaffold: 'The washing came back ' },
      { q: 'Was the water actually hot?', scaffold: 'The hot water ' },
    ],
  },
  {
    id: 'other',
    label: 'Something else',
    icon: '📍',
    group: 'practical',
    blurb: 'Anything that does not fit above. Genuinely anything.',
    namePlaceholder: 'What is it',
    geo: 'point',
    fields: [
      { key: 'what', label: 'What kind of thing is this', type: 'text', placeholder: 'e.g. a temple, a bike rental, a photo shop' },
      TIMINGS,
      { key: 'cost', label: 'Cost', type: 'text' },
    ],
    prompts: [
      { q: 'What is it and why does it matter?', scaffold: 'This is ' },
      { q: 'What would you tell a friend about it?', scaffold: 'If a friend asked, I would say ' },
    ],
  },
] as const

// ─── Lookups ─────────────────────────────────────────────────────────────────

export const KIND_IDS: readonly string[] = REPORT_KINDS.map((k) => k.id)

const KIND_BY_ID = new Map(REPORT_KINDS.map((k) => [k.id, k]))

/** The kind config, or the `other` fallback so an unknown kind still renders. */
export function getKind(id: string): ReportKind {
  return KIND_BY_ID.get(id) ?? REPORT_KINDS[REPORT_KINDS.length - 1]
}

export function kindLabel(id: string): string {
  return KIND_BY_ID.get(id)?.label ?? id
}

export function kindIcon(id: string): string {
  return KIND_BY_ID.get(id)?.icon ?? '📍'
}

/** Human label for a details key, falling back to a de-snake-cased version. */
export function fieldLabel(kindId: string, key: string): string {
  const f = KIND_BY_ID.get(kindId)?.fields.find((x) => x.key === key)
  if (f) return f.label
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/** The unit suffix for a details key, if it has one ("₹", "km", "Mbps"). */
export function fieldUnit(kindId: string, key: string): string | undefined {
  return KIND_BY_ID.get(kindId)?.fields.find((x) => x.key === key)?.unit
}

// ─── Trip-level option lists ─────────────────────────────────────────────────

export const TRANSPORT_MODES = [
  { id: 'bike', label: 'Motorcycle', icon: '🏍️' },
  { id: 'car', label: 'Car', icon: '🚗' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'train', label: 'Train', icon: '🚆' },
  { id: 'cycle', label: 'Bicycle', icon: '🚲' },
  { id: 'flight', label: 'Flight + local', icon: '✈️' },
  { id: 'walk', label: 'On foot', icon: '🥾' },
  { id: 'mixed', label: 'A bit of everything', icon: '🧭' },
] as const

export type TransportModeId = (typeof TRANSPORT_MODES)[number]['id']

export const TRANSPORT_MODE_IDS: readonly string[] = TRANSPORT_MODES.map((m) => m.id)

export function transportLabel(id: string | null): string | null {
  if (!id) return null
  return TRANSPORT_MODES.find((m) => m.id === id)?.label ?? id
}

export function transportIcon(id: string | null): string {
  if (!id) return '🧭'
  return TRANSPORT_MODES.find((m) => m.id === id)?.icon ?? '🧭'
}

/** Writing prompts for the trip's own summary, which belongs to no kind. */
export const SUMMARY_PROMPTS: readonly WritingPrompt[] = [
  { q: 'Why did you go?', scaffold: 'We went because ' },
  { q: 'How did the days break down?', scaffold: 'Day one we rode from ' },
  { q: 'What surprised you?', scaffold: 'The thing nobody told us was ' },
  { q: 'What went wrong?', scaffold: 'What went wrong was ' },
  { q: 'What would you do differently?', scaffold: 'Next time I would ' },
  { q: 'Who is this trip right for?', scaffold: 'This trip suits someone who ' },
]

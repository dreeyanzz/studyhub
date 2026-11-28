// 50-space real Metro Cebu demo catalog + synthetic users, zones, units, tags,
// photos, space_events, reservations, payments, reviews, and moderation fixtures
// for local + cloud parity (D-097, amends D-013 for demo Space names/locations).
//
// Deterministic UUID namespaces (never collide with supabase/seed.sql):
//   Spaces:        50000000-0000-4000-8000-000000000001..050
//   Zones:         51000000-0000-4000-8000-000000000001..NNN
//   Units:         52000000-0000-4000-8000-000000000001..NNN
//   Reservations:  53000000-0000-4000-8000-000000000001..NNN
//   Payments:      54000000-0000-4000-8000-000000000001..NNN
//   Reviews:       55000000-0000-4000-8000-000000000001..NNN
//   Reports:       56000000-0000-4000-8000-000000000001..NNN
//   Mod events:    57000000-0000-4000-8000-000000000001..NNN
//   Space events:  58000000-0000-4000-8000-000000000001..NNN

const pad = (n, len = 12) => String(n).padStart(len, '0')
export const demoUuid = (prefix, n) => `${prefix}-0000-4000-8000-${pad(n)}`

export const DEMO_PHOTO_FILES = [
  'coworking-lounge.jpg',
  'silent-study-hall.jpg',
  'study-cafe.jpg',
]

export const CURATED_TAG_IDS = [
  'wifi_basic',
  'wifi_fast',
  'wifi_ultrafast',
  'outlets_all',
  'outlets_some',
  'noise_silent',
  'noise_quiet',
  'noise_moderate',
  'ac_full',
  'ac_natural',
]

/**
 * Synthetic user accounts covering every role, profile completeness,
 * onboarding confirmation, host inventory, and seeker hold/review substate (D-013, D-097).
 */
export const DEMO_USERS = [
  // Administrator (uses CLOUD_DEV_ADMIN_PASSWORD on cloud, Worq-demo-2026 locally)
  {
    key: 'admin',
    email: 'admin@example.test',
    role: 'admin',
    fullName: 'Alma Reyes',
    phoneNumber: '+63 917 500 0001',
    roleConfirmed: true,
    isAdminPassword: true,
  },
  // Hosts (6 total, including 1 brand-new host with 0 spaces)
  {
    key: 'host1',
    email: 'host@example.test',
    role: 'host',
    fullName: 'Hugo Santos',
    phoneNumber: '+63 917 500 0101',
    roleConfirmed: true,
  },
  {
    key: 'host2',
    email: 'host2@example.test',
    role: 'host',
    fullName: 'Hana Villanueva',
    phoneNumber: '+63 917 500 0102',
    roleConfirmed: true,
  },
  {
    key: 'host3',
    email: 'host3@example.test',
    role: 'host',
    fullName: 'Marco Tan',
    phoneNumber: '+63 917 500 0103',
    roleConfirmed: true,
  },
  {
    key: 'host4',
    email: 'host4@example.test',
    role: 'host',
    fullName: 'Clarissa Lim',
    phoneNumber: '+63 917 500 0104',
    roleConfirmed: true,
  },
  {
    key: 'host5',
    email: 'host5@example.test',
    role: 'host',
    fullName: 'Rafael Soriano',
    phoneNumber: null, // tests host profile without phone number
    roleConfirmed: true,
  },
  {
    key: 'host6',
    email: 'host6@example.test',
    role: 'host',
    fullName: 'Bianca Navarro',
    phoneNumber: '+63 917 500 0106',
    roleConfirmed: true, // 0 spaces -> empty /host dashboard state
  },
  // Seekers (8 total across every hold/history/review/onboarding substate)
  {
    key: 'seeker1',
    email: 'seeker@example.test',
    role: 'seeker',
    fullName: 'Sam Dela Cruz',
    phoneNumber: '+63 917 500 0201',
    roleConfirmed: true, // FREE (no active hold) + rich history + reviews + filed report
  },
  {
    key: 'seeker2',
    email: 'seeker2@example.test',
    role: 'seeker',
    fullName: 'Rina Bautista',
    phoneNumber: '+63 917 500 0202',
    roleConfirmed: true, // Active `reserved` paid hold (QR check-in ready)
  },
  {
    key: 'seeker3',
    email: 'seeker3@example.test',
    role: 'seeker',
    fullName: 'Miguel Abad',
    phoneNumber: '+63 917 500 0203',
    roleConfirmed: true, // Active `occupied` checked-in hold
  },
  {
    key: 'seeker4',
    email: 'seeker4@example.test',
    role: 'seeker',
    fullName: 'Tricia Go',
    phoneNumber: null, // Active `pending_payment` hold + no phone number
    roleConfirmed: true,
  },
  {
    key: 'seeker5',
    email: 'seeker5@example.test',
    role: 'seeker',
    fullName: 'Paolo Enriquez',
    phoneNumber: '+63 917 500 0205',
    roleConfirmed: true, // Past cancelled / take-down / expired / no_show + hidden/removed reviews
  },
  {
    key: 'seeker6',
    email: 'seeker6@example.test',
    role: 'seeker',
    fullName: 'Denise Uy',
    phoneNumber: '+63 917 500 0206',
    roleConfirmed: true, // Frequent reviewer including edited review (version = 2)
  },
  {
    key: 'seeker7',
    email: 'seeker7@example.test',
    role: 'seeker',
    fullName: 'Kevin Ocampo',
    phoneNumber: '+63 917 500 0207',
    roleConfirmed: true, // Brand-new seeker with 0 reservations & 0 reviews
  },
  {
    key: 'seeker8',
    email: 'seeker8@example.test',
    role: 'seeker',
    fullName: 'Camille Dizon',
    phoneNumber: null,
    roleConfirmed: false, // Unconfirmed role -> /choose-role onboarding state
  },
]

// Compact seat-map presets so every space has realistic, non-overlapping grids.
// Each unit: { type: 'seat'|'standing_desk'|'room', label, cap, row, col, span, hostState }
function buildPresetLayout(preset, occupancyProfile) {
  if (preset === 'empty') return []

  const layouts = {
    hybrid: [
      {
        name: 'Quiet Study Zone',
        units: [
          { type: 'seat', label: 'S1', cap: null, row: 0, col: 0, span: 1 },
          { type: 'seat', label: 'S2', cap: null, row: 0, col: 1, span: 1 },
          { type: 'seat', label: 'S3', cap: null, row: 0, col: 2, span: 1 },
          { type: 'seat', label: 'S4', cap: null, row: 0, col: 3, span: 1 },
          { type: 'seat', label: 'S5', cap: null, row: 1, col: 0, span: 1 },
          { type: 'seat', label: 'S6', cap: null, row: 1, col: 1, span: 1 },
        ],
      },
      {
        name: 'Standing Desk Bar',
        units: [
          { type: 'standing_desk', label: 'D1', cap: null, row: 0, col: 0, span: 1 },
          { type: 'standing_desk', label: 'D2', cap: null, row: 0, col: 1, span: 1 },
          { type: 'standing_desk', label: 'D3', cap: null, row: 0, col: 2, span: 1 },
        ],
      },
      {
        name: 'Private Study Rooms',
        units: [
          { type: 'room', label: 'Room A', cap: 6, row: 0, col: 0, span: 3 },
          { type: 'room', label: 'Room B', cap: 4, row: 0, col: 3, span: 2 },
        ],
      },
    ],
    seat_room: [
      {
        name: 'Main Study Hall',
        units: [
          { type: 'seat', label: 'S1', cap: null, row: 0, col: 0, span: 1 },
          { type: 'seat', label: 'S2', cap: null, row: 0, col: 1, span: 1 },
          { type: 'seat', label: 'S3', cap: null, row: 0, col: 2, span: 1 },
          { type: 'seat', label: 'S4', cap: null, row: 0, col: 3, span: 1 },
          { type: 'seat', label: 'S5', cap: null, row: 1, col: 0, span: 1 },
          { type: 'seat', label: 'S6', cap: null, row: 1, col: 1, span: 1 },
        ],
      },
      {
        name: 'Group Rooms',
        units: [
          { type: 'room', label: 'Pod 1', cap: 4, row: 0, col: 0, span: 2 },
          { type: 'room', label: 'Pod 2', cap: 6, row: 0, col: 2, span: 3 },
        ],
      },
    ],
    seat_standing: [
      {
        name: 'Focus Desks',
        units: [
          { type: 'seat', label: 'A1', cap: null, row: 0, col: 0, span: 1 },
          { type: 'seat', label: 'A2', cap: null, row: 0, col: 1, span: 1 },
          { type: 'seat', label: 'A3', cap: null, row: 0, col: 2, span: 1 },
          { type: 'seat', label: 'A4', cap: null, row: 0, col: 3, span: 1 },
        ],
      },
      {
        name: 'Window Counter',
        units: [
          { type: 'standing_desk', label: 'W1', cap: null, row: 0, col: 0, span: 1 },
          { type: 'standing_desk', label: 'W2', cap: null, row: 0, col: 1, span: 1 },
          { type: 'standing_desk', label: 'W3', cap: null, row: 0, col: 2, span: 1 },
        ],
      },
    ],
    seats_only: [
      {
        name: 'Reading Tables',
        units: [
          { type: 'seat', label: 'T1', cap: null, row: 0, col: 0, span: 1 },
          { type: 'seat', label: 'T2', cap: null, row: 0, col: 1, span: 1 },
          { type: 'seat', label: 'T3', cap: null, row: 0, col: 2, span: 1 },
          { type: 'seat', label: 'T4', cap: null, row: 0, col: 3, span: 1 },
          { type: 'seat', label: 'T5', cap: null, row: 1, col: 0, span: 1 },
          { type: 'seat', label: 'T6', cap: null, row: 1, col: 1, span: 1 },
        ],
      },
    ],
    rooms_only: [
      {
        name: 'Meeting & Focus Suites',
        units: [
          { type: 'room', label: 'Suite 1', cap: 4, row: 0, col: 0, span: 2 },
          { type: 'room', label: 'Suite 2', cap: 6, row: 0, col: 2, span: 3 },
          { type: 'room', label: 'Suite 3', cap: 8, row: 1, col: 0, span: 3 },
        ],
      },
    ],
  }

  const zones = layouts[preset] ?? layouts.seats_only
  let flatIdx = 0
  const totalUnits = zones.reduce((sum, z) => sum + z.units.length, 0)

  return zones.map((zone, zIdx) => ({
    name: zone.name,
    position: zIdx,
    units: zone.units.map((u) => {
      const idx = flatIdx++
      let hostState = 'available'
      if (occupancyProfile === 'full') {
        hostState = idx % 3 === 0 ? 'reserved' : 'occupied'
      } else if (occupancyProfile === 'busy') {
        // Leave last 1–2 units available
        if (idx < totalUnits - 2) {
          hostState = idx % 4 === 0 ? 'reserved' : 'occupied'
        }
      } else if (occupancyProfile === 'moderate') {
        if (idx % 2 === 1) hostState = 'occupied'
      } else if (occupancyProfile === 'light') {
        if (idx === 1) hostState = 'occupied'
      }
      return { ...u, hostState }
    }),
  }))
}

/**
 * 50 real Metro Cebu study & co-working hubs covering:
 * - 38 verified, 6 pending, 3 rejected, 3 taken_down
 * - All 4 price tiers (free, budget, standard, premium)
 * - 24/7, daytime, and overnight past-midnight operating hours
 * - Wait windows: 15, 30, 45, 60 minutes
 * - All 13 Metro Cebu campus clusters from lib/geo/campuses.ts
 * - Fresh (<10m), aging (~2h), stale (>2d) occupancy timestamps
 * - Multi-photo, single-photo, and no-photo spaces
 * - All 10 curated tags + custom tags + untagged spaces
 */
const RAW_SPACES = [
  // ── VERIFIED (1–38) ────────────────────────────────────────────────────────
  {
    index: 1,
    hostKey: 'host1',
    name: 'Workplace Cafe - Ramos',
    description:
      'Flagship 24-hour Cebu study cafe along F. Ramos St. with quiet booths, fast fiber Wi-Fi, bottomless brewed coffee, and power outlets at every desk.',
    address: 'F. Ramos St., Sta. Cruz, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.3071,
    longitude: 123.8965,
    priceTier: 'budget',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['bottomless-coffee', '24-7', 'student-friendly'],
    layout: 'hybrid',
    occupancy: 'moderate',
    freshnessMinutesAgo: 5,
    photos: ['study-cafe.jpg', 'silent-study-hall.jpg', 'coworking-lounge.jpg'],
  },
  {
    index: 2,
    hostKey: 'host1',
    name: 'Workplace Cafe - Banawa',
    description:
      'Late-night study hub in Banawa popular with SWU and med students, featuring individual lamp-lit desks and bookable review rooms.',
    address: 'V. Rama Ave., Banawa, Cebu City',
    opensAt: '08:00',
    closesAt: '02:00',
    latitude: 10.3125,
    longitude: 123.8842,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['med-review', 'late-night'],
    layout: 'seat_room',
    occupancy: 'light',
    freshnessMinutesAgo: 12,
    photos: ['study-cafe.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 3,
    hostKey: 'host5',
    name: 'Workplace Cafe - Mandaue',
    description:
      'Spacious Mandaue study and co-working branch near CDU and UCLM with ergonomic chairs, pantry snacks, and dual-ISP fiber.',
    address: 'A.S. Fortuna St., Bakilid, Mandaue City',
    opensAt: '08:00',
    closesAt: '23:59',
    latitude: 10.3358,
    longitude: 123.9268,
    priceTier: 'budget',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['dual-isp', 'parking'],
    layout: 'seat_standing',
    occupancy: 'moderate',
    freshnessMinutesAgo: 135, // aging
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg'],
  },
  {
    index: 4,
    hostKey: 'host3',
    name: 'Workplace Cafe - IT Park',
    description:
      '24/7 IT Park branch built for night-shift remote workers and UP Cebu / USPF students needing high-speed internet and private pods.',
    address: '2F The Walk, Cebu IT Park, Apas, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.3304,
    longitude: 123.9064,
    priceTier: 'standard',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['24-7', 'call-booths', 'it-park'],
    layout: 'hybrid',
    occupancy: 'light', // holds active reservations for seeker2 & seeker3
    freshnessMinutesAgo: 3,
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 5,
    hostKey: 'host3',
    name: 'The Company Cebu - IT Park',
    description:
      'Premier Japanese-styled co-working space in Cebu IT Park with gigabit fiber, acoustic meeting suites, standing desks, and skyline views.',
    address: '6F Mabuhay Tower, Cebu IT Park, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.3316,
    longitude: 123.9073,
    priceTier: 'premium',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['skyline-view', 'enterprise-fiber', 'boardrooms'],
    layout: 'hybrid',
    occupancy: 'busy',
    freshnessMinutesAgo: 8,
    photos: ['coworking-lounge.jpg', 'silent-study-hall.jpg', 'study-cafe.jpg'],
  },
  {
    index: 6,
    hostKey: 'host3',
    name: 'The Company Cebu - Mandaue',
    description:
      'Bright, spacious co-working floor in Mandaue designed for creative teams, founders, and quiet solo deep work.',
    address: 'JDN Square, P. Remedio St., Banilad, Mandaue City',
    opensAt: '08:00',
    closesAt: '21:00',
    latitude: 10.3418,
    longitude: 123.9225,
    priceTier: 'premium',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['team-suites', 'free-coffee'],
    layout: 'seat_room',
    occupancy: 'moderate',
    freshnessMinutesAgo: 10,
    photos: ['coworking-lounge.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 7,
    hostKey: 'host4',
    name: 'Mindspace Study Hub - CIT-U',
    description:
      'Student-favorite study hub right across CIT-University along N. Bacalso Ave. with dedicated quiet cubicles, group rooms, and affordable hourly rates.',
    address: 'N. Bacalso Ave. (across CIT-U), Cebu City',
    opensAt: '08:00',
    closesAt: '02:00',
    latitude: 10.2946,
    longitude: 123.8805,
    priceTier: 'budget',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_silent', 'ac_full'],
    customTags: ['cit-u', 'engineering-study', 'quiet-cubicles'],
    layout: 'hybrid',
    occupancy: 'light',
    freshnessMinutesAgo: 4,
    photos: ['silent-study-hall.jpg', 'study-cafe.jpg', 'coworking-lounge.jpg'],
  },
  {
    index: 8,
    hostKey: 'host4',
    name: 'Espacio Co-Working - Talisay',
    description:
      'South Cebu co-working and study lounge in San Isidro, Talisay City serving USJ-R Basak students and south-side remote professionals.',
    address: 'Zone 3 Siba St., San Isidro, Talisay City, Cebu',
    opensAt: '09:00',
    closesAt: '23:00',
    latitude: 10.2598,
    longitude: 123.8492,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['south-cebu', 'talisay', 'printing'],
    layout: 'seat_room',
    occupancy: 'light',
    freshnessMinutesAgo: 7,
    photos: ['study-cafe.jpg', 'coworking-lounge.jpg'],
  },
  {
    index: 9,
    hostKey: 'host2',
    name: "Nomad's Hub - Lahug",
    description:
      'Round-the-clock co-working and study hub in Lahug minutes from UP Cebu and IT Park. Frequently packed during finals week.',
    address: 'Salinas Drive, Lahug, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.3269,
    longitude: 123.9022,
    priceTier: 'standard',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['24-7', 'backup-generator'],
    layout: 'hybrid',
    occupancy: 'full', // 100% full state!
    freshnessMinutesAgo: 6,
    photos: ['coworking-lounge.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 10,
    hostKey: 'host5',
    name: 'Sync Work + Study Hub - Talamban',
    description:
      'Modern study lounge just outside USC Talamban Campus with individual desk lamps, standing counters, and late-night thesis sprint passes.',
    address: 'Gov. M. Cuenco Ave., Talamban, Cebu City',
    opensAt: '08:00',
    closesAt: '02:00',
    latitude: 10.3558,
    longitude: 123.9126,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['usc-tc', 'thesis-friendly', 'desk-lamps'],
    layout: 'seat_standing',
    occupancy: 'moderate',
    freshnessMinutesAgo: 9,
    photos: ['silent-study-hall.jpg', 'study-cafe.jpg'],
  },
  {
    index: 11,
    hostKey: 'host3',
    name: 'From Here Coworking - IT Park',
    description:
      'Design-forward co-working studio inside Crossroads / IT Park corridor offering ergonomic workstations, podcast-grade booths, and specialty coffee.',
    address: '8F Filinvest Cyberzone, Cebu IT Park, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.3292,
    longitude: 123.9052,
    priceTier: 'premium',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['specialty-coffee', 'phone-booths'],
    layout: 'hybrid',
    occupancy: 'light',
    freshnessMinutesAgo: 11,
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 12,
    hostKey: 'host3',
    name: 'Enspace Cebu - IT Park',
    description:
      'Tech-community co-working floor in Cebu IT Park with 24-hour keycard access, standing desk bays, and conference rooms.',
    address: '11F Latitude Corporate Center, Cebu Business Park, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.3176,
    longitude: 123.9058,
    priceTier: 'premium',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['startup-hub', '24-7'],
    layout: 'hybrid',
    occupancy: 'moderate',
    freshnessMinutesAgo: 140, // aging
    photos: ['coworking-lounge.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 13,
    hostKey: 'host4',
    name: 'Desko Study Lounge - P. del Rosario',
    description:
      'No-frills, ultra-quiet study desks a 2-minute walk from USC Downtown and UC Main with strong air-conditioning and reliable fiber.',
    address: 'P. del Rosario St., Kamagayan, Cebu City',
    opensAt: '07:00',
    closesAt: '23:00',
    latitude: 10.3001,
    longitude: 123.8986,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_silent', 'ac_full'],
    customTags: ['usc-main', 'board-exam'],
    layout: 'seats_only',
    occupancy: 'busy',
    freshnessMinutesAgo: 5,
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 14,
    hostKey: 'host5',
    name: 'Productive Spaces - Banilad',
    description:
      'Well-lit Banilad study and work studio near UC Banilad with private study rooms, standing desks, and complimentary iced tea.',
    address: 'Gov. M. Cuenco Ave., Banilad, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.3401,
    longitude: 123.9122,
    priceTier: 'standard',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['uc-banilad', 'free-drinks'],
    layout: 'hybrid',
    occupancy: 'light',
    freshnessMinutesAgo: 14,
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg'],
  },
  {
    index: 15,
    hostKey: 'host3',
    name: 'The Mill Lifestyle & Coworking - Ayala',
    description:
      'Executive co-working lounge steps from Ayala Center Cebu with acoustic glass meeting suites and barista-grade espresso.',
    address: 'Mindanao Ave., Cebu Business Park, Cebu City',
    opensAt: '08:00',
    closesAt: '20:00',
    latitude: 10.3189,
    longitude: 123.9044,
    priceTier: 'premium',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['ayala', 'meeting-suites'],
    layout: 'rooms_only',
    occupancy: 'light',
    freshnessMinutesAgo: 6,
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 16,
    hostKey: 'host4',
    name: 'Study Nook - Urgello',
    description:
      'Cozy late-night review nook on Urgello St. tailored for SWU medical and nursing students pulling pre-exam all-nighters.',
    address: 'Urgello St., Sambag I, Cebu City',
    opensAt: '08:00',
    closesAt: '04:00',
    latitude: 10.3068,
    longitude: 123.8919,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_basic', 'outlets_some', 'noise_silent', 'ac_full'],
    customTags: ['swu', 'all-nighter'],
    layout: 'seats_only',
    occupancy: 'moderate',
    freshnessMinutesAgo: 3200, // stale (> 2 days)
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 17,
    hostKey: 'host1',
    name: 'Cebu City Public Library',
    description:
      'Historic public reading hall on Osmena Blvd. offering free air-conditioned study tables, reference shelves, and silent study zones.',
    address: 'Rizal Memorial Library, Osmena Blvd., Cebu City',
    opensAt: '08:00',
    closesAt: '17:00',
    latitude: 10.3082,
    longitude: 123.8938,
    priceTier: 'free',
    maxWaitWindowMinutes: 15,
    status: 'verified',
    curatedTags: ['wifi_basic', 'outlets_some', 'noise_silent', 'ac_full'],
    customTags: ['public-library', 'free-entry'],
    layout: 'seats_only',
    occupancy: 'moderate',
    freshnessMinutesAgo: 10,
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 18,
    hostKey: 'host5',
    name: 'USC Talamban Learning Commons',
    description:
      'Open-access campus study commons near the Bunzel and LRC corridor with quiet desks and collaborative group tables.',
    address: 'Nasipit, Talamban, Cebu City',
    opensAt: '07:30',
    closesAt: '20:00',
    latitude: 10.3536,
    longitude: 123.9108,
    priceTier: 'free',
    maxWaitWindowMinutes: 15,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_some', 'noise_quiet', 'ac_full'],
    customTags: ['campus-commons', 'usc-tc'],
    layout: 'seat_room',
    occupancy: 'busy',
    freshnessMinutesAgo: 9,
    photos: ['silent-study-hall.jpg', 'coworking-lounge.jpg'],
  },
  {
    index: 19,
    hostKey: 'host2',
    name: 'UP Cebu Library Annex',
    description:
      'Quiet daytime reading wing in Lahug with generous table space, reference access, and cool study rooms.',
    address: 'Gorordo Ave., Lahug, Cebu City',
    opensAt: '08:00',
    closesAt: '19:00',
    latitude: 10.3229,
    longitude: 123.8982,
    priceTier: 'free',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_some', 'noise_silent', 'ac_full'],
    customTags: ['up-cebu', 'quiet-reading'],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 150, // aging
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 20,
    hostKey: 'host5',
    name: '24/7 Study Lounge - Banilad',
    description:
      'Always-open Banilad study room with individual reading lamps, fast Wi-Fi, and unlimited brewed coffee for night owls.',
    address: 'Maria Luisa Rd., Banilad, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.3435,
    longitude: 123.9134,
    priceTier: 'budget',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['24-7', 'banilad'],
    layout: 'seat_standing',
    occupancy: 'light',
    freshnessMinutesAgo: 7,
    photos: ['study-cafe.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 21,
    hostKey: 'host3',
    name: 'KMC Solutions - Skyrise 4B',
    description:
      'Enterprise-grade flexible workspace in Cebu IT Park featuring dual-redundant fiber, ergonomic Herman Miller seating, and conference suites.',
    address: '17F Skyrise 4B, W. Geonzon St., Cebu IT Park, Cebu City',
    opensAt: '08:00',
    closesAt: '19:00',
    latitude: 10.3311,
    longitude: 123.9082,
    priceTier: 'premium',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['enterprise', 'ergonomic'],
    layout: 'hybrid',
    occupancy: 'moderate',
    freshnessMinutesAgo: 8,
    photos: ['coworking-lounge.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 22,
    hostKey: 'host3',
    name: 'Regus - AppleOne Equicom Tower',
    description:
      'Quiet corporate day offices and meeting suites right in Cebu Business Park for client calls and distraction-free workdays.',
    address: '14F AppleOne Equicom Tower, Cebu Business Park, Cebu City',
    opensAt: '08:30',
    closesAt: '18:00',
    latitude: 10.3168,
    longitude: 123.9049,
    priceTier: 'premium',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_silent', 'ac_full'],
    customTags: ['private-offices', 'business-park'],
    layout: 'rooms_only',
    occupancy: 'light',
    freshnessMinutesAgo: 15,
    photos: ['coworking-lounge.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 23,
    hostKey: 'host5',
    name: 'A Space Cebu - Crossroads Banilad',
    description:
      'Creative community co-working hub inside Crossroads Banilad surrounded by coffee shops and restaurants.',
    address: 'Crossroads Mall, Gov. M. Cuenco Ave., Banilad, Cebu City',
    opensAt: '09:00',
    closesAt: '21:00',
    latitude: 10.3366,
    longitude: 123.9112,
    priceTier: 'standard',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['creative-hub', 'crossroads'],
    layout: 'hybrid',
    occupancy: 'moderate',
    freshnessMinutesAgo: 165, // aging
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg'],
  },
  {
    index: 24,
    hostKey: 'host4',
    name: 'Workstation 24 - Colon',
    description:
      'Budget-friendly 24-hour study center near UV Main, UC Main, and USJ-R with clean desks and steady fiber.',
    address: 'Colon St., Kalubihan, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.2969,
    longitude: 123.9011,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['downtown', '24-7'],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 11,
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 25,
    hostKey: 'host4',
    name: 'The Study Hub - N. Bacalso',
    description:
      'Spacious student study hall along N. Bacalso Ave. with whiteboards in group rooms and individual power strips.',
    address: 'N. Bacalso Ave., Duljo Fatima, Cebu City',
    opensAt: '07:00',
    closesAt: '23:00',
    latitude: 10.2932,
    longitude: 123.8789,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['cit-u', 'whiteboards'],
    layout: 'seat_room',
    occupancy: 'moderate',
    freshnessMinutesAgo: 6,
    photos: ['silent-study-hall.jpg', 'study-cafe.jpg'],
  },
  {
    index: 26,
    hostKey: 'host5',
    name: 'Focus Pod Cebu - Talamban',
    description:
      'Acoustic solo pods and group study booths near USC-TC designed for online classes, interviews, and deep coding sessions.',
    address: 'Miñoza St., Talamban, Cebu City',
    opensAt: '09:00',
    closesAt: '01:00',
    latitude: 10.3574,
    longitude: 123.9135,
    priceTier: 'standard',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_silent', 'ac_full'],
    customTags: ['acoustic-pods', 'online-classes'],
    layout: 'seat_room',
    occupancy: 'light',
    freshnessMinutesAgo: 9,
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 27,
    hostKey: 'host4',
    name: 'Brainbox Study Center - Labangon',
    description:
      'Compact neighborhood study hall in Labangon serving CIT-U and SWU reviewees on a tight budget.',
    address: 'Katipunan St., Labangon, Cebu City',
    opensAt: '08:00',
    closesAt: '23:00',
    latitude: 10.2995,
    longitude: 123.8774,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_basic', 'outlets_some', 'noise_quiet', 'ac_full'],
    customTags: ['budget-pick'],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 18,
    photos: ['study-cafe.jpg'],
  },
  {
    index: 28,
    hostKey: 'host5',
    name: 'CoLab Cebu - Mandaue North',
    description:
      'Collaborative study and startup space near UCLM with fast fiber, standing bars, and team rooms.',
    address: 'A.C. Cortes Ave., Alang-Alang, Mandaue City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.3315,
    longitude: 123.9412,
    priceTier: 'standard',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['uclm', 'group-study'],
    layout: 'hybrid',
    occupancy: 'light',
    freshnessMinutesAgo: 7,
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg'],
  },
  {
    index: 29,
    hostKey: 'host5',
    name: 'Loom Coworking - CDU Reclamation',
    description:
      'Calm sunlit workspace near Cebu Doctors University with sound-softened study desks and healthy cafe bites.',
    address: 'North Reclamation Area, Mandaue City',
    opensAt: '07:00',
    closesAt: '22:00',
    latitude: 10.3249,
    longitude: 123.9309,
    priceTier: 'standard',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['cdu', 'sunlit'],
    layout: 'hybrid',
    occupancy: 'moderate',
    freshnessMinutesAgo: 12,
    photos: ['coworking-lounge.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 30,
    hostKey: 'host2',
    name: 'The Quiet Loft - USPF Lahug',
    description:
      'Newly opened silent reading loft across USPF Lahug with strict no-call policy and desk lamps at every seat.',
    address: 'Salinas Drive, Lahug, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.3296,
    longitude: 123.9005,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_silent', 'ac_full'],
    customTags: ['uspf', 'strict-silence'],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 5,
    photos: [], // no-photo placeholder state!
  },
  {
    index: 31,
    hostKey: 'host4',
    name: 'Talisay Community Study Hall',
    description:
      'Free breezy municipal reading pavilion near Basak and Talisay with open windows, ceiling fans, and shared charging stations.',
    address: 'Poblacion, Talisay City, Cebu',
    opensAt: '08:00',
    closesAt: '18:00',
    latitude: 10.2449,
    longitude: 123.8485,
    priceTier: 'free',
    maxWaitWindowMinutes: 15,
    status: 'verified',
    curatedTags: ['wifi_basic', 'outlets_some', 'noise_quiet', 'ac_natural'],
    customTags: ['free-entry', 'open-air'],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 4500, // stale (> 3 days)
    photos: [], // no-photo + New (0 reviews)
  },
  {
    index: 32,
    hostKey: 'host2',
    name: 'Breeze Open-Air Study Garden - Busay Rd',
    description:
      'Shaded garden study patio along Cebu Transcentral Highway with cool mountain air, standing counters, and specialty pour-overs.',
    address: 'Nivel Hills, Lahug, Cebu City',
    opensAt: '09:00',
    closesAt: '21:00',
    latitude: 10.3352,
    longitude: 123.8962,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_some', 'noise_moderate', 'ac_natural'],
    customTags: ['garden-patio', 'pour-over'],
    layout: 'seat_standing',
    occupancy: 'light',
    freshnessMinutesAgo: 10,
    photos: ['study-cafe.jpg'],
  },
  {
    index: 33,
    hostKey: 'host4',
    name: 'Sanciangko Desk Club',
    description:
      'Simple, clean student study room right beside UC Main on Sanciangko Street.',
    address: 'Sanciangko St., Kalubihan, Cebu City',
    opensAt: '07:00',
    closesAt: '23:59',
    latitude: 10.2986,
    longitude: 123.8994,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: [], // untagged state!
    customTags: [],
    layout: 'seats_only',
    occupancy: 'moderate',
    freshnessMinutesAgo: 15,
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 34,
    hostKey: 'host4',
    name: 'Magallanes Co-Study',
    description:
      'Freshly verified downtown study space near USJ-R Main; seat map layout is currently being finalized by the host.',
    address: 'Magallanes St., Ermita, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.2936,
    longitude: 123.8996,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['usjr-main'],
    layout: 'empty', // empty seat map state!
    occupancy: 'light',
    freshnessMinutesAgo: 5,
    photos: ['study-cafe.jpg'],
  },
  {
    index: 35,
    hostKey: 'host4',
    name: 'Basak Tech Study Lounge',
    description:
      'Quiet neighborhood study hub near USJ-R Basak Campus with dual-screen standing desks and fast fiber.',
    address: 'N. Bacalso Ave., Basak Pardo, Cebu City',
    opensAt: '08:00',
    closesAt: '23:00',
    latitude: 10.2889,
    longitude: 123.8654,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['usjr-basak', 'fast-fiber'],
    layout: 'seat_standing',
    occupancy: 'light',
    freshnessMinutesAgo: 8,
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 36,
    hostKey: 'host5',
    name: 'Mactan Bridge Workhub - UCLM',
    description:
      'Modern riverfront co-working space minutes from UCLM and Mactan Bridge with private pods and spacious study tables.',
    address: 'A.C. Cortes Ave., Looc, Mandaue City',
    opensAt: '07:00',
    closesAt: '23:00',
    latitude: 10.3302,
    longitude: 123.9438,
    priceTier: 'standard',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['uclm', 'riverfront'],
    layout: 'hybrid',
    occupancy: 'moderate',
    freshnessMinutesAgo: 6,
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg'],
  },
  {
    index: 37,
    hostKey: 'host1',
    name: 'Jones Avenue Study Commons',
    description:
      '24-hour Osmena Blvd. study space midway between SWU and USC Main. Seat map coming soon.',
    address: 'Osmena Blvd., Sambag II, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.3059,
    longitude: 123.8947,
    priceTier: 'standard',
    maxWaitWindowMinutes: 60,
    status: 'verified',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['24-7', 'jones-ave'],
    layout: 'empty', // empty seat map + no photo + New
    occupancy: 'light',
    freshnessMinutesAgo: 5,
    photos: [],
  },
  {
    index: 38,
    hostKey: 'host3',
    name: 'Cebu IT Park Night Owl Desk',
    description:
      'Dedicated graveyard-shift study and co-working room open strictly from 6 PM to 6 AM for remote engineers and night reviewees.',
    address: '3F Garden Bloc, Cebu IT Park, Cebu City',
    opensAt: '18:00',
    closesAt: '06:00',
    latitude: 10.3308,
    longitude: 123.9056,
    priceTier: 'standard',
    maxWaitWindowMinutes: 45,
    status: 'verified',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_silent', 'ac_full'],
    customTags: ['overnight', 'graveyard-shift'],
    layout: 'seat_standing',
    occupancy: 'light',
    freshnessMinutesAgo: 4,
    photos: ['silent-study-hall.jpg', 'coworking-lounge.jpg'],
  },

  // ── PENDING (39–44 — visible in /admin Verification Queue) ─────────────────
  {
    index: 39,
    hostKey: 'host4',
    name: 'Pardo Study Corner',
    description:
      'Brand-new study cafe in Pardo with quiet cubicles, fast fiber, and complimentary brewed coffee awaiting initial verification.',
    address: 'N. Bacalso Ave., Pardo, Cebu City',
    opensAt: '08:00',
    closesAt: '23:00',
    latitude: 10.2815,
    longitude: 123.8594,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'pending',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['pardo', 'new-opening'],
    layout: 'seat_room',
    occupancy: 'light',
    freshnessMinutesAgo: 15,
    photos: ['study-cafe.jpg', 'silent-study-hall.jpg'],
  },
  {
    index: 40,
    hostKey: 'host1',
    name: 'Capitol Site Focus Studio',
    description:
      'Bright study studio near Cebu Provincial Capitol with standing desks, quiet booths, and group rooms.',
    address: 'Escario St., Capitol Site, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.3161,
    longitude: 123.8907,
    priceTier: 'standard',
    maxWaitWindowMinutes: 60,
    status: 'pending',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['capitol', 'ergonomic'],
    layout: 'hybrid',
    occupancy: 'light',
    freshnessMinutesAgo: 20,
    photos: ['coworking-lounge.jpg'],
  },
  {
    index: 41,
    hostKey: 'host5',
    name: 'A.S. Fortuna Cowork Hub',
    description:
      'Relocated Mandaue co-working hub awaiting re-verification after moving to a larger floor on A.S. Fortuna St.',
    address: '3F Oakridge Annex, A.S. Fortuna St., Banilad, Mandaue City',
    opensAt: '08:00',
    closesAt: '21:00',
    latitude: 10.3372,
    longitude: 123.9209,
    priceTier: 'standard',
    maxWaitWindowMinutes: 45,
    status: 'pending',
    reverifyIdentityEdit: {
      oldName: 'AS Fortuna Desk Loft',
      oldAddress: '2F A.S. Fortuna St., Banilad, Mandaue City',
      oldLatitude: 10.3365,
      oldLongitude: 123.9201,
    },
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_moderate', 'ac_full'],
    customTags: ['oakridge', 'relocated'],
    layout: 'hybrid',
    occupancy: 'light',
    freshnessMinutesAgo: 25,
    photos: ['coworking-lounge.jpg', 'study-cafe.jpg'],
  },
  {
    index: 42,
    hostKey: 'host2',
    name: 'Guadalupe Quiet Desk',
    description:
      'Minimal neighborhood study room submission in Guadalupe — host has not built the seat map or uploaded photos yet.',
    address: 'V. Rama Ave., Guadalupe, Cebu City',
    opensAt: '09:00',
    closesAt: '21:00',
    latitude: 10.3198,
    longitude: 123.8825,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'pending',
    curatedTags: ['wifi_basic', 'outlets_some'],
    customTags: [],
    layout: 'empty',
    occupancy: 'light',
    freshnessMinutesAgo: 30,
    photos: [],
  },
  {
    index: 43,
    hostKey: 'host2',
    name: 'Mabolo Study Spot',
    description:
      'Cozy Mabolo study nook near Cebu Business Park; submitted without map coordinates yet.',
    address: 'Pope John Paul II Ave., Mabolo, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: null,
    longitude: null,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'pending',
    curatedTags: ['wifi_fast', 'ac_full'],
    customTags: ['mabolo'],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 35,
    photos: ['study-cafe.jpg'],
  },
  {
    index: 44,
    hostKey: 'host5',
    name: 'Talamban Night Study Hub',
    description:
      'Overnight study space near USC-TC open from 7 PM to 5 AM for engineering and architecture students.',
    address: 'Cabancalan-Talamban Rd., Cebu City',
    opensAt: '19:00',
    closesAt: '05:00',
    latitude: 10.3522,
    longitude: 123.9141,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'pending',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['overnight', 'usc-tc'],
    layout: 'seat_standing',
    occupancy: 'light',
    freshnessMinutesAgo: 18,
    photos: ['silent-study-hall.jpg'],
  },

  // ── REJECTED (45–47 — with status_reason for Host resubmission) ────────────
  {
    index: 45,
    hostKey: 'host4',
    name: 'Colon Express Desk',
    description: 'Compact daytime study desks in downtown Colon.',
    address: 'Colon St., Cebu City',
    opensAt: '08:00',
    closesAt: '20:00',
    latitude: 10.2962,
    longitude: 123.9004,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'rejected',
    statusReason:
      'Street address is too vague; please include building name and floor number.',
    curatedTags: ['wifi_basic', 'ac_full'],
    customTags: [],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 200,
    photos: [],
  },
  {
    index: 46,
    hostKey: 'host1',
    name: 'Urgello 24H Study Room',
    description: '24-hour review room near SWU PHINMA.',
    address: 'Urgello St., Sambag I, Cebu City',
    opensAt: '00:00',
    closesAt: '00:00',
    latitude: 10.3075,
    longitude: 123.8906,
    priceTier: 'budget',
    maxWaitWindowMinutes: 45,
    status: 'rejected',
    statusReason:
      'Uploaded venue photos are too dark to verify seating; please upload clear interior photos.',
    curatedTags: ['wifi_fast', 'outlets_all', 'ac_full'],
    customTags: ['swu'],
    layout: 'seats_only',
    occupancy: 'light',
    freshnessMinutesAgo: 300,
    photos: [],
  },
  {
    index: 47,
    hostKey: 'host5',
    name: 'Mandaue Loft Desk',
    description: 'Second-floor study loft near Mandaue Centro.',
    address: 'Plaridel St., Centro, Mandaue City',
    opensAt: '09:00',
    closesAt: '21:00',
    latitude: 10.3274,
    longitude: 123.9419,
    priceTier: 'standard',
    maxWaitWindowMinutes: 45,
    status: 'rejected',
    statusReason:
      'Operating hours and business signage could not be confirmed; please update description and resubmit.',
    curatedTags: ['wifi_fast', 'outlets_some', 'noise_quiet', 'ac_full'],
    customTags: [],
    layout: 'seat_standing',
    occupancy: 'light',
    freshnessMinutesAgo: 400,
    photos: ['study-cafe.jpg'],
  },

  // ── TAKEN DOWN (48–50 — admin take-down & reinstatement flows) ─────────────
  {
    index: 48,
    hostKey: 'host1',
    name: 'Fuente Circle Study Hub',
    description:
      'Central study hub overlooking Fuente Osmena Circle; temporarily taken down during electrical upgrades.',
    address: 'Fuente Osmena Cir., Sta. Cruz, Cebu City',
    opensAt: '07:00',
    closesAt: '23:00',
    latitude: 10.3102,
    longitude: 123.8935,
    priceTier: 'standard',
    maxWaitWindowMinutes: 45,
    status: 'taken_down',
    statusReason:
      'Temporarily closed for electrical rewiring; reinstate once safety inspection passes.',
    curatedTags: ['wifi_fast', 'outlets_all', 'noise_quiet', 'ac_full'],
    customTags: ['fuente'],
    layout: 'seat_room',
    occupancy: 'light',
    freshnessMinutesAgo: 1440,
    photos: ['silent-study-hall.jpg'],
  },
  {
    index: 49,
    hostKey: 'host2',
    name: 'Lahug Plaza Desk Bar',
    description: 'Evening desk bar in Lahug suspended pending occupancy accuracy review.',
    address: 'Gorordo Ave., Lahug, Cebu City',
    opensAt: '10:00',
    closesAt: '02:00',
    latitude: 10.3248,
    longitude: 123.8999,
    priceTier: 'budget',
    maxWaitWindowMinutes: 30,
    status: 'taken_down',
    statusReason:
      'Multiple Seeker reports of inaccurate seat availability and unannounced closures.',
    curatedTags: ['wifi_fast', 'outlets_some', 'ac_full'],
    customTags: ['lahug'],
    layout: 'seat_standing',
    occupancy: 'light',
    freshnessMinutesAgo: 2880,
    photos: ['study-cafe.jpg'],
  },
  {
    index: 50,
    hostKey: 'host3',
    name: 'Banilad Annex Pods',
    description:
      'Private focus pods in Banilad temporarily suspended at host request during floor renovation.',
    address: 'Gov. M. Cuenco Ave., Banilad, Cebu City',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: 10.3388,
    longitude: 123.9125,
    priceTier: 'premium',
    maxWaitWindowMinutes: 60,
    status: 'taken_down',
    statusReason: 'Host requested temporary suspension during floor renovation.',
    curatedTags: ['wifi_ultrafast', 'outlets_all', 'noise_silent', 'ac_full'],
    customTags: ['pods'],
    layout: 'rooms_only',
    occupancy: 'light',
    freshnessMinutesAgo: 1500,
    photos: ['coworking-lounge.jpg'],
  },
]

export function buildDemoCatalog() {
  let zoneSeq = 1
  let unitSeq = 1

  const spaces = RAW_SPACES.map((raw) => {
    const id = demoUuid('50000000', raw.index)
    const zones = buildPresetLayout(raw.layout, raw.occupancy).map((z) => {
      const zoneId = demoUuid('51000000', zoneSeq++)
      const units = z.units.map((u) => ({
        id: demoUuid('52000000', unitSeq++),
        spaceId: id,
        zoneId,
        unitType: u.type,
        label: u.label,
        capacity: u.cap,
        gridRow: u.row,
        gridCol: u.col,
        colSpan: u.span,
        hostState: u.hostState,
      }))
      return {
        id: zoneId,
        spaceId: id,
        name: z.name,
        position: z.position,
        units,
      }
    })

    return {
      ...raw,
      id,
      zones,
    }
  })

  return {
    users: DEMO_USERS,
    spaces,
  }
}

/**
 * Curated reservation, payment, review, report, and moderation scenarios
 * covering every enum value and substate across the 50 spaces.
 */
export const DEMO_SCENARIOS = {
  // Active holds (note: seeker1 = seeker@example.test is kept FREE for live demo booking!)
  activeHolds: [
    {
      // seeker2 has a paid `reserved` hold ready for Host Check-in Desk scan/entry!
      index: 1,
      seekerKey: 'seeker2',
      spaceIndex: 4, // Workplace Cafe - IT Park (24h)
      unitLabel: 'S1',
      status: 'reserved',
      bookingToken: 'DEMO20260001',
      waitWindowMinutes: 60,
      paymentStatus: 'paid',
    },
    {
      // seeker3 is currently `occupied` (checked-in) ready for Host Check-out/Release!
      index: 2,
      seekerKey: 'seeker3',
      spaceIndex: 4, // Workplace Cafe - IT Park (24h)
      unitLabel: 'S2',
      status: 'occupied',
      bookingToken: 'DEMO20260002',
      waitWindowMinutes: 60,
      paymentStatus: 'paid',
    },
    {
      // seeker4 has an in-flight `pending_payment` hold
      index: 3,
      seekerKey: 'seeker4',
      spaceIndex: 1, // Workplace Cafe - Ramos (24h)
      unitLabel: 'S1',
      status: 'pending_payment',
      bookingToken: null,
      waitWindowMinutes: 30,
      paymentStatus: 'pending',
    },
  ],

  // Non-completed historical reservations (cancelled, take-down cancelled, expired, no_show)
  historicalNonCompleted: [
    {
      index: 4,
      seekerKey: 'seeker5',
      spaceIndex: 48, // Fuente Circle Study Hub (taken_down!)
      unitLabel: 'S1',
      status: 'cancelled',
      cancelledByTakeDown: true,
      bookingToken: 'DEMO20260004',
      waitWindowMinutes: 45,
      daysAgo: 3,
      paymentStatus: 'refunded',
      refundReason: 'Space taken down by Administrator before check-in.',
    },
    {
      index: 5,
      seekerKey: 'seeker5',
      spaceIndex: 5, // The Company Cebu - IT Park
      unitLabel: 'S1',
      status: 'cancelled',
      cancelledByTakeDown: false,
      bookingToken: 'DEMO20260005',
      waitWindowMinutes: 60,
      daysAgo: 6,
      paymentStatus: 'paid', // refundable/paid cancelled record for /admin/payments
    },
    {
      index: 6,
      seekerKey: 'seeker5',
      spaceIndex: 7, // Mindspace Study Hub - CIT-U
      unitLabel: 'S1',
      status: 'no_show',
      cancelledByTakeDown: false,
      bookingToken: 'DEMO20260006',
      waitWindowMinutes: 30,
      daysAgo: 8,
      paymentStatus: 'forfeited',
    },
    {
      index: 7,
      seekerKey: 'seeker5',
      spaceIndex: 10, // Sync Work + Study Hub - Talamban
      unitLabel: 'A1',
      status: 'expired',
      cancelledByTakeDown: false,
      bookingToken: null,
      waitWindowMinutes: 45,
      daysAgo: 10,
      paymentStatus: 'pending',
    },
    {
      index: 8,
      seekerKey: 'seeker1',
      spaceIndex: 14, // Productive Spaces - Banilad
      unitLabel: 'S1',
      status: 'cancelled',
      cancelledByTakeDown: false,
      bookingToken: 'DEMO20260008',
      waitWindowMinutes: 45,
      daysAgo: 5,
      paymentStatus: 'refunded',
      refundReason: 'Duplicate sandbox hold refunded at Seeker request.',
    },
  ],

  // Completed visits with paid payments and reviews (high/mid/low, edited, hidden, removed, reported)
  completedVisitsWithReviews: [
    // High-rated spaces (4.5–5.0)
    {
      index: 10,
      seekerKey: 'seeker1',
      spaceIndex: 1, // Workplace Cafe - Ramos
      unitLabel: 'S3',
      daysAgo: 9,
      review: {
        quietness: 5,
        wifi: 5,
        cleanliness: 5,
        comfort: 5,
        comment:
          'Best 24/7 spot on Ramos. Bottomless coffee kept me alive during finals and the fiber never dropped once.',
        status: 'visible',
      },
    },
    {
      index: 11,
      seekerKey: 'seeker6',
      spaceIndex: 1,
      unitLabel: 'S4',
      daysAgo: 4,
      review: {
        quietness: 4,
        wifi: 5,
        cleanliness: 5,
        comfort: 5,
        comment:
          'Updated after my second visit: they added even more outlets near the back booths.',
        status: 'visible',
        edited: true, // version = 2, edited_at set
      },
    },
    {
      index: 12,
      seekerKey: 'seeker2',
      spaceIndex: 4, // Workplace Cafe - IT Park
      unitLabel: 'S3',
      daysAgo: 7,
      review: {
        quietness: 5,
        wifi: 5,
        cleanliness: 4,
        comfort: 5,
        comment:
          'Super fast check-in with the QR code and plenty of quiet desks even at 11 PM.',
        status: 'visible',
      },
    },
    {
      index: 13,
      seekerKey: 'seeker3',
      spaceIndex: 5, // The Company Cebu - IT Park
      unitLabel: 'D1',
      daysAgo: 6,
      review: {
        quietness: 4,
        wifi: 5,
        cleanliness: 5,
        comfort: 5,
        comment: 'Premium feel, great chairs, and crisp gigabit Wi-Fi for Zoom calls.',
        status: 'visible',
      },
    },
    {
      index: 14,
      seekerKey: 'seeker1',
      spaceIndex: 7, // Mindspace Study Hub - CIT-U
      unitLabel: 'S2',
      daysAgo: 5,
      review: {
        quietness: 5,
        wifi: 5,
        cleanliness: 5,
        comfort: 4,
        comment: 'Right across CIT-U! Super quiet cubicles and student-friendly rates.',
        status: 'visible',
      },
    },
    {
      index: 15,
      seekerKey: 'seeker6',
      spaceIndex: 7,
      unitLabel: 'D1',
      daysAgo: 2,
      review: {
        quietness: 5,
        wifi: 4,
        cleanliness: 5,
        comfort: 5,
        comment: null, // rating-only review
        status: 'visible',
      },
    },
    {
      index: 16,
      seekerKey: 'seeker2',
      spaceIndex: 8, // Espacio Co-Working - Talisay
      unitLabel: 'S1',
      daysAgo: 4,
      review: {
        quietness: 5,
        wifi: 4,
        cleanliness: 5,
        comfort: 5,
        comment:
          'Finally a proper quiet study hub in Talisay so I do not have to commute to downtown.',
        status: 'visible',
      },
    },
    {
      index: 17,
      seekerKey: 'seeker3',
      spaceIndex: 10, // Sync Work + Study Hub - Talamban
      unitLabel: 'A2',
      daysAgo: 3,
      review: {
        quietness: 5,
        wifi: 5,
        cleanliness: 4,
        comfort: 5,
        comment: 'Lifesaver for USC-TC thesis nights. Warm desk lamps and cold AC.',
        status: 'visible',
      },
    },
    {
      index: 18,
      seekerKey: 'seeker1',
      spaceIndex: 11, // From Here Coworking - IT Park
      unitLabel: 'S2',
      daysAgo: 8,
      review: {
        quietness: 4,
        wifi: 5,
        cleanliness: 5,
        comfort: 5,
        comment: 'Love the interiors and phone booths. Worth the premium tier.',
        status: 'visible',
      },
    },
    {
      index: 19,
      seekerKey: 'seeker6',
      spaceIndex: 17, // Cebu City Public Library
      unitLabel: 'T1',
      daysAgo: 11,
      review: {
        quietness: 5,
        wifi: 3,
        cleanliness: 4,
        comfort: 4,
        comment:
          'Free entry and genuinely silent reading hall. Bring mobile data as backup.',
        status: 'visible',
      },
    },
    // Mid-rated spaces (3.5–4.2)
    {
      index: 20,
      seekerKey: 'seeker2',
      spaceIndex: 9, // Nomad's Hub - Lahug
      unitLabel: 'S2',
      daysAgo: 6,
      review: {
        quietness: 4,
        wifi: 4,
        cleanliness: 4,
        comfort: 4,
        comment: 'Solid 24/7 Lahug hub, just gets crowded fast after 7 PM.',
        status: 'visible',
      },
    },
    {
      index: 21,
      seekerKey: 'seeker4',
      spaceIndex: 13, // Desko Study Lounge - P. del Rosario
      unitLabel: 'T2',
      daysAgo: 5,
      review: {
        quietness: 4,
        wifi: 4,
        cleanliness: 4,
        comfort: 3,
        comment:
          'Very convenient from USC Main. Chairs are basic but the AC is freezing.',
        status: 'visible',
      },
    },
    {
      index: 22,
      seekerKey: 'seeker3',
      spaceIndex: 23, // A Space Cebu - Crossroads Banilad
      unitLabel: 'S3',
      daysAgo: 7,
      review: {
        quietness: 3,
        wifi: 4,
        cleanliness: 5,
        comfort: 4,
        comment: 'Great vibe and food nearby, though a bit lively during lunch hours.',
        status: 'visible',
      },
    },
    // Low-rated space (2.5)
    {
      index: 23,
      seekerKey: 'seeker6',
      spaceIndex: 27, // Brainbox Study Center - Labangon
      unitLabel: 'T1',
      daysAgo: 9,
      review: {
        quietness: 3,
        wifi: 2,
        cleanliness: 3,
        comfort: 2,
        comment:
          'Wi-Fi slowed down around 6 PM and only a few extension cords were available.',
        status: 'visible',
      },
    },
    // Moderated / reported reviews (populates /admin/moderation!)
    {
      index: 24,
      seekerKey: 'seeker5',
      spaceIndex: 1, // Workplace Cafe - Ramos — OPEN report (reason: spam)
      unitLabel: 'S5',
      daysAgo: 2,
      review: {
        quietness: 5,
        wifi: 5,
        cleanliness: 5,
        comfort: 5,
        comment:
          'Check out my cheap textbook resale page on social media, DM for discounts!',
        status: 'visible',
        openReport: {
          reporterKey: 'seeker1',
          reason: 'spam',
          note: 'Promotional spam unrelated to studying at the venue.',
        },
      },
    },
    {
      index: 25,
      seekerKey: 'seeker5',
      spaceIndex: 4, // Workplace Cafe - IT Park — OPEN report (reason: not_about_space)
      unitLabel: 'S4',
      daysAgo: 1,
      review: {
        quietness: 2,
        wifi: 2,
        cleanliness: 2,
        comfort: 2,
        comment: 'Traffic along Salinas Drive was terrible today so I am giving 2 stars.',
        status: 'visible',
        openReport: {
          reporterKey: 'seeker6',
          reason: 'not_about_space',
          note: 'Complains about street traffic rather than the space itself.',
        },
      },
    },
    {
      index: 26,
      seekerKey: 'seeker5',
      spaceIndex: 5, // The Company Cebu - IT Park — HIDDEN by admin (closed report: hidden)
      unitLabel: 'S2',
      daysAgo: 12,
      review: {
        quietness: 1,
        wifi: 1,
        cleanliness: 1,
        comfort: 1,
        comment: 'Unverified rant that violated community guidelines.',
        status: 'hidden',
        closedReport: {
          reporterKey: 'seeker3',
          reason: 'offensive',
          note: 'Contains abusive language toward staff.',
          outcome: 'hidden',
          modAction: 'hide',
        },
      },
    },
    {
      index: 27,
      seekerKey: 'seeker5',
      spaceIndex: 11, // From Here Coworking — REMOVED by admin (closed report: removed)
      unitLabel: 'S3',
      daysAgo: 14,
      review: {
        quietness: 1,
        wifi: 1,
        cleanliness: 1,
        comfort: 1,
        comment: 'Repeated spam link posted across multiple venues.',
        status: 'removed',
        closedReport: {
          reporterKey: 'seeker1',
          reason: 'spam',
          note: 'Duplicate spam posting.',
          outcome: 'removed',
          modAction: 'remove',
        },
      },
    },
    {
      index: 28,
      seekerKey: 'seeker4',
      spaceIndex: 20, // 24/7 Study Lounge - Banilad — DISMISSED report (kept visible)
      unitLabel: 'A1',
      daysAgo: 10,
      review: {
        quietness: 4,
        wifi: 4,
        cleanliness: 4,
        comfort: 4,
        comment: 'Good late-night desks; brings a jacket because the AC is strong.',
        status: 'visible',
        closedReport: {
          reporterKey: 'seeker5',
          reason: 'other',
          note: 'Disagreed with the temperature comment.',
          outcome: 'dismissed',
          modAction: 'dismiss',
        },
      },
    },
    // Completed visit WITHOUT a review yet (lets seeker1 write a new review in live demo!)
    {
      index: 29,
      seekerKey: 'seeker1',
      spaceIndex: 10, // Sync Work + Study Hub - Talamban
      unitLabel: 'A3',
      daysAgo: 1,
      review: null,
    },
  ],
}

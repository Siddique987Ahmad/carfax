// Curated data for seeding: what Pakistani garages actually see.

export const FIRST_NAMES = [
  'Ahmed',
  'Bilal',
  'Usman',
  'Hamza',
  'Ali',
  'Imran',
  'Faisal',
  'Kashif',
  'Asad',
  'Waqas',
  'Zeeshan',
  'Naveed',
  'Shahid',
  'Tariq',
  'Adnan',
  'Junaid',
  'Salman',
  'Fahad',
  'Omer',
  'Danish',
  'Sara',
  'Ayesha',
  'Fatima',
  'Hira',
  'Sana',
  'Mehwish',
  'Zainab',
  'Amna',
  'Rabia',
  'Nida',
] as const;

export const LAST_NAMES = [
  'Khan',
  'Malik',
  'Butt',
  'Chaudhry',
  'Sheikh',
  'Qureshi',
  'Rana',
  'Awan',
  'Mirza',
  'Raza',
  'Hussain',
  'Iqbal',
  'Siddiqui',
  'Javed',
  'Aslam',
  'Abbasi',
  'Bhatti',
  'Cheema',
  'Gill',
  'Haider',
] as const;

export interface CarModel {
  make: string;
  model: string;
  years: readonly [number, number];
  /** Japanese imports carry a frame number (prefix + serial); local cars a 17-character VIN. */
  framePrefix?: string;
  /** Typical km driven per day. */
  kmPerDay: readonly [number, number];
  weight: number;
}

export const CAR_MODELS: readonly CarModel[] = [
  { make: 'Suzuki', model: 'Mehran', years: [2008, 2019], kmPerDay: [25, 60], weight: 10 },
  { make: 'Suzuki', model: 'Alto', years: [2019, 2025], kmPerDay: [25, 55], weight: 12 },
  { make: 'Suzuki', model: 'Cultus', years: [2017, 2025], kmPerDay: [30, 60], weight: 8 },
  { make: 'Suzuki', model: 'Wagon R', years: [2014, 2024], kmPerDay: [30, 60], weight: 7 },
  { make: 'Suzuki', model: 'Swift', years: [2018, 2025], kmPerDay: [30, 60], weight: 4 },
  { make: 'Toyota', model: 'Corolla', years: [2010, 2025], kmPerDay: [35, 80], weight: 14 },
  { make: 'Toyota', model: 'Yaris', years: [2020, 2025], kmPerDay: [30, 70], weight: 6 },
  { make: 'Honda', model: 'City', years: [2012, 2025], kmPerDay: [30, 70], weight: 9 },
  { make: 'Honda', model: 'Civic', years: [2012, 2025], kmPerDay: [35, 80], weight: 8 },
  { make: 'KIA', model: 'Sportage', years: [2019, 2025], kmPerDay: [35, 75], weight: 4 },
  { make: 'KIA', model: 'Picanto', years: [2019, 2025], kmPerDay: [25, 50], weight: 3 },
  { make: 'Hyundai', model: 'Tucson', years: [2020, 2025], kmPerDay: [35, 75], weight: 3 },
  {
    make: 'Toyota',
    model: 'Aqua',
    years: [2012, 2020],
    framePrefix: 'NHP10',
    kmPerDay: [30, 70],
    weight: 6,
  },
  {
    make: 'Toyota',
    model: 'Vitz',
    years: [2011, 2020],
    framePrefix: 'KSP130',
    kmPerDay: [25, 60],
    weight: 5,
  },
  {
    make: 'Toyota',
    model: 'Prius',
    years: [2010, 2018],
    framePrefix: 'ZVW30',
    kmPerDay: [35, 80],
    weight: 2,
  },
  {
    make: 'Honda',
    model: 'Vezel',
    years: [2014, 2021],
    framePrefix: 'RU3',
    kmPerDay: [30, 70],
    weight: 3,
  },
  {
    make: 'Daihatsu',
    model: 'Mira',
    years: [2013, 2021],
    framePrefix: 'LA300S',
    kmPerDay: [20, 50],
    weight: 3,
  },
];

export interface GarageSeed {
  name: string;
  city: 'Lahore' | 'Islamabad';
  address: string;
  lat: number;
  lng: number;
  status: 'active' | 'pending' | 'suspended';
}

export const DEV_GARAGES: readonly GarageSeed[] = [
  {
    name: 'Ahmed Motors',
    city: 'Lahore',
    address: 'Nicholson Road',
    lat: 31.5609,
    lng: 74.3378,
    status: 'active',
  },
  {
    name: 'Bilal Autos',
    city: 'Lahore',
    address: 'Montgomery Road',
    lat: 31.5546,
    lng: 74.3285,
    status: 'active',
  },
  {
    name: 'Punjab Car Care',
    city: 'Lahore',
    address: 'Johar Town, Block G',
    lat: 31.4697,
    lng: 74.2728,
    status: 'active',
  },
  {
    name: 'Gulberg Auto Workshop',
    city: 'Lahore',
    address: 'Gulberg III, Main Boulevard',
    lat: 31.5112,
    lng: 74.3434,
    status: 'active',
  },
  {
    name: 'Model Town Motors',
    city: 'Lahore',
    address: 'Model Town Link Road',
    lat: 31.4805,
    lng: 74.3239,
    status: 'pending',
  },
  {
    name: 'Capital Auto Clinic',
    city: 'Islamabad',
    address: 'I-9 Markaz',
    lat: 33.6573,
    lng: 73.0475,
    status: 'active',
  },
  {
    name: 'Margalla Motors',
    city: 'Islamabad',
    address: 'G-9 Markaz',
    lat: 33.6938,
    lng: 73.0281,
    status: 'active',
  },
  {
    name: 'Twin City Garage',
    city: 'Islamabad',
    address: 'I-10 Markaz',
    lat: 33.6447,
    lng: 73.0371,
    status: 'suspended',
  },
];

/** Work types with how often they come up, and price ranges in rupees (part, labour). */
export const WORK: readonly {
  type: string;
  weight: number;
  part?: readonly [string, number, number];
  labour: readonly [number, number];
}[] = [
  {
    type: 'oil_change',
    weight: 50,
    part: ['Engine oil + filter', 5000, 11000],
    labour: [500, 1000],
  },
  { type: 'tuning', weight: 15, part: ['Spark plugs', 1200, 4000], labour: [1500, 3000] },
  { type: 'brakes', weight: 10, part: ['Brake pads', 3000, 9000], labour: [800, 1500] },
  { type: 'suspension', weight: 7, part: ['Shock absorbers', 8000, 25000], labour: [1500, 4000] },
  { type: 'ac', weight: 5, part: ['AC gas refill', 3000, 7000], labour: [1000, 2500] },
  { type: 'electrical', weight: 5, part: ['Battery', 12000, 30000], labour: [500, 1500] },
  { type: 'engine', weight: 4, part: ['Gasket set', 5000, 20000], labour: [5000, 15000] },
  {
    type: 'denting_painting',
    weight: 4,
    part: ['Paint and filler', 6000, 25000],
    labour: [5000, 20000],
  },
];

export const BODY_WORK_NOTES = [
  'Front bumper repaint',
  'Rear bumper repaint',
  'Right front fender replaced',
  'Bonnet dent removed and repainted',
  'Left door denting and paint',
  'Boot lid repaint',
] as const;

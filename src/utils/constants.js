export const GRID_SIZE = 200;
export const CELL_SIZE = 1;

export const CELL_TYPES = {
  EMPTY: 0,
  ROAD: 1,
  BUILDING: 2,
  WATER: 3,
  FOREST: 4,
  FARM: 5,
  MARKET: 6,
  PLAZA: 7
};

export const BUILDING_TYPES = {
  COTTAGE: 'cottage',
  MANOR: 'manor',
  CATHEDRAL: 'cathedral',
  MILL: 'mill',
  BLACKSMITH: 'blacksmith',
  INN: 'inn',
  FARM: 'farm',
  GUILD_HALL: 'guild_hall',
  GATE: 'gate'
};

export const ZONES = {
  MARKET: 'market',
  RESIDENTIAL: 'residential',
  INDUSTRIAL: 'industrial',
  RELIGIOUS: 'religious'
};

export const ROAD_LEVELS = {
  DIRT: 0,
  COBBLESTONE: 1,
  BOULEVARD: 2
};

export const SEASONS = {
  SPRING: 0,
  SUMMER: 1,
  AUTUMN: 2,
  WINTER: 3
};

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const SEASON_ICONS = ['\u2698', '\u2600', '\u2767', '\u2744'];

// Timing: 3 real minutes = 1 in-game day (~160 days in 8 hours)
export const REAL_SECONDS_PER_GAME_DAY = 180;
export const GAME_HOURS_PER_DAY = 24;
export const DAYS_PER_SEASON = 30;
export const DAYS_PER_YEAR = 120;

// Time of day thresholds (in game hours 0-24)
export const DAWN_START = 5;
export const DAWN_END = 7;
export const DUSK_START = 18;
export const DUSK_END = 20;
export const NIGHT_START = 20;
export const NIGHT_END = 5;

// Growth pacing (real seconds)
export const SEED_PHASE_END = 5;        // Seeds placed immediately, roads start fast
export const EARLY_ROADS_END = 60;      // Primary roads form in first minute
export const EXPANSION_PHASE_END = 300; // Buildings + secondary roads 1-5 min
export const MATURITY_PHASE_END = 1440;

// Simulation
export const MAX_CITIZENS = 50;
export const CATHEDRAL_POP_THRESHOLD = 20;
export const DECAY_DAYS_THRESHOLD = 10;
export const TRAFFIC_COBBLESTONE = 50;
export const TRAFFIC_BOULEVARD = 200;
export const SNAPSHOT_INTERVAL_SEC = 60;
export const MAX_SNAPSHOTS = 480;

// Visual
export const FOG_COLOR_DAY = 0x8fa5a5;
export const FOG_COLOR_NIGHT = 0x0a0f1a;
export const SUN_COLOR = 0xfff4e0;
export const MOON_COLOR = 0x6688bb;
export const AMBIENT_DAY = 0x9eb8c2;
export const AMBIENT_NIGHT = 0x2a3348;
export const TORCH_COLOR = 0xff9944;
export const WINDOW_GLOW_COLOR = 0xffaa44;

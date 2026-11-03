export const GRID_SIZE = 10;

export type TileType = 'empty' | 'road' | 'house' | 'park' | 'shop' | 'service';

export interface City {
  version: 1;
  tiles: TileType[];
  day: number;
  budget: number;
  population: number;
  happiness: number;
}

export interface CityStats {
  population: number;
  jobs: number;
  happiness: number;
  income: number;
  expenses: number;
  connectedHomes: number;
  capacity: number;
}

export const COSTS: Record<TileType, number> = {
  empty: 0,
  road: 12,
  house: 100,
  park: 55,
  shop: 150,
  service: 240,
};

const MAINTENANCE: Record<TileType, number> = {
  empty: 0,
  road: 1,
  house: 1,
  park: 3,
  shop: 4,
  service: 10,
};

const TILE_TYPES: readonly TileType[] = ['empty', 'road', 'house', 'park', 'shop', 'service'];
const TILE_COUNT = GRID_SIZE * GRID_SIZE;
const MAX_HOME_CAPACITY = 8;

function isTileType(value: unknown): value is TileType {
  return typeof value === 'string' && TILE_TYPES.includes(value as TileType);
}

function neighbors(index: number): number[] {
  const result: number[] = [];
  if (index >= GRID_SIZE) result.push(index - GRID_SIZE);
  if (index < TILE_COUNT - GRID_SIZE) result.push(index + GRID_SIZE);
  if (index % GRID_SIZE !== 0) result.push(index - 1);
  if (index % GRID_SIZE !== GRID_SIZE - 1) result.push(index + 1);
  return result;
}

function connectedRoads(city: City): Set<number> {
  const connected = new Set<number>();
  const queue: number[] = [];
  // Every west-edge road is an entrance, including the marked entrance at 40.
  for (let index = 0; index < TILE_COUNT; index += GRID_SIZE) {
    if (city.tiles[index] === 'road') {
      connected.add(index);
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const index of neighbors(queue[cursor])) {
      if (city.tiles[index] === 'road' && !connected.has(index)) {
        connected.add(index);
        queue.push(index);
      }
    }
  }
  return connected;
}

function hasRoadAccess(city: City, index: number, roads: Set<number>): boolean {
  if (city.tiles[index] === 'empty') return false;
  return roads.has(index) || neighbors(index).some((neighbor) => roads.has(neighbor));
}

/** Roads must reach the west edge; buildings need an orthogonally adjacent road. */
export function isRoadConnected(city: City, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= TILE_COUNT) return false;
  return hasRoadAccess(city, index, connectedRoads(city));
}

function distance(a: number, b: number): number {
  return Math.abs(Math.floor(a / GRID_SIZE) - Math.floor(b / GRID_SIZE))
    + Math.abs(a % GRID_SIZE - b % GRID_SIZE);
}

export function getStats(city: City): CityStats {
  const roads = connectedRoads(city);
  const homes: number[] = [];
  const parks: number[] = [];
  const services: number[] = [];
  let shops = 0;
  let expenses = 0;
  for (let index = 0; index < TILE_COUNT; index++) {
    const tile = city.tiles[index];
    expenses += MAINTENANCE[tile];
    if (tile === 'park') parks.push(index);
    if (!hasRoadAccess(city, index, roads)) continue;
    if (tile === 'house') homes.push(index);
    if (tile === 'service') services.push(index);
    if (tile === 'shop') shops++;
  }

  const jobs = shops * 6 + services.length * 2;
  let capacity = 0;
  let parkHomes = 0;
  let servedHomes = 0;
  for (const home of homes) {
    const served = services.some((service) => distance(home, service) <= 3);
    const green = parks.some((park) => distance(home, park) <= 2);
    if (served) servedHomes++;
    if (green) parkHomes++;
    capacity += 4 + (jobs > 0 ? 2 : 0) + (served ? 2 : 0);
  }

  const totalHomes = city.tiles.filter((tile) => tile === 'house').length;
  const access = totalHomes === 0 ? 1 : homes.length / totalHomes;
  const greenCoverage = homes.length === 0 ? 0 : parkHomes / homes.length;
  const serviceCoverage = homes.length === 0 ? 0 : servedHomes / homes.length;
  const employment = city.population === 0 ? (jobs > 0 ? 1 : 0) : Math.min(1, jobs / city.population);
  const overcrowding = Math.max(0, city.population - capacity) * 2;
  const happiness = Math.max(0, Math.min(100, Math.round(
    45 + access * 20 + greenCoverage * 20 + serviceCoverage * 10 + employment * 10 - overcrowding,
  )));

  return {
    population: city.population,
    jobs,
    happiness,
    income: city.population * 3 + shops * 8,
    expenses,
    connectedHomes: homes.length,
    capacity,
  };
}

function withHappiness(city: City): City {
  return { ...city, happiness: getStats(city).happiness };
}

export function createCity(preset: 'blank' | 'village' = 'blank'): City {
  const city: City = {
    version: 1,
    tiles: Array<TileType>(TILE_COUNT).fill('empty'),
    day: 0,
    budget: 1500,
    population: 0,
    happiness: 65,
  };
  if (preset === 'village') {
    for (let index = 40; index <= 45; index++) city.tiles[index] = 'road';
    for (const index of [30, 32, 35]) city.tiles[index] = 'house';
    city.tiles[33] = 'park';
    city.tiles[52] = 'shop';
    city.tiles[54] = 'service';
    city.population = 9;
    city.budget = 1050;
  }
  return withHappiness(city);
}

/** Replacement charges the new tile's full cost; bulldozing is free, without refunds. */
export function placeTile(city: City, index: number, type: TileType): City {
  if (!Number.isInteger(index) || index < 0 || index >= TILE_COUNT) {
    throw new Error(`Tile index must be an integer between 0 and ${TILE_COUNT - 1}.`);
  }
  if (!isTileType(type)) throw new Error(`Unknown tile type: ${String(type)}.`);
  const previous = city.tiles[index];
  if (previous === type) return city;
  if (city.budget < COSTS[type]) {
    throw new Error(`Not enough budget: ${type} costs $${COSTS[type]}, but only $${city.budget} is available.`);
  }
  const tiles = [...city.tiles];
  tiles[index] = type;
  let population = city.population;
  if (previous === 'house') {
    const homes = city.tiles.filter((tile) => tile === 'house').length;
    // Occupancy is city-wide, so remove an equal share when a home disappears.
    population = Math.max(0, population - Math.ceil(population / homes));
  }
  return withHappiness({ ...city, tiles, budget: city.budget - COSTS[type], population });
}

export function nextDay(city: City): City {
  if (city.day === Number.MAX_SAFE_INTEGER) throw new Error('The day counter has reached its limit.');
  const stats = getStats(city);
  let population = city.population;
  if (population > stats.capacity) {
    population -= Math.max(1, Math.ceil((population - stats.capacity) / 3));
  } else if (population < stats.capacity) {
    const arrivals = Math.max(1, Math.floor(
      stats.connectedHomes * (stats.happiness >= 75 ? 2 : 1) + Math.min(stats.jobs, 4) / 2,
    ));
    population = Math.min(stats.capacity, population + arrivals);
  }
  const updated = withHappiness({ ...city, tiles: [...city.tiles], day: city.day + 1, population });
  const daily = getStats(updated);
  return {
    ...updated,
    budget: Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, city.budget + daily.income - daily.expenses)),
  };
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Saves are canonical snapshots; unrecognised fields and malformed values are rejected. */
export function deserializeCity(raw: string): City | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
    const value = data as Record<string, unknown>;
    const keys = ['version', 'tiles', 'day', 'budget', 'population', 'happiness'];
    if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) return null;
    if (value.version !== 1 || !Array.isArray(value.tiles) || value.tiles.length !== TILE_COUNT
      || !value.tiles.every(isTileType)) return null;
    if (!isNonnegativeInteger(value.day) || !isNonnegativeInteger(value.budget)
      || !isNonnegativeInteger(value.population) || !isNonnegativeInteger(value.happiness)
      || value.happiness > 100) return null;
    const homes = value.tiles.filter((tile) => tile === 'house').length;
    if (value.population > homes * MAX_HOME_CAPACITY) return null;
    return {
      version: 1,
      tiles: [...value.tiles] as TileType[],
      day: value.day,
      budget: value.budget,
      population: value.population,
      happiness: value.happiness,
    };
  } catch {
    return null;
  }
}

export function serializeCity(city: City): string {
  const raw = JSON.stringify(city);
  if (!deserializeCity(raw)) throw new Error('Cannot save an invalid city.');
  return raw;
}

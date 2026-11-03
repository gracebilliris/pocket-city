import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COSTS, GRID_SIZE, createCity, deserializeCity, getStats, isRoadConnected,
  nextDay, placeTile, serializeCity,
} from './simulation.ts';
import type { City, TileType } from './simulation.ts';

function build(entries: [number, TileType][]): City {
  return entries.reduce((city, [index, type]) => placeTile(city, index, type), createCity());
}

test('construction validates indices, tile types and budgets without mutating input', () => {
  const city = createCity();
  assert.equal(city.tiles.length, GRID_SIZE ** 2);
  for (const index of [-1, 100, 1.5, NaN, Infinity]) {
    assert.throws(() => placeTile(city, index, 'road'), /index/i);
  }
  assert.throws(() => placeTile(city, 0, 'castle' as TileType), /tile type/i);
  assert.throws(() => placeTile({ ...city, budget: COSTS.house - 1 }, 0, 'house'), /budget/i);
  const placed = placeTile({ ...city, budget: COSTS.house }, 0, 'house');
  assert.equal(placed.budget, 0);
  assert.equal(city.tiles[0], 'empty');
  assert.equal(placeTile(placed, 0, 'house').budget, 0);
  assert.equal(placeTile(placed, 0, 'empty').budget, 0);
});

test('road access flood-fills from west edge and rejects islands, diagonals and row wrapping', () => {
  const city = build([[40, 'road'], [41, 'road'], [42, 'road'], [32, 'house'],
    [44, 'road'], [34, 'house'], [53, 'house'], [39, 'road']]);
  assert.equal(isRoadConnected(city, 40), true);
  assert.equal(isRoadConnected(city, 32), true);
  assert.equal(isRoadConnected(city, 44), false);
  assert.equal(isRoadConnected(city, 34), false);
  assert.equal(isRoadConnected(city, 53), false);
  assert.equal(isRoadConnected(city, 39), false);
  assert.equal(isRoadConnected(city, 43), false);
  assert.equal(isRoadConnected(city, -1), false);
  assert.equal(isRoadConnected(city, 100), false);
  assert.equal(getStats(city).connectedHomes, 1);
  assert.equal(isRoadConnected(build([[0, 'road'], [1, 'house']]), 1), true);
});

test('connected homes grow over ticks; isolated homes do not', () => {
  let connected = build([[40, 'road'], [41, 'road'], [31, 'house']]);
  let isolated = build([[44, 'road'], [34, 'house']]);
  for (let day = 0; day < 12; day++) {
    connected = nextDay(connected);
    isolated = nextDay(isolated);
  }
  assert.equal(connected.population, getStats(connected).capacity);
  assert.ok(connected.population > 0);
  assert.equal(isolated.population, 0);
  assert.equal(connected.day, 12);
});

test('parks, connected jobs and nearby services improve a neighborhood', () => {
  const base = build([[40, 'road'], [41, 'road'], [42, 'road'], [31, 'house']]);
  const green = placeTile(base, 30, 'park');
  const employed = placeTile(green, 52, 'shop');
  const served = placeTile(employed, 51, 'service');
  assert.ok(getStats(green).happiness > getStats(base).happiness);
  assert.ok(getStats(employed).jobs > getStats(green).jobs);
  assert.ok(getStats(employed).capacity > getStats(green).capacity);
  assert.ok(getStats(served).capacity > getStats(employed).capacity);
  assert.ok(getStats(served).happiness >= getStats(employed).happiness);
  assert.ok(nextDay(served).population > nextDay(base).population);
});

test('demolition removes residents safely and road removal causes gradual vacancy', () => {
  const original = createCity('village');
  const fewerHomes = placeTile(original, 30, 'empty');
  assert.ok(fewerHomes.population < original.population);
  assert.equal(original.population, 9);
  let noHomes = fewerHomes;
  for (const index of [32, 35]) noHomes = placeTile(noHomes, index, 'empty');
  assert.equal(noHomes.population, 0);
  const disconnected = placeTile(original, 40, 'empty');
  assert.equal(disconnected.population, original.population);
  assert.equal(getStats(disconnected).capacity, 0);
  let vacant = nextDay(disconnected);
  assert.ok(vacant.population > 0 && vacant.population < disconnected.population);
  for (let day = 0; day < 30; day++) vacant = nextDay(vacant);
  assert.equal(vacant.population, 0);
  assert.equal(nextDay(noHomes).population, 0);
});

test('daily taxes and maintenance update budget without debt or mutation', () => {
  const city = createCity('village');
  const before = serializeCity(city);
  const tomorrow = nextDay(city);
  const stats = getStats(tomorrow);
  assert.equal(tomorrow.budget, city.budget + stats.income - stats.expenses);
  assert.ok(stats.income > stats.expenses);
  assert.equal(serializeCity(city), before);
  assert.notEqual(tomorrow.tiles, city.tiles);
  const emptyTreasury = { ...build([[50, 'park']]), budget: 0 };
  assert.equal(nextDay(emptyTreasury).budget, 0);
});

test('save round trips a playable city and rejects malformed snapshots', () => {
  const city = nextDay(createCity('village'));
  const saved = serializeCity(city);
  const restored = deserializeCity(saved);
  assert.deepEqual(restored, city);
  assert.notEqual(restored?.tiles, city.tiles);
  const invalid: unknown[] = [
    null, [], {}, { ...city, version: 2 }, { ...city, day: -1 },
    { ...city, day: 0.1 }, { ...city, budget: -1 }, { ...city, budget: '100' },
    { ...city, budget: Number.MAX_SAFE_INTEGER + 1 }, { ...city, budget: Infinity },
    { ...city, population: NaN }, { ...city, population: -1 },
    { ...city, population: 25 }, { ...city, happiness: 101 },
    { ...city, happiness: null }, { ...city, tiles: city.tiles.slice(1) },
    { ...city, tiles: Array(100).fill('castle') }, { ...city, unexpected: true },
  ];
  for (const value of invalid) assert.equal(deserializeCity(JSON.stringify(value)), null);
  assert.equal(deserializeCity('{"budget":NaN}'), null);
  assert.equal(deserializeCity('{'), null);
  assert.throws(() => serializeCity({ ...city, budget: NaN }), /invalid city/i);
  assert.throws(() => nextDay({ ...city, day: Number.MAX_SAFE_INTEGER }), /day counter/i);
});

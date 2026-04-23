export const EARTH_RADIUS_NM = 3440.065;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineNm(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): number {
  const dLat = toRadians(endLat - startLat);
  const dLon = toRadians(endLon - startLon);
  const lat1 = toRadians(startLat);
  const lat2 = toRadians(endLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

export function computeBounds(coordinates: [number, number][]): [number, number, number, number] {
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

export function parseLineStringWkt(input: string): [number, number][] {
  const trimmed = input.trim();
  if (!trimmed.startsWith("LINESTRING(") || !trimmed.endsWith(")")) {
    return [];
  }
  const inner = trimmed.slice("LINESTRING(".length, -1);
  return inner
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [lon, lat] = pair.split(/\s+/).map(Number);
      return [lon, lat] as [number, number];
    });
}

export function cumulativeDistances(coordinates: [number, number][]): number[] {
  const distances: number[] = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    const [prevLon, prevLat] = coordinates[index - 1];
    const [lon, lat] = coordinates[index];
    distances.push(distances[index - 1] + haversineNm(prevLat, prevLon, lat, lon));
  }
  return distances;
}

export function interpolateAlongLine(
  coordinates: [number, number][],
  progress: number
): [number, number] {
  if (coordinates.length === 0) {
    return [0, 0];
  }
  if (coordinates.length === 1) {
    return coordinates[0];
  }
  const distances = cumulativeDistances(coordinates);
  const total = distances[distances.length - 1] || 1;
  const target = Math.max(0, Math.min(1, progress)) * total;
  for (let index = 1; index < distances.length; index += 1) {
    if (target <= distances[index]) {
      const segmentStart = distances[index - 1];
      const segmentLength = distances[index] - segmentStart || 1;
      const ratio = (target - segmentStart) / segmentLength;
      const [startLon, startLat] = coordinates[index - 1];
      const [endLon, endLat] = coordinates[index];
      return [startLon + (endLon - startLon) * ratio, startLat + (endLat - startLat) * ratio];
    }
  }
  return coordinates[coordinates.length - 1];
}

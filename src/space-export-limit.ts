export function createExportLimit(max = 4, windowMs = 60_000, now = Date.now) {
  let count = 0, until = 0;
  return () => {
    const time = now();
    if (time >= until) { count = 0; until = time + windowMs; }
    count += 1;
    return count <= max;
  };
}

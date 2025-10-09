/**
 * Compute Jaro similarity between two strings (0..1).
 * Implementation is adapted for short token comparison.
 */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const str1 = a.toLowerCase();
  const str2 = b.toLowerCase();
  const matchDistance = Math.max(str1.length, str2.length) / 2 - 1;

  const str1Matches = new Array<boolean>(str1.length).fill(false);
  const str2Matches = new Array<boolean>(str2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, Math.floor(i - matchDistance));
    const end = Math.min(
      str2.length - 1,
      Math.floor(i + matchDistance)
    );

    for (let j = start; j <= end; j++) {
      if (str2Matches[j]) continue;
      if (str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k += 1;
    if (str1[i] !== str2[k]) transpositions += 1;
    k += 1;
  }

  const jaroIndex =
    (matches / str1.length +
      matches / str2.length +
      (matches - transpositions / 2) / matches) /
    3;

  return Number(jaroIndex.toFixed(6));
}

export default jaro;


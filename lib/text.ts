const segmenters = new Map<string, Intl.Segmenter>();

function getSegmenter(locale = "en") {
  let segmenter = segmenters.get(locale);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
    segmenters.set(locale, segmenter);
  }
  return segmenter;
}

export function splitCharacters(value: string, locale = "en") {
  return Array.from(getSegmenter(locale).segment(value), ({ segment }) => segment);
}

export function countCharacters(value: string, locale = "en") {
  return splitCharacters(value, locale).length;
}

export function limitCharacters(value: string, maximum: number, locale = "en") {
  const characters = splitCharacters(value, locale);
  return characters.length <= maximum ? value : characters.slice(0, maximum).join("");
}

let segmenter: Intl.Segmenter | undefined;

function getSegmenter() {
  if (typeof Intl.Segmenter !== "function") return null;
  segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return segmenter;
}

export function splitCharacters(value: string) {
  const activeSegmenter = getSegmenter();
  if (!activeSegmenter) return Array.from(value);
  return Array.from(activeSegmenter.segment(value), ({ segment }) => segment);
}

export function countCharacters(value: string) {
  return splitCharacters(value).length;
}

export function limitCharacters(value: string, maximum: number) {
  const characters = splitCharacters(value);
  return characters.length <= maximum ? value : characters.slice(0, maximum).join("");
}

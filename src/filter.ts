import type { FilterQuery, TaskCard } from "./types.js";

export function filterTaskCards(
  cards: TaskCard[],
  query: FilterQuery
): TaskCard[] {
  const q = query.q?.trim().toLowerCase();

  return cards.filter((card) => {
    if (query.threshold && card.threshold !== query.threshold) return false;
    if (query.repeat && card.repeat !== query.repeat) return false;
    if (query.source && card.source !== query.source) return false;
    if (query.airplane && card.airplane !== query.airplane) return false;
    if (query.engine && card.engine !== query.engine) return false;

    if (!q) return true;

    const haystack = [
      card.id,
      card.source,
      card.amm,
      card.threshold,
      card.repeat,
      card.description ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

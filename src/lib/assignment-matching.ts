import type { Candidate } from "./database.types";
export type MatchKind = "contribution" | "training";
export function rankCandidates(candidates: Candidate[], skillIds: string[], kind: MatchKind, excluded: Set<string> = new Set()) {
  const skills=new Set(skillIds);
  return candidates.filter((c) => !excluded.has(c.user_id)).map((c) => {
    const existing=[...new Set(c.existing_ids)].filter((s) => skills.has(s));
    const learning=[...new Set(c.learning_ids)].filter((s) => skills.has(s));
    return { ...c, matchingExisting:existing, matchingLearning:learning, score:kind==="training" ? 3*learning.length+existing.length : 3*existing.length+learning.length };
  }).filter((c) => c.score>0 && (kind!=="training" || c.matchingLearning.length>0)).sort((a,b) => b.score-a.score || (b.available_hours ?? -1)-(a.available_hours ?? -1) || (a.display_name.toLowerCase()<b.display_name.toLowerCase() ? -1 : a.display_name.toLowerCase()>b.display_name.toLowerCase() ? 1 : a.user_id.localeCompare(b.user_id)));
}

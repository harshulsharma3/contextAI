import { getLLM } from "../llm/index.js";

/** Decide whether a Q&A would benefit from a chalkboard-style visual. */
export async function assessDiagramWorthy(opts: {
  query: string;
  answer: string;
}): Promise<boolean> {
  try {
    const llm = getLLM();
    const result = await llm.generateJSON<{ diagramWorthy: boolean }>(
      {
        system:
          "You classify whether a study Q&A benefits from a simple chalkboard diagram.",
        prompt: `Student question:
${opts.query.slice(0, 800)}

Assistant answer:
${opts.answer.slice(0, 2000)}

Return JSON only: { "diagramWorthy": true|false }

true when a visual would help: processes, flows, architecture, comparisons, timelines, cycles, cause-effect, labeled parts, step sequences, system design.
false for: simple definitions, yes/no, short factual lookups, pure lists without structure, or when the answer already says sources lack info.`,
        temperature: 0,
        maxTokens: 64,
      },
      '{ "diagramWorthy": boolean }'
    );
    return Boolean(result.diagramWorthy);
  } catch {
    return false;
  }
}

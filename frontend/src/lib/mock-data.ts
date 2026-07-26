import type { ChatMessage, Project, QuizQuestion } from "@/types";

export const currentProject: Project = {
  id: "proj_psych_101",
  name: "Source Selection",
  stats: {
    sourcesIndexed: 15,
    totalDurationLabel: "25h",
    knowledgeChunks: 1450,
  },
  sources: [
    {
      id: "src_1",
      name: "Introduction to Cognition",
      fileName: "Introduction to Cognition.pdf",
      label: "PDF",
      type: "pdf",
      status: "indexing",
      chunkCount: 0,
      createdAt: "2026-07-10T10:00:00Z",
    },
    {
      id: "src_2",
      name: "Lecture 12 — Cognitive Processes",
      fileName: "Lecture_12_Cognitive_Process.mp4",
      type: "video",
      status: "ready",
      durationSeconds: 3120,
      chunkCount: 128,
      createdAt: "2026-07-12T14:30:00Z",
    },
    {
      id: "src_3",
      name: "Introduction to Cognition",
      fileName: "Introduction to Cognition.pdf",
      label: "PDF",
      type: "pdf",
      status: "ready",
      chunkCount: 96,
      createdAt: "2026-07-08T09:15:00Z",
    },
    {
      id: "src_4",
      name: "Indexed YouTube Link",
      fileName: "Indexed YouTube Link",
      label: "YouTube Link",
      type: "youtube",
      status: "ready",
      durationSeconds: 2700,
      chunkCount: 84,
      createdAt: "2026-07-20T16:00:00Z",
    },
    {
      id: "src_5",
      name: "Lecture 03 — Sensation & Perception",
      fileName: "Lecture_03_Sensation_Perception.vtt",
      label: "VTT",
      type: "vtt",
      status: "ready",
      durationSeconds: 3300,
      chunkCount: 134,
      createdAt: "2026-07-05T11:20:00Z",
    },
  ],
  recentChats: [
    {
      id: "chat_1",
      title: "James-Lange Theory",
      preview: "Can you explain the main theories of emotion...",
    },
    {
      id: "chat_2",
      title: "Working memory model",
      preview: "How does Baddeley's working memory model work?",
    },
    {
      id: "chat_3",
      title: "Introduction to Psychology",
      preview: "Introduction to Psychology...",
    },
    {
      id: "chat_4",
      title: "Cognitive biases",
      preview: "What cognitive biases were covered in class?",
    },
  ],
};

export const initialMessages: ChatMessage[] = [
  {
    id: "msg_1",
    role: "assistant",
    content:
      "Based on Introduction to Cognition.pdf, schemas are organized knowledge structures that help you interpret new information. They guide attention, encoding, and retrieval — which is why familiar patterns feel easier to process.",
    createdAt: "2026-07-21T10:00:00Z",
  },
  {
    id: "msg_2",
    role: "user",
    content: "Can you explain the James-Lange theory of emotion?",
    createdAt: "2026-07-21T10:00:30Z",
  },
  {
    id: "msg_3",
    role: "assistant",
    title: "How it works (James-Lange Theory)",
    content:
      "The James-Lange theory proposes that physiological arousal comes before the conscious experience of emotion. You encounter a stimulus (e.g. a snake), your body reacts (heart races, palms sweat), and only then do you interpret that bodily change as fear.\n\nIn short: we feel afraid because we tremble — not the other way around.",
    citations: [
      {
        id: "cit_1",
        sourceId: "src_2",
        sourceLabel: "From Lecture 1",
        timestamp: "18:45",
      },
      {
        id: "cit_2",
        sourceId: "src_3",
        sourceLabel: "PDF: Psych 101",
        timestamp: "p.14",
      },
    ],
    createdAt: "2026-07-21T10:00:35Z",
  },
];

export const contextFilterChips = [
  "From Lecture 1",
  "PDF: Psych 101",
  "Lecture 14 Emotion",
  "Working Memory",
];

export const mockQuizQuestions: QuizQuestion[] = [
  {
    id: "q1",
    number: 1,
    prompt:
      "Which of the following is the best definition of a schema, according to cognitive psychology?",
    options: [
      {
        id: "a",
        label: "A",
        text: "A temporary sensory buffer that stores raw perceptual data for less than one second.",
      },
      {
        id: "b",
        label: "B",
        text: "A fixed list of vocabulary terms memorized through rote rehearsal.",
      },
      {
        id: "c",
        label: "C",
        text: "An organized knowledge structure that guides how new information is interpreted and remembered.",
      },
      {
        id: "d",
        label: "D",
        text: "A neurological reflex pathway that triggers fight-or-flight responses.",
      },
    ],
    correctOptionId: "c",
    selectedOptionId: "a",
    status: "incorrect",
    explanation:
      "Schemas are mental frameworks built from prior experience. They help you fill gaps, prioritize what matters, and retrieve related knowledge quickly — not raw sensory storage or rote word lists.",
    reference: "Introduction to Cognition (PDF), Pages 14-15",
  },
  {
    id: "q2",
    number: 2,
    prompt:
      "In the James-Lange theory, what comes first when an emotion is experienced?",
    options: [
      {
        id: "a",
        label: "A",
        text: "Conscious labeling of the emotion",
      },
      {
        id: "b",
        label: "B",
        text: "Appraisal of the situation's meaning",
      },
      {
        id: "c",
        label: "C",
        text: "Physiological arousal in the body",
      },
      {
        id: "d",
        label: "D",
        text: "Simultaneous thalamic activation only",
      },
    ],
    correctOptionId: "c",
    selectedOptionId: "c",
    status: "correct",
    explanation:
      "James-Lange argues bodily changes precede the felt emotion: stimulus → physiological response → conscious emotion.",
    reference: "Lecture 14 — Emotion Theories, 18:45",
  },
  {
    id: "q3",
    number: 3,
    prompt:
      "Cannon-Bard theory primarily differs from James-Lange by claiming that:",
    options: [
      {
        id: "a",
        label: "A",
        text: "Emotions require language to exist",
      },
      {
        id: "b",
        label: "B",
        text: "Only facial feedback creates feeling",
      },
      {
        id: "c",
        label: "C",
        text: "Emotion and arousal occur simultaneously",
      },
      {
        id: "d",
        label: "D",
        text: "Memory alone produces emotional states",
      },
    ],
    correctOptionId: "c",
    selectedOptionId: "c",
    status: "correct",
    explanation:
      "Cannon-Bard holds that emotional experience and physiological arousal are triggered together, not in sequence.",
    reference: "Lecture 14 — Emotion Theories, 24:30",
  },
  {
    id: "q4",
    number: 4,
    prompt: "Working memory is best described as:",
    options: [
      {
        id: "a",
        label: "A",
        text: "Permanent storage of autobiographical events",
      },
      {
        id: "b",
        label: "B",
        text: "A sensory echo lasting under 250ms",
      },
      {
        id: "c",
        label: "C",
        text: "A limited-capacity system for holding and manipulating information",
      },
      {
        id: "d",
        label: "D",
        text: "An unlimited long-term semantic network",
      },
    ],
    correctOptionId: "c",
    selectedOptionId: "c",
    status: "correct",
    explanation:
      "Working memory temporarily holds and manipulates information needed for reasoning, comprehension, and learning.",
    reference: "Lecture 12 — Cognitive Processes",
  },
  {
    id: "q5",
    number: 5,
    prompt: "What is a common effect of schemas on memory retrieval?",
    options: [
      {
        id: "a",
        label: "A",
        text: "They eliminate all reconstruction errors",
      },
      {
        id: "b",
        label: "B",
        text: "They can bias recall toward schema-consistent details",
      },
      {
        id: "c",
        label: "C",
        text: "They store only phonological loops",
      },
      {
        id: "d",
        label: "D",
        text: "They prevent encoding of new experiences",
      },
    ],
    correctOptionId: "b",
    status: "pending",
    explanation:
      "Schemas help organize memory but can also distort it by filling gaps with expected, schema-consistent information.",
    reference: "Introduction to Cognition (PDF), Pages 16-17",
  },
  {
    id: "q6",
    number: 6,
    prompt: "Selective attention primarily helps a learner to:",
    options: [
      {
        id: "a",
        label: "A",
        text: "Encode every sensory detail equally",
      },
      {
        id: "b",
        label: "B",
        text: "Filter relevant stimuli from distractors",
      },
      {
        id: "c",
        label: "C",
        text: "Store unlimited visual icons",
      },
      {
        id: "d",
        label: "D",
        text: "Bypass working-memory limits entirely",
      },
    ],
    correctOptionId: "b",
    status: "unanswered",
    explanation:
      "Selective attention prioritizes task-relevant input so limited cognitive resources are used effectively.",
    reference: "Lecture 08 — Memory Systems",
  },
  {
    id: "q7",
    number: 7,
    prompt: "Chunking improves short-term retention by:",
    options: [
      {
        id: "a",
        label: "A",
        text: "Increasing raw sensory bandwidth",
      },
      {
        id: "b",
        label: "B",
        text: "Grouping items into meaningful units",
      },
      {
        id: "c",
        label: "C",
        text: "Removing rehearsal from memory",
      },
      {
        id: "d",
        label: "D",
        text: "Converting STM into procedural skill",
      },
    ],
    correctOptionId: "b",
    status: "unanswered",
    explanation:
      "Chunking packs more information into limited short-term capacity by organizing items into familiar patterns.",
    reference: "Lecture 12 — Cognitive Processes",
  },
];

export const sourceViewerPreview = `Introduction to Cognition

Chapter 3 — Knowledge Structures

A schema is an organized body of knowledge
that guides how people interpret, encode,
and retrieve information. Schemas develop
through experience and can operate below
conscious awareness.

When you encounter a new classroom, café,
or lecture format, existing schemas help
you predict what will happen next and
which details deserve attention.

Key properties:
• Organization of related concepts
• Default assumptions and slots
• Influence on encoding and recall
• Potential for reconstructive bias

See also: scripts, frames, and mental models
in the following sections (pp. 14–18).`;

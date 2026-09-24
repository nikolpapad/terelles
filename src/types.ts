import content from "../data/content.json";

export type Content = typeof content;
export type Island = Content["islands"][number];
export type Job = Island["zones"][number]["jobs"][number];
export type Quest = Content["quests"][number];
export type Landing = { island: Island; zone: Island["zones"][number]; job: Job };
export { content };
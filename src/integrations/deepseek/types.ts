export type DeepSeekChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type VacancyRankModelResult = {
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
};

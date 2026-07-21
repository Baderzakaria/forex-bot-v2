import "server-only";

import { getEnv, loadRootEnv } from "@/lib/env";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chatCompletion(messages: ChatMessage[]) {
  loadRootEnv();

  const apiKey = getEnv("ZAI_API_KEY");
  const baseUrl = getEnv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4");
  const model = getEnv("LLM_MODEL", "glm-4.5-flash");

  if (!apiKey) {
    return {
      provider: "stub",
      model,
      reply:
        "ZAI is not configured in the root .env. Add ZAI_API_KEY to enable live chat.",
    };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      throw new Error(`ZAI returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = payload.choices?.[0]?.message?.content?.trim();

    return {
      provider: "zai",
      model,
      reply: reply || "No assistant content returned.",
    };
  } catch (error) {
    return {
      provider: "stub",
      model,
      reply: `AI request failed, so this CMS returned a stub response. ${(error as Error).message}`,
    };
  }
}

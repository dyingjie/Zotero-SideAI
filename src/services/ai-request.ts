import type { ChatCompletionsRequestBody } from "./chat-completions";

export function buildChatCompletionsEndpoint(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
}

export async function postChatCompletionsRequest(input: {
  apiKey: string;
  baseUrl: string;
  body: ChatCompletionsRequestBody;
  fetchFn?: typeof fetch;
}): Promise<Response> {
  const fetchFn = input.fetchFn || fetch;
  const endpoint = buildChatCompletionsEndpoint(input.baseUrl);

  return fetchFn(endpoint, {
    body: JSON.stringify(input.body),
    headers: {
      Authorization: `Bearer ${input.apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
}

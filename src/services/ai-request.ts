import type { ChatCompletionsRequestBody } from "./chat-completions";

export async function postChatCompletionsRequest(input: {
  apiKey: string;
  body: ChatCompletionsRequestBody;
  endpoint: string;
  fetchFn?: typeof fetch;
}): Promise<Response> {
  const fetchFn = input.fetchFn || fetch;

  return fetchFn(input.endpoint, {
    body: JSON.stringify(input.body),
    headers: {
      Authorization: `Bearer ${input.apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
}

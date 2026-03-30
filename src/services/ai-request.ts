import {
  createChatCompletionsRequestBody,
  type ChatCompletionMessage,
  type ChatCompletionsRequestBody
} from "./chat-completions";

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

export async function postChatCompletionsMessages(input: {
  apiKey: string;
  baseUrl: string;
  fetchFn?: typeof fetch;
  messages: ChatCompletionMessage[];
  model: string;
}): Promise<Response> {
  return postChatCompletionsRequest({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    body: createChatCompletionsRequestBody({
      messages: input.messages,
      model: input.model
    }),
    fetchFn: input.fetchFn
  });
}

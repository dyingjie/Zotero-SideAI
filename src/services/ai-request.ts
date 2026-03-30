import {
  createChatCompletionsRequestBody,
  type ChatCompletionMessage,
  type ChatCompletionsRequestBody
} from "./chat-completions";

type ClearTimeoutFn = (timeoutId: ReturnType<typeof setTimeout>) => void;
type SetTimeoutFn = (
  callback: () => void,
  delay: number
) => ReturnType<typeof setTimeout>;

export function buildChatCompletionsEndpoint(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
}

export function createTimeoutSignal(input: {
  clearTimeoutFn?: ClearTimeoutFn;
  setTimeoutFn?: SetTimeoutFn;
  timeoutMs?: number;
}): {
  cleanup: () => void;
  signal?: AbortSignal;
} {
  if (!input.timeoutMs || input.timeoutMs <= 0) {
    return {
      cleanup: () => {}
    };
  }

  const controller = new AbortController();
  const setTimeoutFn = input.setTimeoutFn || setTimeout;
  const clearTimeoutFn = input.clearTimeoutFn || clearTimeout;
  const timeoutId = setTimeoutFn(() => {
    controller.abort();
  }, input.timeoutMs);

  return {
    cleanup: () => {
      clearTimeoutFn(timeoutId);
    },
    signal: controller.signal
  };
}

export async function postChatCompletionsRequest(input: {
  apiKey: string;
  baseUrl: string;
  body: ChatCompletionsRequestBody;
  clearTimeoutFn?: ClearTimeoutFn;
  fetchFn?: typeof fetch;
  setTimeoutFn?: SetTimeoutFn;
  timeoutMs?: number;
}): Promise<Response> {
  const fetchFn = input.fetchFn || fetch;
  const endpoint = buildChatCompletionsEndpoint(input.baseUrl);
  const timeout = createTimeoutSignal({
    clearTimeoutFn: input.clearTimeoutFn,
    setTimeoutFn: input.setTimeoutFn,
    timeoutMs: input.timeoutMs
  });

  try {
    return await fetchFn(endpoint, {
      body: JSON.stringify(input.body),
      headers: {
        Authorization: `Bearer ${input.apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: timeout.signal
    });
  } finally {
    timeout.cleanup();
  }
}

export async function postChatCompletionsMessages(input: {
  apiKey: string;
  baseUrl: string;
  clearTimeoutFn?: ClearTimeoutFn;
  fetchFn?: typeof fetch;
  messages: ChatCompletionMessage[];
  model: string;
  setTimeoutFn?: SetTimeoutFn;
  timeoutMs?: number;
}): Promise<Response> {
  return postChatCompletionsRequest({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    body: createChatCompletionsRequestBody({
      messages: input.messages,
      model: input.model
    }),
    clearTimeoutFn: input.clearTimeoutFn,
    fetchFn: input.fetchFn,
    setTimeoutFn: input.setTimeoutFn,
    timeoutMs: input.timeoutMs
  });
}

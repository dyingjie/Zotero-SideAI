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

export class AIRequestError extends Error {
  public status?: number;

  constructor(message: string, options?: { status?: number }) {
    super(message);
    this.name = "AIRequestError";
    this.status = options?.status;
  }
}

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
    } catch (error) {
      throw normalizeAIRequestError(error);
    }
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

export function normalizeAIRequestError(error: unknown): AIRequestError {
  if (error instanceof AIRequestError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new AIRequestError("Request timed out.");
  }

  if (error instanceof Error && error.message.trim()) {
    return new AIRequestError(error.message.trim());
  }

  return new AIRequestError("Request failed.");
}

export function ensureSuccessfulResponse(response: Response): Response {
  if (response.ok) {
    return response;
  }

  throw new AIRequestError(`Request failed with status ${response.status}.`, {
    status: response.status
  });
}

export function parseChatCompletionsResponse(data: unknown): string {
  if (
    typeof data !== "object" ||
    data === null ||
    !("choices" in data) ||
    !Array.isArray(data.choices) ||
    data.choices.length === 0
  ) {
    throw new AIRequestError("Response format is incompatible.");
  }

  const firstChoice = data.choices[0];
  const content = firstChoice?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new AIRequestError("Response format is incompatible.");
  }

  return content;
}

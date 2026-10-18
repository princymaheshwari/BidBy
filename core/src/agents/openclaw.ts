// callAgent(agentId, userContent, tool) -> validated tool arguments via the OpenClaw Gateway
// (SYSTEM_DESIGN §9.2). One retry with the validation error appended, then null + agent.failed.
import type { z } from "zod";
import { config } from "../config.js";
import { emit } from "../events.js";
import type { AgentTool } from "./schemas.js";

export type AgentId = "extractor" | "aid" | "credit" | "subs" | "money_in" | "coordinator";

const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;
const MAX_ERROR_CHARS = 300;

interface ChatCompletion {
  choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
}

export async function callAgent<S extends z.ZodType>(
  agentId: AgentId,
  userContent: string,
  tool: AgentTool<S>,
): Promise<z.infer<S> | null> {
  if (config.AGENT_BACKEND === "direct") {
    throw new Error("AGENT_BACKEND=direct is not built (spec 01 fallback, only if the OpenClaw time box is exceeded)");
  }

  let content = userContent;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    emit("agent.called", { agent_id: agentId, tool: tool.name, attempt });
    const started = performance.now();
    try {
      const parsed = tool.zod.safeParse(await requestToolCall(agentId, content, tool));
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "));
      }
      emit("agent.returned", { agent_id: agentId, tool: tool.name, attempt, ok: true, latency_ms: elapsed(started) });
      return parsed.data;
    } catch (err) {
      lastError = (err as Error).message.slice(0, MAX_ERROR_CHARS);
      emit("agent.returned", {
        agent_id: agentId, tool: tool.name, attempt, ok: false, latency_ms: elapsed(started), error: lastError,
      });
      content =
        `${userContent}\n\nYour previous ${tool.name} call was rejected: ${lastError}\n` +
        `Call ${tool.name} again with arguments that match its schema exactly.`;
    }
  }

  emit("agent.failed", { agent_id: agentId, tool: tool.name, attempts: MAX_ATTEMPTS, error: lastError });
  return null;
}

/** One chat-completions request with the tool pinned. Returns the parsed (unvalidated) arguments. */
async function requestToolCall(agentId: AgentId, content: string, tool: AgentTool): Promise<unknown> {
  const res = await fetch(`${config.OPENCLAW_GATEWAY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.OPENCLAW_GATEWAY_TOKEN}`,
      "Content-Type": "application/json",
    },
    // No `user` field: each call is a fresh, stateless Gateway session.
    body: JSON.stringify({
      model: `openclaw/${agentId}`,
      messages: [{ role: "user", content }],
      tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.jsonSchema } }],
      tool_choice: { type: "function", function: { name: tool.name } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const call = ((await res.json()) as ChatCompletion).choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call?.arguments) throw new Error(`response has no ${tool.name} tool call`);
  if (call.name && call.name !== tool.name) throw new Error(`expected ${tool.name}, got ${call.name}`);
  try {
    return JSON.parse(call.arguments);
  } catch {
    throw new Error("tool call arguments are not valid JSON");
  }
}

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}

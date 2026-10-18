// Voice tests: import this first, before anything that loads config. Environment variables win over .env,
// so tests use a scratch database, log-only texting and fake ElevenLabs credentials. Nothing is sent.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "bidby-voice-test-"));

Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"),
  USER_PHONE: "+14045550100",
  OPENCLAW_GATEWAY_TOKEN: "test-token",
  MESSAGING_MODE: "log",
  VOICE_MODE: "browser",
  VOICE_PROVIDER: "twilio",
  ELEVENLABS_API_KEY: "test-xi-key",
  ELEVENLABS_AGENT_ID: "agent_test",
  ELEVENLABS_PHONE_NUMBER_ID: "phnum_test",
  ELEVENLABS_WEBHOOK_SECRET: "wsec_test",
  BIDBY_TOOL_SECRET: "tool-secret",
  BIDBY_PHONE_KEY: "phone-key",
  ALLOWED_DIAL_NUMBERS: "+14045550100",
});

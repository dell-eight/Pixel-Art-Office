import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/**
 * Returns configuration settings and API keys status (yes/no presence only).
 * Never sends or exposes actual secret key values to the client!
 */
export async function GET() {
  const e = env();
  return Response.json({
    mockMode: e.MOCK_MODE,
    budgetCapPhp: e.BUDGET_CAP_PHP,
    fxUsdPhp: e.FX_USD_PHP,
    keys: {
      gemini: Boolean(e.GEMINI_API_KEY && e.GEMINI_API_KEY.length > 0),
      elevenlabs: Boolean(e.ELEVENLABS_API_KEY && e.ELEVENLABS_API_KEY.length > 0),
      vidu: Boolean(e.VIDU_API_KEY && e.VIDU_API_KEY.length > 0),
      openai: Boolean(e.OPENAI_API_KEY && e.OPENAI_API_KEY.length > 0),
      kling: Boolean(e.KLING_API_KEY && e.KLING_API_KEY.length > 0),
    },
  });
}

import { connection } from "next/server";
import { APIError, TypeSafeClient } from "@typesafe-ai/sdk";
import { JEV_MODEL, jevModel } from "@/engine/jev";

// Diagnostics for the Jev connection: /api/jev-status?secret=<CRON_SECRET>.
// Never returns the key itself.
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const env = process.env.VERCEL_ENV ?? "local";
  if (!secret) {
    // Saying whether a variable exists (never its value) helps diagnose deployments.
    return new Response(
      `Unauthorized: CRON_SECRET is not set for this deployment (environment: ${env}). ` +
        `TYPESAFE_API_KEY is ${process.env.TYPESAFE_API_KEY ? "set" : "not set"}. ` +
        "Add the variables for this environment in Vercel and redeploy.",
      { status: 401 },
    );
  }
  if (new URL(request.url).searchParams.get("secret")?.trim() !== secret.trim()) {
    return new Response(
      `Unauthorized: the secret in the URL doesn't match CRON_SECRET (environment: ${env}).`,
      { status: 401 },
    );
  }

  const key = process.env.TYPESAFE_API_KEY;
  const status: Record<string, unknown> = {
    vercelEnv: process.env.VERCEL_ENV ?? "local",
    keyConfigured: Boolean(key),
    keyLength: key?.length ?? 0,
    keyHasWhitespace: key ? key !== key.trim() : false,
    pinnedModel: JEV_MODEL,
  };
  if (!key) return Response.json(status);

  try {
    const models = await new TypeSafeClient({ timeout: 15_000 }).models.list();
    status.modelsAvailable = models.map((m) => m.name);
  } catch (e) {
    status.modelsError = describe(e);
  }
  try {
    const [p] = await jevModel.noul("Get £50 of free Bitcoin when you sign up.", [
      { question: "Does the text offer a bonus or free gift?", signals: { hit: [] } },
    ]);
    status.testCall = { ok: true, noul: p };
  } catch (e) {
    status.testCall = { ok: false, error: describe(e) };
  }
  return Response.json(status);
}

function describe(e: unknown) {
  if (e instanceof APIError)
    return { status: e.status, message: e.message, body: e.body, requestId: e.requestId };
  if (e instanceof Error) return { message: e.message, cause: String(e.cause ?? "") };
  return { message: String(e) };
}

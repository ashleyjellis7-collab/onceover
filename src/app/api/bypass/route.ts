import { BYPASS_COOKIE, bypassToken, hashToken, tokenMatches } from "@/lib/bypass";

// /api/bypass?token=<BYPASS_TOKEN or CRON_SECRET> turns the bypass on for this browser.
// /api/bypass?off turns it off.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const home = new URL("/", url);

  if (url.searchParams.has("off")) {
    return new Response(null, {
      status: 303,
      headers: {
        location: home.toString(),
        "set-cookie": `${BYPASS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
      },
    });
  }

  const given = url.searchParams.get("token") ?? "";
  if (!bypassToken() || !tokenMatches(given)) {
    return new Response("Unauthorized: that bypass token doesn't match.", { status: 401 });
  }
  const year = 60 * 60 * 24 * 365;
  return new Response(null, {
    status: 303,
    headers: {
      location: home.toString(),
      "set-cookie": `${BYPASS_COOKIE}=${hashToken(bypassToken()!)}; Path=/; Max-Age=${year}; HttpOnly; SameSite=Lax; Secure`,
    },
  });
}

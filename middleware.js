// Vercel Edge Middleware — a shared-password gate for the colleague review.
// It runs in front of EVERYTHING (the static app AND /api/gemini), so a leaked
// link can't burn your Gemini quota: the browser prompts once for a username +
// password (HTTP Basic Auth) and then caches it for the whole origin, including
// the API calls the app makes.
//
// Set these in the Vercel dashboard (Project → Settings → Environment Variables):
//   GATE_PASS — the shared review password (REQUIRED to enable the gate)
//   GATE_USER — the username (optional; defaults to "lyra")
// If GATE_PASS is unset, the gate is OFF (open site) — so you can flip it on/off
// without a redeploy by adding/removing the env var.

export const config = {
  // Match every path. Static assets are gated too, but the browser re-sends the
  // cached credentials automatically, so it only prompts once.
  matcher: "/:path*",
};

// F7 (§102): constant-time credential compare so the gate can't leak the password via
// response timing. For a single shared review password the timing risk is largely
// theoretical, but the fix is trivial and exactly equivalent to `===`. Lengths are
// compared first; the expected length is already public via the realm, so that is immaterial.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function middleware(request) {
  const PASS = process.env.GATE_PASS;
  if (!PASS) return; // gate disabled when no password configured

  const USER = process.env.GATE_USER || "lyra";
  const expected = "Basic " + btoa(`${USER}:${PASS}`);
  const provided = request.headers.get("authorization") || "";

  if (!timingSafeEqual(provided, expected)) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Lyra — enter the review password", charset="UTF-8"',
      },
    });
  }
  // Authorized → fall through (return nothing) to the app / API.
}

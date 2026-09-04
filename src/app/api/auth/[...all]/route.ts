import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

/**
 * The auth library's own endpoints: sign-up, sign-in, sign-out, session lookup.
 *
 * Everything under /api/auth is handled here. The app's own code never posts to
 * these directly from the browser — server actions call `auth.api.*` in process
 * — but the client library uses them for the session it keeps in React.
 */
export const { GET, POST } = toNextJsHandler(auth);

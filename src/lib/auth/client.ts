"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth. Used only for the two things that genuinely need to happen
 * in the client: signing out (which must clear the cookie the browser holds)
 * and reading the session in client components.
 *
 * Sign-up and sign-in deliberately do NOT go through this. They run as server
 * actions so credentials never sit in client state, validation happens in one
 * place, and the redirect is decided by the server.
 */
export const authClient = createAuthClient();

export const { signOut, useSession } = authClient;

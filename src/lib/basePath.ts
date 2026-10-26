/**
 * The site's sub-path on GitHub Pages ("/wiskunde-in-de-stad"), or "" locally.
 * next/link and the router add it themselves; plain URLs (public files, the
 * OAuth redirect) need it added by hand.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const asset = (path: string) => `${BASE_PATH}${path}`;

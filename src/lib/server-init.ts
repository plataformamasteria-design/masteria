/**
 * LEGACY FILE - Worker initialization moved to server.js
 * 
 * This file previously initialized campaign workers and Baileys sessions,
 * but that caused issues when bundled by Next.js:
 * 1. tsx/cjs imports caused esbuild.d.ts parse errors
 * 2. Duplicate initialization with server.js caused race conditions
 * 
 * All service initialization now happens in server.js which has proper
 * tsx/cjs context for loading TypeScript files.
 */

let serverInitialized = false;

declare global {
  // eslint-disable-next-line no-var
  var __serverInitialized: boolean | undefined;
}

export async function initializeServer(): Promise<void> {
  // Skip initialization - handled by server.js
  if (typeof globalThis.window !== 'undefined') return;
  if (global.__serverInitialized || serverInitialized) return;

  // Mark as initialized to prevent any future calls
  serverInitialized = true;
  global.__serverInitialized = true;

  // All initialization now happens in server.js
  // This file is kept as a no-op to avoid breaking imports
  console.log('[ServerInit] ℹ️ Initialization delegated to server.js');
}

// Auto-initialization disabled - server.js handles everything


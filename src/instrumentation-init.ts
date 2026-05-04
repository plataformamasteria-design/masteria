// ✅ Server-side initialization helper
// This file helps initialize the application when it starts
// It's NOT used by Next.js directly - we initialize the worker via /api/internal/init-worker

/**
 * Call this function from your server initialization code to start the worker
 * Example: In your main server file or a startup hook
 */
export async function initializeServerServices() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/internal/init-worker`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('[InitializeServerServices]', data.message);
    return data.status === 'success';
  } catch (error) {
    console.error('[InitializeServerServices] Failed to initialize worker:', error);
    return false;
  }
}

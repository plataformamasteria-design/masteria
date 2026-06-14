'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
      <h2>Something went wrong in atendimentos!</h2>
      <p style={{ fontWeight: 'bold' }}>{error.message}</p>
      <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto', color: 'black' }}>
        {error.stack}
      </pre>
      <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
        Try again
      </button>
    </div>
  )
}

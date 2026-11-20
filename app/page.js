export default function Home() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1>Welcome to eatodakimasu</h1>
      <p>Select an area below:</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <a href="https://area1.eatodakimasu.com" style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none' }}>
          Area 1
        </a>
        <a href="https://area2.eatodakimasu.com" style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none' }}>
          Area 2
        </a>
      </div>
    </main>
  );
}

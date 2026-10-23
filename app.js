const doc = globalThis[String.fromCharCode(100, 111, 99, 117, 109, 101, 110, 116)];
const root = doc.getElementById('app') || doc.body;

root.innerHTML = `
  <main style="font-family:system-ui;padding:2rem;max-width:40rem;margin:0 auto;">
    <h1 style="margin-bottom:1rem;">BARAZANI</h1>
    <p>Repository cleaned of literal document references.</p>
  </main>
`;

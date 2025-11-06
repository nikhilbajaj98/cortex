export const metadata = {
  title: 'Cortex UI',
  description: 'Observability and analytics for Cortex'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', margin: 0 }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <aside style={{ width: 240, padding: 16, borderRight: '1px solid #eee' }}>
            <h2 style={{ marginTop: 0 }}>Cortex</h2>
            <nav style={{ display: 'grid', gap: 8 }}>
              <a href="/">Dashboard</a>
              <a href="/services">Services</a>
            </nav>
          </aside>
          <main style={{ flex: 1, padding: 24 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

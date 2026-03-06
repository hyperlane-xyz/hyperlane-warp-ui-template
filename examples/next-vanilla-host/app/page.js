import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>Vanilla Next.js Host Example</h1>
      <ul>
        <li>
          <Link href="/sdk">SDK integration</Link>
        </li>
        <li>
          <Link href="/iframe">Iframe helper integration</Link>
        </li>
      </ul>
    </main>
  );
}

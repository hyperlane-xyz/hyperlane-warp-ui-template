export const metadata = {
  title: 'Warp Widget Host Example',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#fafafa' }}>{children}</body>
    </html>
  );
}

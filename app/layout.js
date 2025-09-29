export const metadata = {
  title: 'Demo App',
  description: 'Next.js starter in Docker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: 'system-ui, Arial, sans-serif', margin: 0, padding: 24 }}>
        {children}
      </body>
    </html>
  );
}

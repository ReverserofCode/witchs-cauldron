import type { CSSProperties, ReactNode } from 'react';

type NavItem = { label: string; href: string };

interface GlobalNavProps {
  brand?: ReactNode;
  items?: NavItem[];
}

const defaultItems: NavItem[] = [
  { label: '홈', href: '/' },
  { label: '소개', href: '/about' },
  { label: '서비스', href: '/services' },
  { label: '문의', href: '/contact' },
];

export default function GlobalNav({ brand = 'MyApp', items = defaultItems }: GlobalNavProps) {
  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <a href="/" style={styles.brand} aria-label="홈으로 이동">
          {brand}
        </a>

        <nav aria-label="글로벌 내비게이션">
          <ul style={styles.navList}>
            {items.map((item) => (
              <li key={item.href} style={styles.navItem}>
                <a href={item.href} style={styles.link}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    position: 'sticky',
    top: 0,
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    zIndex: 50,
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    textDecoration: 'none',
  },
  navList: {
    display: 'flex',
    listStyle: 'none',
    gap: 16,
    margin: 0,
    padding: 0,
  },
  navItem: {},
  link: {
    color: '#374151',
    textDecoration: 'none',
    padding: '6px 8px',
  },
};
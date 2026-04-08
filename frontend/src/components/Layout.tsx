import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import poweredByBggLogo from '../images/powered_by_BGG_01_SM.png';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/collection', label: 'Collection', icon: '🎲' },
  { to: '/trades', label: 'Trades', icon: '🤝' },
  { to: '/market', label: 'Market', icon: '🛒' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <span className="text-lg font-bold tracking-tight flex items-center gap-2">
            <span>🎲</span>
            <span className="text-indigo-400">GameCollector</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600/30 text-indigo-300'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 mb-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold uppercase">
              {user?.username?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.username}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-white/5 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
          <a
            href="https://boardgamegeek.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Powered by BGG - opens BoardGameGeek"
            className="mt-3 block rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors"
          >
            <img
              src={poweredByBggLogo}
              alt="Powered by BGG"
              className="h-8 w-full object-contain"
            />
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

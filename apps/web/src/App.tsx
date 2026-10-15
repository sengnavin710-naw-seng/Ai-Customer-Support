import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Globe2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dashboard, Session } from '@support/contracts';
import { api, ApiError } from './api';
import { preview } from './sample';
import { KnowledgeBase } from './knowledge-base/KnowledgeBase';

const navigation: { path: string; title: string; icon: LucideIcon }[] = [
  { path: '/', title: 'Overview', icon: LayoutDashboard },
  { path: '/inbox', title: 'Inbox', icon: Inbox },
  { path: '/knowledge-base', title: 'Knowledge Base', icon: BookOpen },
  { path: '/tickets', title: 'Tickets', icon: Ticket },
  { path: '/analytics', title: 'Analytics', icon: BarChart3 },
  { path: '/settings', title: 'Settings', icon: Settings },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isPreview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const expire = useCallback(() => {
    setSession(null);
    setPreview(false);
    setNotice('Your session expired. Please sign in again.');
  }, []);
  useEffect(() => {
    if (!session) return;
    const id = setTimeout(
      () => {
        setSession(null);
        setNotice('Your session expired. Please sign in again.');
      },
      Math.max(0, new Date(session.expiresAt).getTime() - Date.now()),
    );
    return () => clearTimeout(id);
  }, [session]);
  if (!session && !isPreview)
    return (
      <Login
        notice={notice}
        onLogin={(value) => {
          setSession(value);
          setNotice('');
        }}
        onPreview={() => {
          setPreview(true);
          navigate('/');
        }}
      />
    );
  return (
    <Workspace
      session={session}
      onExpired={expire}
      onSignIn={() => setPreview(false)}
      onExit={async () => {
        if (session) await api.logout(session.accessToken);
        setSession(null);
        setPreview(false);
        navigate('/');
      }}
    />
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <MessageCircle size={21} strokeWidth={2.5} />
      </span>
      <span>
        mingalar<span className="brand-dot">.</span>
        <small>SUPPORT WORKSPACE</small>
      </span>
    </div>
  );
}

function Login({
  onLogin,
  onPreview,
  notice,
}: {
  onLogin: (session: Session) => void;
  onPreview: () => void;
  notice: string;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      onLogin(await api.login(String(form.get('email')), String(form.get('password'))));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE CLOSER TO YOUR CUSTOMERS</span>
          <h1>
            Great support.
            <br />
            In their language.
          </h1>
          <p>A calmer place for your team to listen, understand, and help.</p>
          <div className="burmese-welcome" lang="my">
            မင်္ဂလာပါ။ ကြိုဆိုပါတယ်။
          </div>
        </div>
        <span className="login-foot">
          <ShieldCheck size={16} /> Built for thoughtful customer service
        </span>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="tag">DEVELOPMENT WORKSPACE</span>
          <h2>Welcome back</h2>
          <p>Sign in to your support workspace.</p>
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.test"
              maxLength={254}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
              required
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="divider">
            <span>or take a look around</span>
          </div>
          <button className="button secondary" onClick={onPreview}>
            Explore sample workspace <ArrowUpRight size={16} />
          </button>
          <p className="small muted">
            Preview uses fictional data. No customer systems are connected.
          </p>
          <details>
            <summary>Local setup help</summary>
            <p>
              Run <code>npm run setup</code> in the project root to create development credentials,
              then <code>npm run dev</code>. Credentials appear once in your terminal.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}

function Workspace({
  session,
  onExit,
  onExpired,
  onSignIn,
}: {
  session: Session | null;
  onExit: () => Promise<void>;
  onExpired: () => void;
  onSignIn: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState('');
  const location = useLocation();
  const page = navigation.find((item) => item.path === location.pathname)?.title ?? 'Overview';
  async function checkHealth() {
    setHealth('checking');
    try {
      await api.health();
      setHealth('online');
    } catch {
      setHealth('offline');
    }
  }
  useEffect(() => {
    void checkHealth();
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open && (
        <button
          aria-label="Close navigation"
          className="nav-backdrop"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button close-nav"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">M</span>
          <div>
            <strong>Mingalar Support</strong>
            <small>Development workspace</small>
          </div>
          <span className="workspace-label">DEV</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ path, title, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'}>
              <Icon size={19} />
              <span>{title}</span>
              {path === '/' && <span className="active-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="foundation-card">
            <span className="foundation-icon">
              <Sparkles size={17} />
            </span>
            <strong>Good things start here.</strong>
            <p>Your support foundation is ready. More possibilities ahead.</p>
            <Link to="/settings">
              View workspace <ArrowRight size={14} />
            </Link>
          </div>
          <div className="sidebar-help">
            <CircleHelp size={17} />
            <Link to="/settings">Workspace information</Link>
          </div>
          <button
            className="account"
            onClick={() =>
              void onExit().catch(() => setError('Sign out could not be confirmed. Please retry.'))
            }
          >
            <span className="avatar">{session ? 'WA' : 'SW'}</span>
            <span>
              <strong>{session ? session.user.name : 'Sample workspace'}</strong>
              <small>{session ? 'Administrator' : 'Preview mode'}</small>
            </span>
            <LogOut size={17} />
            <span className="sr-only">{session ? 'Sign out' : 'Exit preview'}</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Menu size={21} />
            </button>
            <PanelLeftClose size={17} className="desktop-icon" />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="api-status" role="status">
              <i className={health} />
              {health === 'online'
                ? 'API online'
                : health === 'offline'
                  ? 'API offline'
                  : 'Checking API'}
            </span>
            <span className="header-divider" />
            <span className="locale">
              <Globe2 size={16} /> EN / မြန်မာ
            </span>
            <span className="avatar small-avatar">M</span>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="sample-notice">
            <span>
              <span className="sample-dot" />
              {session ? 'Development workspace' : 'You’re exploring a sample workspace'}
              <span className="notice-detail">All conversations and metrics are synthetic.</span>
            </span>
            {session ? (
              <span className="milestone-label">MILESTONE 02 · PHASE 1</span>
            ) : (
              <button className="button secondary" onClick={onSignIn}>
                Sign in to Admin Workspace
              </button>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Routes>
            <Route path="/" element={<Overview session={session} onExpired={onExpired} />} />
            <Route
              path="/knowledge-base"
              element={
                <KnowledgeBase session={session} onExpired={onExpired} onSignIn={onSignIn} />
              }
            />
            {navigation
              .filter((item) => item.path !== '/' && item.path !== '/knowledge-base')
              .map((item) => (
                <Route
                  key={item.path}
                  path={item.path}
                  element={
                    <Placeholder
                      title={item.title}
                      icon={item.icon}
                      health={health}
                      onRefresh={() => void checkHealth()}
                    />
                  }
                />
              ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="page-footer">
            <span>Made for meaningful conversations.</span>
            <span>
              Mingalar Support <span>·</span> Development v0.1
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Overview({ session, onExpired }: { session: Session | null; onExpired: () => void }) {
  const [data, setData] = useState<Dashboard | null>(session ? null : preview);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!session) {
      setData(preview);
      return;
    }
    let active = true;
    setError('');
    void api
      .dashboard(session.accessToken)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) onExpired();
        else setError(error instanceof Error ? error.message : 'Unable to load dashboard.');
      });
    return () => {
      active = false;
    };
  }, [session, attempt, onExpired]);
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow greeting" lang="my">
            မင်္ဂလာပါ <span>✦</span>
          </div>
          <h1>A little overview. A lot of care.</h1>
          <p>Here’s what’s happening in your support workspace.</p>
        </div>
        <div className="period">
          <Clock3 size={16} />
          <span>{data?.period ?? 'Sample week · Oct 5–11'}</span>
        </div>
      </section>
      {error ? (
        <div role="alert" className="error-state">
          <p>{error}</p>
          <button className="button secondary" onClick={() => setAttempt((value) => value + 1)}>
            Retry dashboard
          </button>
        </div>
      ) : !data ? (
        <p role="status" className="loading">
          Loading your workspace…
        </p>
      ) : (
        <>
          <div className="metrics">
            <Metric
              title="Total conversations"
              value={data.metrics.conversations.toLocaleString('en-US')}
              change="12.8%"
              subtitle="vs. previous sample week"
              icon={MessageCircle}
              points="0,33 14,29 25,32 38,19 50,24 64,11 77,16 92,3"
            />
            <Metric
              title="Resolved conversations"
              value={data.metrics.resolved.toLocaleString('en-US')}
              change="8.2%"
              subtitle="vs. previous sample week"
              icon={Check}
              points="0,32 15,26 28,28 42,17 55,20 68,12 80,14 92,4"
            />
            <Metric
              title="Avg. response time"
              value={data.metrics.responseTime}
              change="18.4%"
              subtitle="faster in this sample"
              icon={Clock3}
              down
              points="0,5 13,12 26,8 40,21 53,18 66,28 80,24 92,33"
            />
            <Metric
              title="Customer satisfaction"
              value={data.metrics.satisfaction}
              change="2.1%"
              subtitle="vs. previous sample week"
              icon={Users}
              points="0,31 13,29 27,21 41,24 54,14 68,17 81,8 92,4"
            />
          </div>
          <div className="chart-row">
            <section className="card volume-card">
              <div className="card-header">
                <div>
                  <h2>Conversation activity</h2>
                  <p>A week of listening and helping.</p>
                </div>
                <span className="mini-tag">7 days · sample</span>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-square received" />
                  Received
                </span>
                <span>
                  <i className="legend-square resolved" />
                  Resolved
                </span>
              </div>
              <div
                className="bar-chart"
                role="img"
                aria-label={`Synthetic conversations by day. ${data.volume.map((day) => `${day.day}: ${day.received} received, ${day.resolved} resolved`).join('. ')}`}
              >
                <div className="axis">
                  <span>250</span>
                  <span>200</span>
                  <span>150</span>
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
                <div className="plot">
                  <div className="grid-lines">
                    {[0, 1, 2, 3, 4, 5].map((line) => (
                      <i key={line} />
                    ))}
                  </div>
                  <div className="bar-groups">
                    {data.volume.map((day) => (
                      <div className="bar-group" key={day.day}>
                        <div className="bar-pair">
                          <div
                            className="bar received"
                            style={{ height: `${(day.received / 250) * 100}%` }}
                          />
                          <div
                            className="bar resolved"
                            style={{ height: `${(day.resolved / 250) * 100}%` }}
                          />
                        </div>
                        <span>{day.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="chart-foot">
                <span className="positive">
                  <ArrowUpRight size={15} /> A little more connected this week
                </span>
                <span>Illustrative trend</span>
              </div>
            </section>
            <section className="card channels-card">
              <div className="card-header">
                <div>
                  <h2>Where conversations begin</h2>
                  <p>Sample channel distribution</p>
                </div>
              </div>
              <div className="donut-wrap">
                <div
                  className="donut"
                  role="img"
                  aria-label="Sample channels: Messenger 50%, Website 32%, Viber 18%"
                >
                  <div>
                    <strong>1,284</strong>
                    <span>conversations</span>
                  </div>
                </div>
              </div>
              <div className="channel-list">
                {[
                  { name: 'Messenger', count: '642', percent: '50%', color: '#25584b' },
                  { name: 'Website', count: '411', percent: '32%', color: '#a3bfac' },
                  { name: 'Viber', count: '231', percent: '18%', color: '#e7c796' },
                ].map((item) => (
                  <div key={item.name}>
                    <span>
                      <i style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <span>
                      {item.count}
                      <strong>{item.percent}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="card conversations-card">
            <div className="card-header">
              <div>
                <h2>
                  Recent conversations <span className="count-tag">4</span>
                </h2>
                <p>A glimpse of your customer conversations.</p>
              </div>
              <Link className="text-link" to="/inbox">
                Go to inbox <ArrowRight size={16} />
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Latest message</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conversations.map((conversation, index) => (
                    <tr key={conversation.id}>
                      <td>
                        <div className="customer">
                          <span className={`avatar tone-${index}`}>{conversation.initials}</span>
                          <strong>{conversation.name}</strong>
                        </div>
                      </td>
                      <td className="message" lang="my">
                        {conversation.message}
                      </td>
                      <td>
                        <span className="channel-icon">
                          <MessageCircle size={13} />
                          {conversation.channel}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${conversation.status.toLowerCase().replace(' ', '-')}`}
                        >
                          <i />
                          {conversation.status}
                        </span>
                      </td>
                      <td className="time-cell">{conversation.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="bottom-row">
            <section className="next-card">
              <span className="next-icon">
                <BookOpen size={22} />
              </span>
              <div>
                <span className="eyebrow">NEXT CHAPTER</span>
                <h3>Give your assistant a little knowledge.</h3>
                <p>Your knowledge base will be the starting point for helpful, grounded answers.</p>
              </div>
              <Link to="/knowledge-base" className="button secondary">
                Explore knowledge base <ArrowRight size={16} />
              </Link>
            </section>
            <section className="safety-note">
              <ShieldCheck size={20} />
              <div>
                <strong>A thoughtful foundation</strong>
                <p>No AI replies or live integrations yet. Your team stays in control.</p>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function Metric({
  title,
  value,
  change,
  subtitle,
  icon: Icon,
  points,
  down = false,
}: {
  title: string;
  value: string;
  change: string;
  subtitle: string;
  icon: LucideIcon;
  points: string;
  down?: boolean;
}) {
  const Arrow = down ? ArrowDownLeft : ArrowUpRight;
  return (
    <section className="card metric">
      <div className="metric-title">
        <span>{title}</span>
        <Icon size={17} />
      </div>
      <div className="metric-value">
        <strong>{value}</strong>
        <svg viewBox="0 0 96 40" aria-hidden="true">
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="metric-change">
        <span>
          <Arrow size={13} />
          {change}
        </span>
        <small>{subtitle}</small>
      </div>
    </section>
  );
}

const pageCopy: Record<string, { title: string; description: string; items: string[] }> = {
  Inbox: {
    title: 'Every conversation, one thoughtful space.',
    description:
      'The unified inbox will bring customer conversations and your team together. For now, this is your future inbox.',
    items: [
      'Conversation lists and assignment',
      'Burmese and English message views',
      'Human handoff and reply workflows',
    ],
  },
  'Knowledge Base': {
    title: 'Helpful answers start with good knowledge.',
    description:
      'A home for the information your team trusts. Article management and retrieval will arrive in a later milestone.',
    items: [
      'Draft and publish support articles',
      'Review imported knowledge',
      'Ground AI answers in approved sources',
    ],
  },
  Tickets: {
    title: 'Make sure nothing falls through the cracks.',
    description:
      'Track requests that need a little extra care. Ticket workflows are planned for a later milestone.',
    items: [
      'Create and assign support tickets',
      'Track status and priority',
      'Connect tickets to conversations',
    ],
  },
  Analytics: {
    title: 'Understand the care behind the numbers.',
    description:
      'The overview currently shows illustrative metrics. Real reporting will follow after support workflows are implemented.',
    items: [
      'Conversation and resolution trends',
      'Team response performance',
      'Answer quality and handoff insights',
    ],
  },
  Settings: {
    title: 'A clear view of your workspace.',
    description:
      'This development foundation uses synthetic data only. Configuration below is read-only; account and role management will come later.',
    items: [
      'Development-only admin authentication',
      'PostgreSQL development configuration',
      'No external customer systems connected',
    ],
  },
};
function Placeholder({
  title,
  icon: Icon,
  health,
  onRefresh,
}: {
  title: string;
  icon: LucideIcon;
  health: string;
  onRefresh: () => void;
}) {
  const content = pageCopy[title]!;
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{title}</h1>
          <p>A little room for what comes next.</p>
        </div>
        <span className="tag">{title === 'Settings' ? 'READ-ONLY' : 'PLANNED'}</span>
      </section>
      <section className="card placeholder-card">
        <span className="placeholder-icon">
          <Icon size={32} />
        </span>
        <span className="eyebrow">
          {title === 'Settings' ? 'MILESTONE 01 · FOUNDATION' : 'COMING IN A FUTURE MILESTONE'}
        </span>
        <h2>{content.title}</h2>
        <p>{content.description}</p>
        <div className="planned-items">
          {content.items.map((item) => (
            <div key={item}>
              {title === 'Settings' ? <Check size={16} /> : <MoreHorizontal size={16} />}
              <span>{item}</span>
            </div>
          ))}
        </div>
        <Link to="/" className="button secondary">
          Back to overview <ArrowRight size={16} />
        </Link>
      </section>
      {title === 'Settings' && (
        <section className="card connection-card">
          <div>
            <h2>API connection</h2>
            <p role="status">
              {health === 'online'
                ? 'API liveness check passed. Database readiness is checked separately.'
                : health === 'checking'
                  ? 'Checking the API…'
                  : 'API is unavailable. Start the backend and try again.'}
            </p>
            <small>
              AI, vector search, realtime messaging, and business integrations are not connected.
            </small>
          </div>
          <button className="button secondary" onClick={onRefresh} disabled={health === 'checking'}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </section>
      )}
    </>
  );
}

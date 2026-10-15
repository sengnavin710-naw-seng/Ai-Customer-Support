import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { api, ApiError, knowledgeApi } from '../api';
import { preview } from '../sample';
import type { Session } from '@support/contracts';
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    api: { health: vi.fn(), login: vi.fn(), logout: vi.fn(), dashboard: vi.fn() },
    knowledgeApi: { ...actual.knowledgeApi, articles: vi.fn() },
  };
});
const session: Session = {
  accessToken: 'synthetic-test-token',
  expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  user: { id: 'test', name: 'Workspace admin', email: 'admin@example.test', role: 'admin' },
};
function mount() {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
async function signIn() {
  const user = mount();
  await user.type(screen.getByLabelText('Email address'), 'admin@example.test');
  await user.type(screen.getByLabelText('Password'), 'synthetic-test-password');
  await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.health).mockResolvedValue({
    status: 'ok',
    service: 'support-api',
    timestamp: new Date().toISOString(),
  });
  vi.mocked(api.login).mockResolvedValue(session);
  vi.mocked(api.dashboard).mockResolvedValue(preview);
  vi.mocked(api.logout).mockResolvedValue(undefined);
  vi.mocked(knowledgeApi.articles).mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
});
describe('Workspace', () => {
  it.each(['Sign in to Admin Workspace', 'Sign in to manage knowledge'])(
    'leaves preview through %s and preserves the Knowledge Base destination after login',
    async (action) => {
      const user = mount();
      await user.click(screen.getByRole('button', { name: /Explore sample workspace/ }));
      await user.click(screen.getByRole('link', { name: 'Knowledge Base' }));
      expect(knowledgeApi.articles).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: action }));
      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
      expect(knowledgeApi.articles).not.toHaveBeenCalled();
      await user.type(screen.getByLabelText('Email address'), 'admin@example.test');
      await user.type(screen.getByLabelText('Password'), 'synthetic-test-password');
      await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
      expect(await screen.findByRole('button', { name: /New article/ })).toBeInTheDocument();
      expect(knowledgeApi.articles).toHaveBeenCalledWith(session.accessToken, expect.any(String));
      expect(api.dashboard).not.toHaveBeenCalled();
    },
  );
  it('starts with sign in and provides a labeled public synthetic preview', async () => {
    const user = mount();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Explore sample workspace/ }));
    expect(
      screen.getByRole('heading', { name: 'A little overview. A lot of care.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('All conversations and metrics are synthetic.')).toBeInTheDocument();
    expect(screen.getByText(preview.conversations[0]!.message)).toHaveAttribute('lang', 'my');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(api.dashboard).not.toHaveBeenCalled();
  });
  it('navigates to all five placeholder pages', async () => {
    const user = mount();
    await user.click(screen.getByRole('button', { name: /Explore sample workspace/ }));
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['Inbox', 'Knowledge Base', 'Tickets', 'Analytics', 'Settings']) {
      await user.click(within(nav).getByRole('link', { name }));
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('READ-ONLY')).toBeInTheDocument();
  });
  it('signs in and retrieves the protected dashboard', async () => {
    await signIn();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith('admin@example.test', 'synthetic-test-password');
    expect(api.dashboard).toHaveBeenCalledWith(session.accessToken);
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });
  it('shows login failures without entering the workspace', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError('Invalid credentials', 401));
    await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it('shows loading while the protected dashboard is pending', async () => {
    vi.mocked(api.dashboard).mockImplementation(() => new Promise(() => undefined));
    await signIn();
    expect(await screen.findByText('Loading your workspace…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('retries failed dashboard requests', async () => {
    vi.mocked(api.dashboard).mockRejectedValueOnce(new Error('Cannot reach the API.'));
    const user = await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the API.');
    await user.click(screen.getByRole('button', { name: 'Retry dashboard' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
  it('returns to sign in when a session is rejected', async () => {
    vi.mocked(api.dashboard).mockRejectedValue(new ApiError('Expired', 401));
    await signIn();
    expect(
      await screen.findByText('Your session expired. Please sign in again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
  it('revokes the server session when signing out', async () => {
    const user = await signIn();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(api.logout).toHaveBeenCalledWith(session.accessToken);
  });
  it('reports API downtime and allows refresh from settings', async () => {
    vi.mocked(api.health).mockRejectedValueOnce(new Error('offline'));
    const user = mount();
    await user.click(screen.getByRole('button', { name: /Explore sample workspace/ }));
    expect(await screen.findByText('API offline')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('API online')).toBeInTheDocument();
  });
  it('opens and closes the mobile navigation', async () => {
    const user = mount();
    await user.click(screen.getByRole('button', { name: /Explore sample workspace/ }));
    const button = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  });
});

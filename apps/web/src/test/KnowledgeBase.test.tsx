import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, Category, Session } from '@support/contracts';
import { KnowledgeBase } from '../knowledge-base/KnowledgeBase';
import { knowledgeApi, ApiError } from '../api';
vi.mock('../api', async (original) => {
  const actual = await original<typeof import('../api')>();
  return {
    ...actual,
    knowledgeApi: Object.fromEntries(Object.keys(actual.knowledgeApi).map((key) => [key, vi.fn()])),
  };
});
const session: Session = {
  accessToken: 'test-token',
  expiresAt: '2099-01-01',
  user: { id: 'dev-admin', name: 'Admin', email: 'admin@example.test', role: 'admin' },
};
const category: Category = {
  id: 'cat-1',
  name: 'Synthetic shipping',
  description: 'Synthetic only',
  revision: 1,
  createdAt: '2026-10-09',
  updatedAt: '2026-10-09',
};
const article: Article = {
  id: 'article-1',
  articleId: 'article-1',
  categoryId: category.id,
  categoryName: category.name,
  revision: 1,
  version: 1,
  title: 'မင်္ဂလာပါ',
  body: 'Synthetic Burmese support content',
  language: 'my',
  status: 'draft',
  createdBy: 'dev-admin',
  ownerId: 'dev-admin',
  createdAt: '2026-10-09',
  updatedAt: '2026-10-09',
  archivedAt: null,
  submittedBy: null,
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
};
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, limit: 10 });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(knowledgeApi.articles).mockResolvedValue(page([article]));
  vi.mocked(knowledgeApi.article).mockResolvedValue(article);
  vi.mocked(knowledgeApi.categories).mockResolvedValue(page([category]));
  vi.mocked(knowledgeApi.versions).mockResolvedValue(page([article]));
  vi.mocked(knowledgeApi.audit).mockResolvedValue(page([]));
  vi.mocked(knowledgeApi.createArticle).mockResolvedValue(article);
  vi.mocked(knowledgeApi.updateArticle).mockResolvedValue({ ...article, version: 2, revision: 2 });
  vi.mocked(knowledgeApi.submit).mockResolvedValue({ ...article, status: 'pending', revision: 2 });
  vi.mocked(knowledgeApi.review).mockResolvedValue({ ...article, status: 'approved', revision: 3 });
  vi.mocked(knowledgeApi.createCategory).mockResolvedValue(category);
});
function mount(value: Session | null = session, onExpired = vi.fn()) {
  render(<KnowledgeBase session={value} onExpired={onExpired} onSignIn={vi.fn()} />);
  return userEvent.setup();
}
async function open() {
  const user = mount();
  await user.click(await screen.findByRole('button', { name: /မင်္ဂလာပါ/ }));
  await screen.findByLabelText('Title');
  return user;
}
describe('API-backed Knowledge Base', () => {
  it('requires sign in in sample preview without fetching or inventing articles', () => {
    mount(null);
    expect(
      screen.getByRole('heading', { name: 'Sign in to manage knowledge' }),
    ).toBeInTheDocument();
    expect(knowledgeApi.articles).not.toHaveBeenCalled();
  });
  it('shows a loading state and then an explicit empty state', async () => {
    vi.mocked(knowledgeApi.articles).mockResolvedValue(page([]));
    mount();
    expect(screen.getByText('Loading articles…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'No articles found' })).toBeInTheDocument();
  });
  it('searches and filters using API query parameters', async () => {
    const user = mount();
    await screen.findByRole('button', { name: /မင်္ဂလာပါ/ });
    await user.type(screen.getByLabelText('Search articles'), 'မြန်မာ');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.selectOptions(screen.getByLabelText('Status'), 'approved');
    await waitFor(() =>
      expect(knowledgeApi.articles).toHaveBeenLastCalledWith(
        'test-token',
        expect.stringContaining('status=approved'),
      ),
    );
    const query = vi.mocked(knowledgeApi.articles).mock.calls.at(-1)![1]!;
    expect(new URLSearchParams(query).get('q')).toBe('မြန်မာ');
  });
  it('creates a draft and sends no approval fields', async () => {
    const user = mount();
    await user.click(screen.getByRole('button', { name: 'New article' }));
    await user.type(screen.getByLabelText('Title'), 'New synthetic answer');
    await screen.findByRole('option', { name: category.name });
    await user.selectOptions(screen.getByLabelText('Category'), category.id);
    await user.type(screen.getByLabelText('Article content'), 'Synthetic content only');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(knowledgeApi.createArticle).toHaveBeenCalledWith('test-token', {
      categoryId: category.id,
      title: 'New synthetic answer',
      body: 'Synthetic content only',
      language: 'my',
    });
    expect(await screen.findByRole('button', { name: 'Save new version' })).toBeInTheDocument();
  });
  it('saves edits with the expected revision and opens version history', async () => {
    const user = await open();
    await user.clear(screen.getByLabelText('Article content'));
    await user.type(screen.getByLabelText('Article content'), 'Revised synthetic answer');
    await user.click(screen.getByRole('button', { name: 'Save new version' }));
    expect(knowledgeApi.updateArticle).toHaveBeenCalledWith(
      'test-token',
      article.id,
      expect.objectContaining({ body: 'Revised synthetic answer', expectedRevision: 1 }),
    );
    expect(await screen.findByText('VERSION 2 · DRAFT')).toBeInTheDocument();
    expect(knowledgeApi.versions).toHaveBeenCalledWith('test-token', article.id, 1);
  });
  it('submits saved drafts and explicitly approves a pending version', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Submit saved version for review' }));
    expect(knowledgeApi.submit).toHaveBeenCalledWith('test-token', article.id, 1);
    const approve = await screen.findByRole('button', { name: 'Approve version' });
    expect(screen.getByRole('button', { name: 'Reject version' })).toBeDisabled();
    expect(screen.getByLabelText('Article content')).toBeDisabled();
    await user.click(approve);
    expect(knowledgeApi.review).toHaveBeenCalledWith('test-token', article.id, 2, 'approve', '');
    expect(await screen.findByText('VERSION 1 · APPROVED')).toBeInTheDocument();
  });
  it('requires a note for rejection and sends it to the API', async () => {
    vi.mocked(knowledgeApi.article).mockResolvedValue({ ...article, status: 'pending' });
    const user = await open();
    expect(screen.getByRole('button', { name: 'Reject version' })).toBeDisabled();
    await user.type(screen.getByLabelText('Review note'), 'Needs clarification');
    await user.click(screen.getByRole('button', { name: 'Reject version' }));
    expect(knowledgeApi.review).toHaveBeenCalledWith(
      'test-token',
      article.id,
      1,
      'reject',
      'Needs clarification',
    );
  });
  it('requires an explicit archive confirmation', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Archive article' }));
    expect(knowledgeApi.archive).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm archive' }));
    expect(knowledgeApi.archive).toHaveBeenCalledWith('test-token', article.id, 1);
    expect(await screen.findByText(/Article archived. Its versions/)).toBeInTheDocument();
  });
  it('does not submit a saved version while unsaved changes are displayed', async () => {
    const user = await open();
    await user.type(screen.getByLabelText('Title'), ' unsaved');
    expect(screen.getByRole('button', { name: 'Submit saved version for review' })).toBeDisabled();
    expect(knowledgeApi.submit).not.toHaveBeenCalled();
  });
  it('hides admin actions for agents', async () => {
    vi.mocked(knowledgeApi.article).mockResolvedValue({ ...article, status: 'pending' });
    const user = mount({ ...session, user: { ...session.user, id: 'agent', role: 'agent' } });
    await user.click(await screen.findByRole('button', { name: /မင်္ဂလာပါ/ }));
    await screen.findByLabelText('Title');
    expect(screen.queryByRole('button', { name: 'Approve version' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive article' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Categories' }));
    expect(
      screen.getByText('Only administrators can create or change categories.'),
    ).toBeInTheDocument();
  });
  it('creates a category and handles stale edits without erasing draft input', async () => {
    const user = mount();
    await user.click(screen.getByRole('button', { name: 'Categories' }));
    await user.type(screen.getByLabelText('Category name'), 'Synthetic FAQs');
    await user.type(screen.getByLabelText('Description'), 'Synthetic description');
    await user.click(screen.getByRole('button', { name: 'Create category' }));
    expect(knowledgeApi.createCategory).toHaveBeenCalledWith('test-token', {
      name: 'Synthetic FAQs',
      description: 'Synthetic description',
    });
    await user.click(screen.getByRole('button', { name: 'Articles' }));
    await user.click(await screen.findByRole('button', { name: /မင်္ဂလာပါ/ }));
    vi.mocked(knowledgeApi.updateArticle).mockRejectedValue(
      new ApiError('Article changed. Reload before saving.', 409),
    );
    await user.type(await screen.findByLabelText('Title'), ' revised');
    await user.click(screen.getByRole('button', { name: 'Save new version' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Article changed.');
    expect(screen.getByLabelText('Title')).toHaveValue('မင်္ဂလာပါ revised');
  });
  it('retries a failed list and handles expired sessions', async () => {
    vi.mocked(knowledgeApi.articles).mockRejectedValueOnce(
      new ApiError('Storage unavailable', 503),
    );
    const expired = vi.fn();
    const user = mount(session, expired);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Retry list' }));
    await screen.findByRole('button', { name: /မင်္ဂလာပါ/ });
    vi.mocked(knowledgeApi.articles).mockRejectedValueOnce(new ApiError('Session expired', 401));
    await user.selectOptions(screen.getByLabelText('Status'), 'draft');
    await waitFor(() => expect(expired).toHaveBeenCalled());
  });
  it('loads the next page and audit records from the API', async () => {
    vi.mocked(knowledgeApi.articles).mockResolvedValue({ ...page([article]), total: 11 });
    const user = mount();
    await screen.findByRole('button', { name: /မင်္ဂလာပါ/ });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(knowledgeApi.articles).toHaveBeenLastCalledWith(
        'test-token',
        expect.stringContaining('page=2'),
      ),
    );
    await user.click(screen.getByRole('button', { name: /မင်္ဂလာပါ/ }));
    await user.click(await screen.findByRole('button', { name: 'Load audit records' }));
    expect(knowledgeApi.audit).toHaveBeenCalledWith('test-token', article.id, 1);
    expect(within(screen.getByRole('list')).queryAllByRole('listitem')).toHaveLength(0);
  });
});

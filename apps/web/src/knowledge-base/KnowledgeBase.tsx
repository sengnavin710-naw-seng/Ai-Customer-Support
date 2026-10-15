import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpen, Plus, RefreshCw, Search } from 'lucide-react';
import type {
  Article,
  ArticleInput,
  ArticleVersion,
  AuditRecord,
  Category,
  Page,
  Session,
} from '@support/contracts';
import { ApiError, knowledgeApi } from '../api';
import './knowledge.css';

type ErrorHandler = (error: unknown) => void;
function message(error: unknown) {
  return error instanceof Error ? error.message : 'The operation failed. Please retry.';
}
export function KnowledgeBase({
  session,
  onExpired,
  onSignIn,
}: {
  session: Session | null;
  onExpired: () => void;
  onSignIn: () => void;
}) {
  return (
    <section className="kb">
      <div className="page-heading">
        <div>
          <span className="eyebrow">APPROVED KNOWLEDGE, THOUGHTFUL SUPPORT</span>
          <h1>Knowledge Base</h1>
          <p>Create, review, and maintain your support knowledge.</p>
        </div>
        <span className="tag">PHASE 1 · NO AI CONNECTED</span>
      </div>
      {session ? (
        <KnowledgeWorkspace session={session} onExpired={onExpired} />
      ) : (
        <div className="card placeholder-card">
          <BookOpen size={32} />
          <h2>Sign in to manage knowledge</h2>
          <p>
            Knowledge Base uses protected APIs and PostgreSQL. Exit sample preview and sign in with
            your development account. No sample articles are substituted for real API data.
          </p>
          <button className="button primary" onClick={onSignIn}>
            Sign in to manage knowledge
          </button>
        </div>
      )}
    </section>
  );
}
function KnowledgeWorkspace({ session, onExpired }: { session: Session; onExpired: () => void }) {
  const [tab, setTab] = useState<'articles' | 'categories'>('articles');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [archive, setArchive] = useState('active');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Article> | null>(null);
  const [selected, setSelected] = useState<Article | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const token = session.accessToken;
  const fail: ErrorHandler = useCallback(
    (error) => {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setError(message(error));
    },
    [onExpired],
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ q: search, page: String(page), limit: '10', archive });
    if (status) params.set('status', status);
    void knowledgeApi
      .articles(token, params.toString())
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (active) {
          if (error instanceof ApiError && error.status === 401) onExpired();
          else setError(message(error));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, search, status, archive, page, refresh, onExpired]);
  async function open(id: string) {
    setOpening(true);
    setError('');
    setNotice('');
    try {
      setSelected(await knowledgeApi.article(token, id));
      setCreating(false);
    } catch (error) {
      fail(error);
    } finally {
      setOpening(false);
    }
  }
  function saved(article: Article) {
    setSelected(article);
    setCreating(false);
    setNotice('Article saved. Only an approved current version is eligible for future retrieval.');
    setError('');
    setRefresh((value) => value + 1);
  }
  return (
    <>
      <div className="kb-policy">
        <strong>Development authentication · synthetic content only</strong>
        <p>
          Drafts, pending reviews, rejected versions, and archived articles are excluded from future
          retrieval. Editing an approved article creates a new draft and removes it from the
          approved view until reviewed.
        </p>
      </div>
      <div className="kb-tabs" role="group" aria-label="Knowledge sections">
        <button className={tab === 'articles' ? 'active' : ''} onClick={() => setTab('articles')}>
          Articles
        </button>
        <button
          className={tab === 'categories' ? 'active' : ''}
          onClick={() => setTab('categories')}
        >
          Categories
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button
            className="button secondary"
            onClick={() => {
              setError('');
              setRefresh((value) => value + 1);
            }}
          >
            Retry list
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="kb-success">
          {notice}
        </p>
      )}
      {tab === 'categories' ? (
        <Categories
          session={session}
          onError={fail}
          onChange={() => setRefresh((value) => value + 1)}
        />
      ) : (
        <>
          <div className="kb-toolbar">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(query);
              }}
            >
              <label className="sr-only" htmlFor="kb-search">
                Search articles
              </label>
              <input
                id="kb-search"
                placeholder="Search titles or content…"
                value={query}
                maxLength={100}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="button secondary">
                <Search size={16} />
                Search
              </button>
            </form>
            <label>
              Status
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {['draft', 'pending', 'approved', 'rejected'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Visibility
              <select
                value={archive}
                onChange={(event) => {
                  setArchive(event.target.value);
                  setPage(1);
                }}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All articles</option>
              </select>
            </label>
            <button
              className="button primary"
              onClick={() => {
                setSelected(null);
                setCreating(true);
                setError('');
                setNotice('');
              }}
            >
              <Plus size={16} />
              New article
            </button>
          </div>
          <div className="kb-layout">
            <section className="card kb-list" aria-label="Articles">
              {loading ? (
                <p role="status">Loading articles…</p>
              ) : data ? (
                <>
                  {data.items.length === 0 ? (
                    <div className="kb-empty">
                      <BookOpen size={25} />
                      <h2>No articles found</h2>
                      <p>
                        Create a category and your first synthetic article, or change your filters.
                      </p>
                    </div>
                  ) : (
                    data.items.map((article) => (
                      <button
                        disabled={opening}
                        className={`kb-list-item ${selected?.id === article.id ? 'selected' : ''}`}
                        key={article.id}
                        onClick={() => void open(article.id)}
                      >
                        <span
                          className={`kb-status ${article.archivedAt ? 'archived' : article.status}`}
                        >
                          {article.archivedAt ? 'archived' : article.status}
                        </span>
                        <strong>{article.title}</strong>
                        <span>
                          {article.categoryName} ·{' '}
                          {article.language === 'my' ? 'မြန်မာ' : 'English'} · v{article.version}
                        </span>
                      </button>
                    ))
                  )}
                  <Pager page={page} total={data.total} limit={10} onChange={setPage} />
                </>
              ) : (
                <p>Knowledge Base data is unavailable. Retry when the API is ready.</p>
              )}
            </section>
            <div>
              {opening && <p role="status">Opening article…</p>}
              {creating || selected ? (
                <ArticleEditor
                  key={selected ? `${selected.id}:${selected.revision}` : 'new'}
                  session={session}
                  article={selected}
                  onSaved={saved}
                  onError={fail}
                  onReload={() => selected && void open(selected.id)}
                  onClose={() => {
                    setSelected(null);
                    setCreating(false);
                  }}
                  onArchived={() => {
                    setSelected(null);
                    setRefresh((value) => value + 1);
                    setNotice('Article archived. Its versions and audit history are retained.');
                  }}
                />
              ) : (
                <div className="card kb-empty">
                  <BookOpen size={30} />
                  <h2>A home for trusted answers</h2>
                  <p>
                    Select an article to review its content and version history, or create a new
                    draft.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
function Pager({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="kb-pager">
      <button className="button secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} · {total} total
      </span>
      <button
        className="button secondary"
        disabled={page * limit >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

function CategoryPicker({
  token,
  value,
  currentLabel,
  onChange,
  onError,
}: {
  token: string;
  value: string;
  currentLabel?: string;
  onChange: (id: string) => void;
  onError: ErrorHandler;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Category> | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void knowledgeApi
      .categories(
        token,
        new URLSearchParams({ q: search, page: String(page), limit: '20' }).toString(),
      )
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (active) {
          setError(message(error));
          if (error instanceof ApiError && error.status === 401) onError(error);
        }
      });
    return () => {
      active = false;
    };
  }, [token, search, page, retry, onError]);
  return (
    <fieldset className="kb-category-picker">
      <legend>Article category</legend>
      <div className="kb-inline">
        <input
          aria-label="Find category"
          value={query}
          maxLength={100}
          placeholder="Find a category…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setSearch(query);
            setPage(1);
            setRetry((value) => value + 1);
          }}
        >
          Find
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <label>
        Category
        <select required value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose a category</option>
          {value && !data?.items.some((cat) => cat.id === value) && (
            <option value={value}>{currentLabel ?? 'Selected category'}</option>
          )}
          {data?.items.map((cat) => (
            <option value={cat.id} key={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      {data && data.total === 0 && <p>Create a category in the Categories tab first.</p>}
      {data && data.total > 20 && (
        <div className="kb-inline">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous categories
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            disabled={page * 20 >= data.total}
            onClick={() => setPage(page + 1)}
          >
            Next categories
          </button>
        </div>
      )}
    </fieldset>
  );
}
function ArticleEditor({
  session,
  article,
  onSaved,
  onError,
  onReload,
  onClose,
  onArchived,
}: {
  session: Session;
  article: Article | null;
  onSaved: (article: Article) => void;
  onError: ErrorHandler;
  onReload: () => void;
  onClose: () => void;
  onArchived: () => void;
}) {
  const [form, setForm] = useState<ArticleInput>({
    title: article?.title ?? '',
    body: article?.body ?? '',
    language: article?.language ?? 'my',
    categoryId: article?.categoryId ?? '',
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const token = session.accessToken;
  const admin = session.user.role === 'admin';
  const dirty =
    article !== null &&
    (form.title !== article.title ||
      form.body !== article.body ||
      form.categoryId !== article.categoryId ||
      form.language !== article.language);
  const canEdit =
    !article ||
    (!article.archivedAt &&
      article.status !== 'pending' &&
      (admin || article.ownerId === session.user.id));
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () =>
      onSaved(
        article
          ? await knowledgeApi.updateArticle(token, article.id, {
              ...form,
              expectedRevision: article.revision,
            })
          : await knowledgeApi.createArticle(token, form),
      ),
    );
  }
  return (
    <section className="card kb-editor">
      <div className="kb-editor-head">
        <div>
          <span className="eyebrow">
            {article ? `VERSION ${article.version} · ${article.status.toUpperCase()}` : 'NEW DRAFT'}
          </span>
          <h2>{article ? 'Article details' : 'Create an article'}</h2>
        </div>
        <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>
      {article?.reviewNote && <p className="notice">Review note: {article.reviewNote}</p>}
      <form onSubmit={save}>
        <fieldset disabled={busy || !canEdit}>
          <label>
            Title
            <input
              value={form.title}
              maxLength={200}
              required
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <CategoryPicker
            token={token}
            value={form.categoryId}
            currentLabel={article?.categoryName}
            onError={onError}
            onChange={(categoryId) => setForm({ ...form, categoryId })}
          />
          <label>
            Language
            <select
              value={form.language}
              onChange={(event) =>
                setForm({ ...form, language: event.target.value as 'my' | 'en' })
              }
            >
              <option value="my">မြန်မာ / Burmese</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Article content
            <textarea
              value={form.body}
              lang={form.language}
              rows={10}
              maxLength={10000}
              required
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </label>
          <p className="small muted">
            Plain text · {form.body.length.toLocaleString()} / 10,000 characters. Every save creates
            a new draft version.
          </p>
          {canEdit && (
            <button className="button primary" type="submit">
              {busy ? 'Saving…' : article ? 'Save new version' : 'Create draft'}
            </button>
          )}
        </fieldset>
      </form>
      {article && (
        <>
          <div className="kb-actions">
            {!article.archivedAt &&
              article.status === 'draft' &&
              (admin || article.ownerId === session.user.id) && (
                <button
                  disabled={busy || dirty}
                  className="button primary"
                  onClick={() =>
                    void run(async () =>
                      onSaved(await knowledgeApi.submit(token, article.id, article.revision)),
                    )
                  }
                >
                  Submit saved version for review
                </button>
              )}
            <button className="button secondary" disabled={busy} onClick={onReload}>
              <RefreshCw size={14} />
              Reload saved article
            </button>
          </div>
          {article.status === 'draft' && (
            <p className="small muted">
              Submit reviews the saved version. Save your edits before submitting.
            </p>
          )}
          {admin && !article.archivedAt && article.status === 'pending' && (
            <div className="kb-review">
              <h3>Review version {article.version}</h3>
              <p>
                Approval applies only to this saved version. Phase 1 permits administrator
                self-approval.
              </p>
              <label>
                Review note
                <textarea
                  value={note}
                  maxLength={1000}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Required when rejecting"
                  rows={3}
                />
              </label>
              <div className="kb-actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () =>
                      onSaved(
                        await knowledgeApi.review(
                          token,
                          article.id,
                          article.revision,
                          'approve',
                          note,
                        ),
                      ),
                    )
                  }
                >
                  Approve version
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    void run(async () =>
                      onSaved(
                        await knowledgeApi.review(
                          token,
                          article.id,
                          article.revision,
                          'reject',
                          note,
                        ),
                      ),
                    )
                  }
                >
                  Reject version
                </button>
              </div>
            </div>
          )}
          {admin && !article.archivedAt && (
            <div className="kb-archive">
              {confirm ? (
                <>
                  <p>
                    Archive this article? It will be excluded from future retrieval. History will be
                    retained.
                  </p>
                  <button
                    disabled={busy}
                    className="button danger"
                    onClick={() =>
                      void run(async () => {
                        await knowledgeApi.archive(token, article.id, article.revision);
                        onArchived();
                      })
                    }
                  >
                    Confirm archive
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setConfirm(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirm(true)}
                >
                  Archive article
                </button>
              )}
            </div>
          )}
          <History token={token} article={article} admin={admin} onError={onError} />
        </>
      )}
    </section>
  );
}
function History({
  token,
  article,
  admin,
  onError,
}: {
  token: string;
  article: Article;
  admin: boolean;
  onError: ErrorHandler;
}) {
  const [versions, setVersions] = useState<Page<ArticleVersion> | null>(null);
  const [audit, setAudit] = useState<Page<AuditRecord> | null>(null);
  const [page, setPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void knowledgeApi
      .versions(token, article.id, page)
      .then((value) => {
        if (active) setVersions(value);
      })
      .catch((error) => {
        if (active) {
          setError(message(error));
          if (error instanceof ApiError && error.status === 401) onError(error);
        }
      });
    return () => {
      active = false;
    };
  }, [token, article.id, page, retry, onError]);
  async function loadAudit(next = 1) {
    try {
      setAudit(await knowledgeApi.audit(token, article.id, next));
      setAuditPage(next);
    } catch (error) {
      onError(error);
    }
  }
  return (
    <div className="kb-history">
      <h3>Version history</h3>
      {error && (
        <p role="alert" className="error">
          {error}
          <button onClick={() => setRetry((value) => value + 1)}>Retry history</button>
        </p>
      )}
      {versions?.items.map((version) => (
        <details key={version.version}>
          <summary>
            Version {version.version} · {version.status} · {version.title}
          </summary>
          <p className="small muted">
            Author: {version.createdBy}
            {version.reviewedBy && ` · Reviewed by: ${version.reviewedBy}`}
          </p>
          <p className="kb-body" lang={version.language}>
            {version.body}
          </p>
          {version.reviewNote && <p>Review: {version.reviewNote}</p>}
        </details>
      ))}
      {versions && <Pager page={page} total={versions.total} limit={5} onChange={setPage} />}{' '}
      {admin && (
        <>
          <button className="button secondary" onClick={() => void loadAudit()}>
            Load audit records
          </button>
          {audit && (
            <>
              <ul className="kb-audit">
                {audit.items.map((record) => (
                  <li key={record.id}>
                    <strong>{record.action}</strong>
                    <span>
                      {record.actorId} ({record.actorRole}) ·{' '}
                      {new Date(record.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              <Pager
                page={auditPage}
                total={audit.total}
                limit={10}
                onChange={(page) => void loadAudit(page)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
function Categories({
  session,
  onError,
  onChange,
}: {
  session: Session;
  onError: ErrorHandler;
  onChange: () => void;
}) {
  const [data, setData] = useState<Page<Category> | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const token = session.accessToken;
  const admin = session.user.role === 'admin';
  useEffect(() => {
    let active = true;
    setError('');
    void knowledgeApi
      .categories(
        token,
        new URLSearchParams({ q: search, page: String(page), limit: '10' }).toString(),
      )
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (active) {
          setError(message(error));
          if (error instanceof ApiError && error.status === 401) onError(error);
        }
      });
    return () => {
      active = false;
    };
  }, [token, search, page, refresh, onError]);
  function clear() {
    setSelected(null);
    setName('');
    setDescription('');
    setConfirm(false);
  }
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      clear();
      setRefresh((value) => value + 1);
      onChange();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="kb-layout">
      <section className="card kb-editor">
        <h2>Categories</h2>
        <form
          className="kb-inline"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query);
            setPage(1);
            setRefresh((value) => value + 1);
          }}
        >
          <input
            aria-label="Search categories"
            placeholder="Search categories…"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button secondary">Search categories</button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Loading categories…</p>}
        {data?.items.length === 0 && <p>No categories found.</p>}
        {data?.items.map((category) => (
          <div className="kb-category-row" key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <p>{category.description}</p>
            </div>
            {admin && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setSelected(category);
                  setName(category.name);
                  setDescription(category.description);
                  setConfirm(false);
                }}
              >
                Edit {category.name}
              </button>
            )}
          </div>
        ))}
        {data && <Pager page={page} total={data.total} limit={10} onChange={setPage} />}
      </section>
      {admin ? (
        <section className="card kb-editor">
          <h2>{selected ? 'Edit category' : 'Create category'}</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(() =>
                selected
                  ? knowledgeApi.updateCategory(token, selected.id, {
                      name,
                      description,
                      expectedRevision: selected.revision,
                    })
                  : knowledgeApi.createCategory(token, { name, description }),
              );
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Category name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  rows={4}
                />
              </label>
              <div className="kb-actions">
                <button className="button primary">
                  {selected ? 'Save category' : 'Create category'}
                </button>
                {selected && (
                  <button type="button" className="button secondary" onClick={clear}>
                    Cancel editing
                  </button>
                )}
              </div>
            </fieldset>
          </form>
          {selected && (
            <div className="kb-archive">
              {confirm ? (
                <>
                  <p>
                    Delete this category? Categories referenced by any article version cannot be
                    deleted.
                  </p>
                  <button
                    disabled={busy}
                    className="button danger"
                    onClick={() =>
                      void mutate(() =>
                        knowledgeApi.deleteCategory(token, selected.id, selected.revision),
                      )
                    }
                  >
                    Confirm delete
                  </button>
                  <button
                    disabled={busy}
                    className="button secondary"
                    onClick={() => setConfirm(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirm(true)}
                >
                  Delete category
                </button>
              )}
            </div>
          )}
        </section>
      ) : (
        <p>Only administrators can create or change categories.</p>
      )}
    </div>
  );
}

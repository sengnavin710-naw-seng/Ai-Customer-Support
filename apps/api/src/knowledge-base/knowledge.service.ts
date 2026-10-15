import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  Article,
  ArticleVersion,
  AuditRecord,
  Category,
  Page,
  User,
} from '@support/contracts';
import { DatabaseService } from '../database/database.module';
import type {
  ArticleDto,
  ArticleQuery,
  AuditQuery,
  CategoryDto,
  PageQuery,
  ReviewDto,
  SearchQuery,
  UpdateArticleDto,
  UpdateCategoryDto,
} from './knowledge.dto';

const categoryColumns =
  'id, name, description, revision, created_at AS "createdAt", updated_at AS "updatedAt"';
const versionColumns = `v.article_id AS "articleId", v.category_id AS "categoryId", v.version, v.title, v.body, v.language, v.status,
  v.created_by AS "createdBy", v.created_at AS "createdAt", v.submitted_by AS "submittedBy",
  v.submitted_at AS "submittedAt", v.reviewed_by AS "reviewedBy", v.reviewed_at AS "reviewedAt", v.review_note AS "reviewNote"`;
const articleSelect = `SELECT a.id, c.name AS "categoryName", a.revision,
  a.created_by AS "ownerId", a.updated_at AS "updatedAt", a.archived_at AS "archivedAt", ${versionColumns}
  FROM kb_articles a JOIN kb_article_versions v ON v.article_id=a.id AND v.version=a.current_version
  JOIN kb_categories c ON c.id=a.category_id`;
// Escape LIKE metacharacters: searching % or _ is literal, never a wildcard scan.
const search = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

@Injectable()
export class KnowledgeService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  private allow(user: User, admin = false): void {
    if (!['admin', 'agent'].includes(user.role) || (admin && user.role !== 'admin'))
      throw new ForbiddenException('Insufficient permissions');
  }
  private async run<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(work);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const code =
        typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code === '23505') throw new ConflictException('That category name already exists');
      if (code === '23503')
        throw new ConflictException('Category is missing or still referenced by an article');
      if (['40001', '40P01', '55P03'].includes(code))
        throw new ConflictException('A concurrent change occurred. Reload and retry.');
      if (['23514', '22001', '22021'].includes(code))
        throw new BadRequestException('Invalid knowledge base content');
      if (
        ['42P01', 'ECONNREFUSED', '57P01', '57014', '28P01'].includes(code) ||
        code.startsWith('08')
      )
        throw new ServiceUnavailableException(
          'Knowledge base storage unavailable. Check database and migrations.',
        );
      throw new InternalServerErrorException('Knowledge base operation failed');
    }
  }
  private async page<T>(
    client: PoolClient,
    select: string,
    values: unknown[],
    query: PageQuery,
    order: string,
  ): Promise<Page<T>> {
    const result = await client.query<{ items: T[]; total: number }>(
      `WITH filtered AS (${select})
      SELECT (SELECT count(*)::int FROM filtered) AS total,
      COALESCE((SELECT json_agg(p) FROM (SELECT * FROM filtered ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}) p), '[]'::json) AS items`,
      [...values, query.limit, (query.page - 1) * query.limit],
    );
    return { ...result.rows[0]!, page: query.page, limit: query.limit };
  }
  private async audit(
    client: PoolClient,
    user: User,
    action: string,
    id: string,
    version: number | null = null,
  ): Promise<void> {
    await client.query(
      'INSERT INTO kb_audit_records(actor_id,actor_role,action,entity_id,version) VALUES ($1,$2,$3,$4,$5)',
      [user.id, user.role, action, id, version],
    );
  }
  listCategories(user: User, query: SearchQuery): Promise<Page<Category>> {
    this.allow(user);
    return this.run((client) =>
      this.page(
        client,
        `SELECT ${categoryColumns} FROM kb_categories WHERE name ILIKE $1 OR description ILIKE $1`,
        [search(query.q)],
        query,
        'name ASC, id ASC',
      ),
    );
  }
  getCategory(user: User, id: string): Promise<Category> {
    this.allow(user);
    return this.run(async (client) => {
      const row = (
        await client.query<Category>(`SELECT ${categoryColumns} FROM kb_categories WHERE id=$1`, [
          id,
        ])
      ).rows[0];
      if (!row) throw new NotFoundException('Category not found');
      return row;
    });
  }
  createCategory(user: User, input: CategoryDto): Promise<Category> {
    this.allow(user, true);
    return this.run(async (client) => {
      const row = (
        await client.query<Category>(
          `INSERT INTO kb_categories(name,description) VALUES ($1,$2) RETURNING ${categoryColumns}`,
          [input.name, input.description],
        )
      ).rows[0]!;
      await this.audit(client, user, 'category.created', row.id);
      return row;
    });
  }
  updateCategory(user: User, id: string, input: UpdateCategoryDto): Promise<Category> {
    this.allow(user, true);
    return this.run(async (client) => {
      await this.lockCategory(client, id, input.expectedRevision);
      const row = (
        await client.query<Category>(
          `UPDATE kb_categories SET name=$2,description=$3,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING ${categoryColumns}`,
          [id, input.name, input.description],
        )
      ).rows[0]!;
      await this.audit(client, user, 'category.updated', id);
      return row;
    });
  }
  deleteCategory(user: User, id: string, revision: number): Promise<void> {
    this.allow(user, true);
    return this.run(async (client) => {
      await this.lockCategory(client, id, revision);
      await client.query('DELETE FROM kb_categories WHERE id=$1', [id]);
      await this.audit(client, user, 'category.deleted', id);
    });
  }
  private async lockCategory(client: PoolClient, id: string, revision: number): Promise<void> {
    const row = (
      await client.query<{ revision: number }>(
        'SELECT revision FROM kb_categories WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (!row) throw new NotFoundException('Category not found');
    if (row.revision !== revision)
      throw new ConflictException('Category changed. Reload before saving.');
  }
  listArticles(user: User, query: ArticleQuery): Promise<Page<Article>> {
    this.allow(user);
    return this.run((client) =>
      this.page(
        client,
        `${articleSelect} WHERE (v.title ILIKE $1 OR v.body ILIKE $1)
      AND ($2::uuid IS NULL OR a.category_id=$2) AND ($3::text IS NULL OR v.status=$3)
      AND ($4='all' OR ($4='active' AND a.archived_at IS NULL) OR ($4='archived' AND a.archived_at IS NOT NULL))`,
        [search(query.q), query.categoryId ?? null, query.status ?? null, query.archive],
        query,
        '"updatedAt" DESC, id DESC',
      ),
    );
  }
  private async readArticle(client: PoolClient, id: string): Promise<Article> {
    const article = (await client.query<Article>(`${articleSelect} WHERE a.id=$1`, [id])).rows[0];
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }
  getArticle(user: User, id: string): Promise<Article> {
    this.allow(user);
    return this.run((client) => this.readArticle(client, id));
  }
  private async lockArticle(
    client: PoolClient,
    user: User,
    id: string,
    revision: number,
    ownership = true,
  ): Promise<Article> {
    await client.query('SELECT id FROM kb_articles WHERE id=$1 FOR UPDATE', [id]);
    const article = await this.readArticle(client, id);
    if (ownership && user.role !== 'admin' && article.ownerId !== user.id)
      throw new ForbiddenException('Only the author or an admin may change this article');
    if (article.archivedAt) throw new ConflictException('Archived articles cannot be changed');
    if (article.revision !== revision)
      throw new ConflictException('Article changed. Reload before saving.');
    return article;
  }
  private async insertVersion(
    client: PoolClient,
    user: User,
    id: string,
    version: number,
    input: ArticleDto,
  ): Promise<void> {
    await client.query(
      'INSERT INTO kb_article_versions(article_id,version,title,body,language,created_by,category_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, version, input.title, input.body, input.language, user.id, input.categoryId],
    );
  }
  createArticle(user: User, input: ArticleDto): Promise<Article> {
    this.allow(user);
    return this.run(async (client) => {
      const row = (
        await client.query<{ id: string }>(
          'INSERT INTO kb_articles(category_id,created_by) VALUES ($1,$2) RETURNING id',
          [input.categoryId, user.id],
        )
      ).rows[0]!;
      await this.insertVersion(client, user, row.id, 1, input);
      await this.audit(client, user, 'article.created', row.id, 1);
      return this.readArticle(client, row.id);
    });
  }
  updateArticle(user: User, id: string, input: UpdateArticleDto): Promise<Article> {
    this.allow(user);
    return this.run(async (client) => {
      const old = await this.lockArticle(client, user, id, input.expectedRevision);
      if (old.status === 'pending')
        throw new ConflictException('Review the pending version before editing');
      await this.insertVersion(client, user, id, old.version + 1, input);
      await client.query(
        'UPDATE kb_articles SET category_id=$2,current_version=current_version+1,revision=revision+1,updated_at=now() WHERE id=$1',
        [id, input.categoryId],
      );
      await this.audit(client, user, 'article.versioned', id, old.version + 1);
      return this.readArticle(client, id);
    });
  }
  submit(user: User, id: string, revision: number): Promise<Article> {
    this.allow(user);
    return this.run(async (client) => {
      const old = await this.lockArticle(client, user, id, revision);
      if (old.status !== 'draft')
        throw new ConflictException(
          'Only a draft can be submitted; rejected articles need a new version',
        );
      await client.query(
        "UPDATE kb_article_versions SET status='pending',submitted_by=$3,submitted_at=now() WHERE article_id=$1 AND version=$2",
        [id, old.version, user.id],
      );
      await this.bump(client, id);
      await this.audit(client, user, 'article.submitted', id, old.version);
      return this.readArticle(client, id);
    });
  }
  review(user: User, id: string, input: ReviewDto): Promise<Article> {
    this.allow(user, true);
    if (input.decision === 'reject' && !input.note.trim())
      throw new BadRequestException('A rejection reason is required');
    return this.run(async (client) => {
      const old = await this.lockArticle(client, user, id, input.expectedRevision, false);
      if (old.status !== 'pending')
        throw new ConflictException('Only a pending version can be reviewed');
      const status = input.decision === 'approve' ? 'approved' : 'rejected';
      await client.query(
        'UPDATE kb_article_versions SET status=$3,reviewed_by=$4,reviewed_at=now(),review_note=$5 WHERE article_id=$1 AND version=$2',
        [id, old.version, status, user.id, input.note || null],
      );
      await this.bump(client, id);
      await this.audit(client, user, `article.${status}`, id, old.version);
      return this.readArticle(client, id);
    });
  }
  archive(user: User, id: string, revision: number): Promise<void> {
    this.allow(user, true);
    return this.run(async (client) => {
      const old = await this.lockArticle(client, user, id, revision, false);
      await client.query(
        'UPDATE kb_articles SET archived_at=now(),revision=revision+1,updated_at=now() WHERE id=$1',
        [id],
      );
      await this.audit(client, user, 'article.archived', id, old.version);
    });
  }
  private async bump(client: PoolClient, id: string): Promise<void> {
    await client.query('UPDATE kb_articles SET revision=revision+1,updated_at=now() WHERE id=$1', [
      id,
    ]);
  }
  versions(user: User, id: string, query: PageQuery): Promise<Page<ArticleVersion>> {
    this.allow(user);
    return this.run(async (client) => {
      await this.readArticle(client, id);
      return this.page(
        client,
        `SELECT ${versionColumns} FROM kb_article_versions v WHERE v.article_id=$1`,
        [id],
        query,
        'version DESC',
      );
    });
  }
  auditRecords(user: User, query: AuditQuery): Promise<Page<AuditRecord>> {
    this.allow(user, true);
    return this.run((client) =>
      this.page(
        client,
        `SELECT id,actor_id AS "actorId",actor_role AS "actorRole",action,entity_id AS "entityId",version,created_at AS "createdAt" FROM kb_audit_records WHERE ($1::uuid IS NULL OR entity_id=$1)`,
        [query.entityId ?? null],
        query,
        '"createdAt" DESC, id DESC',
      ),
    );
  }
}

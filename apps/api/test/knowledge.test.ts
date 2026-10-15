import 'reflect-metadata';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test } from '@nestjs/testing';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { KnowledgeService } from '../src/knowledge-base/knowledge.service';
import { DatabaseService } from '../src/database/database.module';
import {
  ArticleDto,
  ArticleQuery,
  RevisionDto,
  SearchQuery,
} from '../src/knowledge-base/knowledge.dto';
import type { User } from '@support/contracts';
const admin: User = {
  id: 'test-admin',
  role: 'admin',
  name: 'Synthetic admin',
  email: 'test@example.test',
};
it('normalizes text and converts bounded pagination without accepting null required fields', async () => {
  const query = plainToInstance(ArticleQuery, { page: '2', limit: '5', q: '  မြန်မာ  ' });
  assert.equal((await validate(query)).length, 0);
  assert.equal(query.page, 2);
  assert.equal(query.q, 'မြန်မာ');
  assert.ok(
    (
      await validate(
        plainToInstance(ArticleDto, { title: null, body: null, categoryId: null, language: null }),
      )
    ).length >= 4,
  );
  assert.ok((await validate(plainToInstance(RevisionDto, { expectedRevision: '1' }))).length > 0);
});
it('denies agent administration before touching database storage', async () => {
  let called = false;
  const module = await Test.createTestingModule({
    providers: [
      KnowledgeService,
      {
        provide: DatabaseService,
        useValue: {
          transaction: () => {
            called = true;
          },
        },
      },
    ],
  }).compile();
  try {
    assert.throws(
      () =>
        module
          .get(KnowledgeService)
          .auditRecords({ ...admin, role: 'agent' }, { page: 1, limit: 20 }),
      /Insufficient permissions/,
    );
    assert.equal(called, false);
  } finally {
    await module.close();
  }
});
it('maps storage failures to sanitized service-unavailable responses', async () => {
  const module = await Test.createTestingModule({
    providers: [
      KnowledgeService,
      {
        provide: DatabaseService,
        useValue: {
          transaction: () =>
            Promise.reject({ code: 'ECONNREFUSED', message: 'private-connection-details' }),
        },
      },
    ],
  }).compile();
  try {
    await assert.rejects(
      module.get(KnowledgeService).listCategories(admin, new SearchQuery()),
      (error) =>
        error instanceof ServiceUnavailableException &&
        !error.message.includes('private-connection-details'),
    );
  } finally {
    await module.close();
  }
});
it('maps lock contention to a retryable conflict without exposing SQL', async () => {
  const module = await Test.createTestingModule({
    providers: [
      KnowledgeService,
      {
        provide: DatabaseService,
        useValue: { transaction: () => Promise.reject({ code: '55P03', query: 'private-sql' }) },
      },
    ],
  }).compile();
  try {
    await assert.rejects(
      module.get(KnowledgeService).listCategories(admin, new SearchQuery()),
      (error) => error instanceof ConflictException && !error.message.includes('private-sql'),
    );
  } finally {
    await module.close();
  }
});

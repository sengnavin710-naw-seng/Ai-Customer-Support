export type Role = 'admin' | 'agent';
export type ArticleStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Category {
  id: string;
  name: string;
  description: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface ArticleVersion {
  articleId: string;
  categoryId: string;
  version: number;
  title: string;
  body: string;
  language: 'my' | 'en';
  status: ArticleStatus;
  createdBy: string;
  createdAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}
export interface Article extends ArticleVersion {
  id: string;
  categoryId: string;
  categoryName: string;
  revision: number;
  ownerId: string;
  updatedAt: string;
  archivedAt: string | null;
}
export interface ArticleInput {
  categoryId: string;
  title: string;
  body: string;
  language: 'my' | 'en';
}
export interface AuditRecord {
  id: string;
  actorId: string;
  actorRole: Role;
  action: string;
  entityId: string;
  version: number | null;
  createdAt: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface Session {
  accessToken: string;
  expiresAt: string;
  user: User;
}
export interface Health {
  status: 'ok';
  service: string;
  timestamp: string;
}
export interface ConversationPreview {
  id: string;
  name: string;
  initials: string;
  message: string;
  channel: 'Messenger' | 'Website' | 'Viber';
  status: 'Needs reply' | 'Resolved' | 'Assigned';
  time: string;
}
export interface Dashboard {
  synthetic: true;
  period: string;
  metrics: { conversations: number; resolved: number; responseTime: string; satisfaction: string };
  volume: { day: string; received: number; resolved: number }[];
  conversations: ConversationPreview[];
}

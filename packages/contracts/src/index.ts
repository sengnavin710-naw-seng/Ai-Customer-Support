export type Role = 'admin' | 'agent';
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

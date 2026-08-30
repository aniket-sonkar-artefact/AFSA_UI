export type UserRole = 'finance-analyst' | 'finance-manager' | 'finance-user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  /** Account-level title shown as a small badge, e.g. 'Consolidation Analyst'. */
  title?: string;
  initials: string;
}
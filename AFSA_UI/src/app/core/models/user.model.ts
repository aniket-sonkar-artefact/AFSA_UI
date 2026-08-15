export type UserRole = 'consolidation' | 'reporting';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  initials: string;
}

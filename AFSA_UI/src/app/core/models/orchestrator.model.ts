export type OrchestratorTab = 'plan' | 'activity' | 'approvals' | 'messages';
export type TaskStatus = 'complete' | 'running' | 'queued' | 'approval' | 'paused';
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface AgentTask {
  id: string;
  title: string;
  solution: string;
  agent: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  autonomous: boolean;
  detail?: string;
}

export interface ActivityItem {
  id: number;
  time: string;
  title: string;
  detail: string;
  kind: 'autonomous' | 'user' | 'approval' | 'system';
}

export interface ApprovalItem {
  id: string;
  title: string;
  detail: string;
  requestedBy: string;
  status: ApprovalStatus;
}

export interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  text: string;
}
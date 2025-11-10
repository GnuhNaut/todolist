import { Timestamp } from 'firebase/firestore';

export interface Group {
  id: string;
  name: string;
  icon?: string;
  ownerId: string;
  createdAt: Timestamp;
}

export interface Recurrence {
  type: 'daily' | 'weekly' | 'once';
  daysOfWeek?: number[];
  startDate?: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  recurrence: Recurrence;
  groupId: string;
  createdAt: Timestamp;
}

export interface TaskInstance {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  status: 'pending' | 'completed';
  userId: string;
  groupId: string;
  templateId: string;
}
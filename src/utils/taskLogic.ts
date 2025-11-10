// src/utils/taskLogic.ts
import { TaskTemplate } from '../types';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from 'firebase/firestore';

export const getLocalDateString = (date: Date): string => {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffset);
  return localDate.toISOString().split('T')[0];
};

// *** THAY ĐỔI Ở ĐÂY: Thêm 'export' ***
export const doesTemplateMatchDate = (template: TaskTemplate, targetDate: Date): boolean => {
  const { recurrence } = template;
  const targetDateString = getLocalDateString(targetDate);
  const targetDayOfWeek = targetDate.getDay();

  switch (recurrence.type) {
    case 'daily':
      return true;
    
    case 'once':
      return recurrence.startDate === targetDateString;
    
    case 'weekly':
      return recurrence.daysOfWeek?.includes(targetDayOfWeek) ?? false;
      
    default:
      return false;
  }
};

export const ensureTasksForDay = async (
  userId: string,
  groupId: string,
  targetDate: Date
) => {
  const dateString = getLocalDateString(targetDate);

  const instancesQuery = query(
    collection(db, 'taskInstances'),
    where('userId', '==', userId),
    where('groupId', '==', groupId),
    where('date', '==', dateString)
  );

  const existingInstances = await getDocs(instancesQuery);

  // Lỗi logic cũ nằm ở đây. Nếu đã có 1 task, nó sẽ không tạo task mới.
  // Chúng ta sẽ bỏ qua việc sửa hàm này và sửa logic ở Modal
  if (!existingInstances.empty) {
    return;
  }

  const templatesQuery = query(
    collection(db, 'groups', groupId, 'tasks')
  );
  const templatesSnapshot = await getDocs(templatesQuery);
  const templates: TaskTemplate[] = [];
  templatesSnapshot.forEach((doc) => {
    templates.push({ id: doc.id, ...doc.data() } as TaskTemplate);
  });

  const matchingTemplates = templates.filter(t => doesTemplateMatchDate(t, targetDate));

  if (matchingTemplates.length === 0) {
    return;
  }

  const batch = writeBatch(db);
  const instancesCollection = collection(db, 'taskInstances');

  matchingTemplates.forEach((template) => {
    const newInstanceData = {
      title: template.title,
      startTime: template.startTime,
      endTime: template.endTime,
      userId: userId,
      groupId: groupId,
      templateId: template.id,
      date: dateString,
      status: 'pending',
    };
    batch.set(doc(instancesCollection), newInstanceData);
  });

  await batch.commit();
};
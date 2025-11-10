import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { TaskInstance } from '../types';
import { getLocalDateString } from '../utils/taskLogic';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export const useTodayPendingTasks = (userId: string | undefined) => {
  const [taskCounts, setTaskCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const todayString = getLocalDateString(new Date());

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'taskInstances'),
      where('userId', '==', userId),
      where('date', '==', todayString),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts = new Map<string, number>();

      snapshot.forEach((doc) => {
        const task = doc.data() as TaskInstance;
        const currentCount = counts.get(task.groupId) || 0;
        counts.set(task.groupId, currentCount + 1);
      });

      setTaskCounts(counts);
      setLoading(false);
    });

    return () => unsubscribe();

  }, [userId, todayString]);

  return { taskCounts, loadingCounts: loading };
};
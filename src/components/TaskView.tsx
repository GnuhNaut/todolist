import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { TaskInstance } from '../types';
import { ensureTasksForDay, getLocalDateString } from '../utils/taskLogic';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
} from 'firebase/firestore';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface TaskViewProps {
  groupId: string;
}

const TaskView = ({ groupId }: TaskViewProps) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const dateString = getLocalDateString(selectedDate);
  
  useEffect(() => {
    if (!user || !groupId) return;

    setLoading(true);
    let unsubscribe: () => void;

    const run = async () => {
      try {
        await ensureTasksForDay(user.uid, groupId, selectedDate);
      } catch (error) {
         console.error("Lỗi khi đảm bảo task:", error);
      }

      const q = query(
        collection(db, 'taskInstances'),
        where('userId', '==', user.uid),
        where('groupId', '==', groupId),
        where('date', '==', dateString),
        orderBy('startTime')
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const tasksData: TaskInstance[] = [];
        snapshot.forEach((doc) => {
          tasksData.push({ id: doc.id, ...doc.data() } as TaskInstance);
        });
        setTasks(tasksData);
        setLoading(false);
      }, (error) => {
        console.error("Lỗi khi lắng nghe tasks:", error);
        setLoading(false);
      });
    };

    run();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId, user, dateString, selectedDate]); 

  const handleToggleTask = async (task: TaskInstance) => {
    const taskDocRef = doc(db, 'taskInstances', task.id);
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    
    try {
      await updateDoc(taskDocRef, {
        status: newStatus,
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật task:", error);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700">Công việc cho ngày:</h3>
        <DatePicker
          selected={selectedDate}
          onChange={(date: Date) => setSelectedDate(date)}
          dateFormat="dd/MM/yyyy"
          className="p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {loading && (
        <div className="text-center text-gray-500 p-6">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-2">Đang tải tasks...</p>
        </div>
      )}
      
      {!loading && tasks.length === 0 && (
        <div className="text-center text-gray-500 p-8 bg-gray-50 rounded-lg shadow-inner border border-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mx-auto text-green-500 mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.613 2.4-1.616 3.097m-1.616-3.097v3.097A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.768-2.09c.4A2.25 2.25 0 0 0 8.25 15h7.5a2.25 2.25 0 0 0 2.25-2.25V12c0-1.268.613-2.4 1.616-3.097A9.008 9.008 0 0 1 21 12Z" />
          </svg>
          <p className="text-lg font-medium">Tuyệt vời!</p>
          <p>Không có task nào cho ngày {dateString}.</p>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            onClick={() => handleToggleTask(task)}
            className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-gray-200 transition-all duration-200 hover:shadow-md hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={task.status === 'completed'}
              readOnly
              className="h-6 w-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <div className="ml-4 w-28 sm:w-32 flex-shrink-0 text-gray-600 font-medium">
              {task.startTime} - {task.endTime}
            </div>
            <div 
              className={`flex-1 ml-4 text-lg ${
                task.status === 'completed' 
                  ? 'line-through text-gray-400' 
                  : 'text-gray-800 font-medium'
              }`}
            >
              {task.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskView;
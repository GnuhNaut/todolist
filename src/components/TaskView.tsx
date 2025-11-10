// src/components/TaskView.tsx
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

// Xóa các biến style cũ (taskItemStyle, timeStyle, v.v...)

interface TaskViewProps {
  groupId: string;
}

const TaskView = ({ groupId }: TaskViewProps) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const dateString = getLocalDateString(selectedDate);
  
  // *** SỬA LỖI 1: Lấy ngày hôm nay ***
  const todayString = getLocalDateString(new Date());

  useEffect(() => {
    if (!user || !groupId) return;

    setLoading(true);
    let unsubscribe: () => void;

    const run = async () => {
      // *** SỬA LỖI 1: Chỉ chạy generator nếu ngày xem KHÔNG PHẢI là hôm nay
      // Chúng ta giả định DashboardPage đã xử lý ngày hôm nay khi tải app.
      if (dateString !== todayString) {
        await ensureTasksForDay(user.uid, groupId, selectedDate);
      }

      // Query lắng nghe task
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
    // *** SỬA LỖI 1: Thêm `todayString` vào dependency array ***
  }, [groupId, user, dateString, selectedDate, todayString]); 
  // *** KẾT THÚC SỬA LỖI 1 ***

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
    // Thay thế div cũ bằng class Tailwind
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-700">Công việc cho ngày:</h3>
        <DatePicker
          selected={selectedDate}
          onChange={(date: Date) => setSelectedDate(date)}
          dateFormat="dd/MM/yyyy"
          // Class "w-full" đã được áp dụng trong src/index.css cho input
          // Bạn có thể tùy chỉnh thêm bằng 'customInput' nếu muốn
        />
      </div>

      {loading && <p className="text-center text-gray-500">Đang tải tasks...</p>}

      {!loading && tasks.length === 0 && (
        <div className="text-center text-gray-500 p-6 bg-gray-100 rounded-lg shadow-inner">
          <p className="text-lg">Tuyệt vời! 🥳</p>
          <p>Không có task nào cho ngày {dateString}.</p>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-gray-200 transition-all hover:shadow-md"
          >
            <input
              type="checkbox"
              checked={task.status === 'completed'}
              onChange={() => handleToggleTask(task)}
              className="h-6 w-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <div className="ml-4 w-28 sm:w-32 text-gray-600 font-medium">
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
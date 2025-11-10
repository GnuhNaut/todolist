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

const taskItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px',
  border: '1px solid #eee',
  marginBottom: '5px',
};
const timeStyle: React.CSSProperties = { width: '120px', color: '#555' };
const titleStyle: React.CSSProperties = { flex: 1, marginLeft: '10px' };

const datePickerContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '20px',
};
const datePickerInputStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: '16px',
  textAlign: 'center',
  border: '1px solid #ccc',
  borderRadius: '5px',
};

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
      await ensureTasksForDay(user.uid, groupId, selectedDate);

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
    <div>
      <div style={datePickerContainerStyle}>
        <h3>Công việc cho ngày:</h3>
        <DatePicker
          selected={selectedDate}
          onChange={(date: Date) => setSelectedDate(date)}
          dateFormat="dd/MM/yyyy"
          customInput={<input style={datePickerInputStyle} />}
        />
      </div>

      {loading && <p style={{ textAlign: 'center' }}>Đang tải tasks...</p>}

      {!loading && tasks.length === 0 && (
        <p style={{ textAlign: 'center' }}>
          Tuyệt vời! Không có task nào cho ngày {dateString}.
        </p>
      )}

      <div>
        {tasks.map((task) => (
          <div key={task.id} style={taskItemStyle}>
            <input
              type="checkbox"
              checked={task.status === 'completed'}
              onChange={() => handleToggleTask(task)}
              style={{ transform: 'scale(1.5)', marginRight: '10px' }}
            />
            <div style={timeStyle}>
              {task.startTime} - {task.endTime}
            </div>
            <div 
              style={{
                ...titleStyle,
                textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                color: task.status === 'completed' ? '#999' : '#000',
              }}
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
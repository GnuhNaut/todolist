import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { Group, TaskTemplate, Recurrence } from '../types';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  onSnapshot,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import TaskView from '../components/TaskView';

interface TaskFormState {
  title: string;
  startTime: string;
  endTime: string;
  recurrenceType: 'daily' | 'weekly' | 'once';
  daysOfWeek: number[];
  startDate: string;
}

const GroupDetailPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [view, setView] = useState<'tasks' | 'setup'>('tasks');

  const [formState, setFormState] = useState<TaskFormState>({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    recurrenceType: 'daily',
    daysOfWeek: [],
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user || !groupId) return;

    const groupDocRef = doc(db, 'groups', groupId);
    
    getDoc(groupDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        const groupData = docSnap.data() as Group;
        if (groupData.ownerId === user.uid) {
          setGroup({ id: docSnap.id, ...groupData });
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    });
  }, [groupId, user, navigate]);

  useEffect(() => {
    if (!groupId) return;

    const tasksQuery = query(
      collection(db, 'groups', groupId, 'tasks'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const templates: TaskTemplate[] = [];
      snapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() } as TaskTemplate);
      });
      setTaskTemplates(templates);
    });

    return () => unsubscribe();
  }, [groupId]);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupId || !user) return;

    let recurrence: Recurrence;
    if (formState.recurrenceType === 'daily') {
      recurrence = { type: 'daily' };
    } else if (formState.recurrenceType === 'once') {
      recurrence = { type: 'once', startDate: formState.startDate };
    } else {
      if (formState.daysOfWeek.length === 0) {
        alert('Vui lòng chọn ít nhất một ngày trong tuần.');
        return;
      }
      recurrence = { type: 'weekly', daysOfWeek: formState.daysOfWeek.sort() };
    }

    try {
      await addDoc(collection(db, 'groups', groupId, 'tasks'), {
        title: formState.title,
        startTime: formState.startTime,
        endTime: formState.endTime,
        recurrence: recurrence,
        groupId: groupId,
        createdAt: serverTimestamp(),
      });
      setFormState({
        ...formState,
        title: '',
        startTime: '09:00',
        endTime: '10:00',
      });
    } catch (error) {
      console.error('Lỗi khi thêm task template:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleDayToggle = (dayIndex: number) => {
    setFormState(prev => {
      const newDays = [...prev.daysOfWeek];
      if (newDays.includes(dayIndex)) {
        return { ...prev, daysOfWeek: newDays.filter(d => d !== dayIndex) };
      } else {
        newDays.push(dayIndex);
        return { ...prev, daysOfWeek: newDays };
      }
    });
  };

  if (loading) {
    return <div>Đang tải...</div>;
  }

  if (!group) {
    return <div>Không tìm thấy group.</div>;
  }

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '2px solid #ccc',
    marginBottom: '20px',
  };
  const tabStyle: React.CSSProperties = {
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 'bold',
  };
  const activeTabStyle: React.CSSProperties = {
    ...tabStyle,
    borderBottom: '3px solid blue',
    color: 'blue',
  };

  return (
    <div style={{ padding: '20px' }}>
      <Link to="/">&larr; Quay lại Dashboard</Link>
      <h1>{group.name}</h1>

      <div style={tabContainerStyle}>
        <div
          style={view === 'tasks' ? activeTabStyle : tabStyle}
          onClick={() => setView('tasks')}
        >
          Lịch sử & Công việc
        </div>
        <div
          style={view === 'setup' ? activeTabStyle : tabStyle}
          onClick={() => setView('setup')}
        >
          Cài đặt (Setup)
        </div>
      </div>

      {view === 'tasks' && groupId && (
        <TaskView groupId={groupId} />
      )}

      {view === 'setup' && (
        <>
          <h2>Cài đặt Task Template</h2>
          <p>Đây là nơi bạn thiết lập các công việc lặp lại (task templates) cho group này.</p>
          
          <hr style={{ margin: '20px 0' }} />

          <h2>Thêm Task Template mới</h2>
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
            <div>
              <label>Tên Task: </label>
              <input
                type="text"
                name="title"
                value={formState.title}
                onChange={handleInputChange}
                required
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Bắt đầu: </label>
                <input type="time" name="startTime" value={formState.startTime} onChange={handleInputChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label>Kết thúc: </label>
                <input type="time" name="endTime" value={formState.endTime} onChange={handleInputChange} required />
              </div>
            </div>

            <div>
              <label>Tùy chọn lặp lại: </label>
              <select name="recurrenceType" value={formState.recurrenceType} onChange={handleInputChange}>
                <option value="daily">Hằng ngày</option>
                <option value="weekly">Hằng tuần</option>
                <option value="once">Chỉ một lần</option>
              </select>
            </div>

            {formState.recurrenceType === 'weekly' && (
              <div style={{ display: 'flex', gap: '5px' }}>
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => (
                  <label key={index}>
                    <input
                      type="checkbox"
                      checked={formState.daysOfWeek.includes(index)}
                      onChange={() => handleDayToggle(index)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            )}

            {formState.recurrenceType === 'once' && (
              <div>
                <label>Chọn ngày: </label>
                <input type="date" name="startDate" value={formState.startDate} onChange={handleInputChange} required />
              </div>
            )}

            <button type="submit" style={{ padding: '10px', backgroundColor: 'blue', color: 'white', border: 'none' }}>
              Thêm Task
            </button>
          </form>

          <hr style={{ margin: '20px 0' }} />

          <h2>Các Task Template hiện có</h2>
          {taskTemplates.length === 0 ? (
            <p>Chưa có template nào.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {taskTemplates.map(template => (
                <li key={template.id} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '5px' }}>
                  <strong>{template.title}</strong> ({template.startTime} - {template.endTime})
                  <div style={{ fontSize: '0.9em', color: '#555' }}>
                    Lặp lại: {template.recurrence.type === 'daily' ? 'Hằng ngày' :
                              template.recurrence.type === 'once' ? `Một lần (${template.recurrence.startDate})` :
                              `Hằng tuần (vào các ngày: ${template.recurrence.daysOfWeek?.join(', ')})`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default GroupDetailPage;
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { Group, GroupData, TaskTemplate } from '../types';
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import TaskView from '../components/TaskView';
import AddTemplateModal from '../components/AddTemplateModal';
import ConfirmationModal from '../components/ConfirmationModal';

const GroupDetailPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  
  const [view, setView] = useState<'tasks' | 'setup'>('tasks');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TaskTemplate | null>(null);

  useEffect(() => {
    if (!user || !groupId) return;
    const groupDocRef = doc(db, 'groups', groupId);
    getDoc(groupDocRef).then((docSnap) => {
        if (docSnap.exists()) {
            const groupData = docSnap.data() as GroupData;
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
    const tasksQuery = query(collection(db, 'groups', groupId, 'tasks'), orderBy('startTime', 'asc'));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
        const templates: TaskTemplate[] = [];
        snapshot.forEach((doc) => {
            templates.push({ id: doc.id, ...doc.data() } as TaskTemplate);
        });
        setTaskTemplates(templates);
    });
    return () => unsubscribe();
  }, [groupId]);

  const requestDeleteTemplate = (template: TaskTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete || !groupId) return;

    try {
      await deleteDoc(doc(db, 'groups', groupId, 'tasks', templateToDelete.id));
    } catch (error) {
      console.error("Lỗi khi xóa task template:", error);
    } finally {
      setIsDeleteModalOpen(false);
      setTemplateToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-4 text-xl font-semibold text-gray-700">Đang tải group...</span>
      </div>
    );
  }

  if (!group) {
    return <div className="text-center p-10">Không tìm thấy group.</div>;
  }

  const getDayName = (index: number) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][index];

  const formatRecurrence = (template: TaskTemplate) => {
    const { recurrence } = template;
    if (recurrence.type === 'daily') return 'Hằng ngày';
    if (recurrence.type === 'once') return `Một lần (${recurrence.startDate})`;
    if (recurrence.type === 'weekly') {
      const days = recurrence.daysOfWeek?.map(getDayName).join(', ') || '';
      return `Hằng tuần (vào: ${days})`;
    }
    return '';
  };

  return (
    <>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block group items-center">
          <span className="transition-transform group-hover:-translate-x-1 inline-block">&larr;</span> Quay lại Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-gray-800 mb-6">{group.name}</h1>

        <div className="flex border-b border-gray-300 mb-6">
          <button
            className={`py-3 px-6 font-semibold -mb-px transition-colors duration-200 ${
              view === 'tasks' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setView('tasks')}
          >
            Công việc
          </button>
          <button
            className={`py-3 px-6 font-semibold -mb-px transition-colors duration-200 ${
              view === 'setup' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setView('setup')}
          >
            Cài đặt Templates
          </button>
        </div>

        {view === 'tasks' && groupId && (
          <TaskView groupId={groupId} />
        )}

        {view === 'setup' && (
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <div className="mb-4 sm:mb-0">
                <h2 className="text-2xl font-semibold text-gray-800">Cài đặt Task Templates</h2>
                <p className="text-gray-600 mt-1">
                  Đây là nơi bạn thiết lập các công việc lặp lại.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Thêm Template mới
              </button>
            </div>
            
            <div className="mt-6">
              {taskTemplates.length === 0 ? (
                <p className="text-center text-gray-500 p-6 bg-gray-50 rounded-lg">Chưa có template nào.</p>
              ) : (
                <div className="space-y-3">
                  {taskTemplates.map(template => (
                    <div 
                      key={template.id} 
                      className="group p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col sm:flex-row justify-between sm:items-center relative"
                    >
                      <div className="flex-grow mb-2 sm:mb-0">
                        <strong className="text-lg text-gray-800">{template.title}</strong>
                        <div className="text-sm text-gray-500 mt-1">
                          {formatRecurrence(template)}
                        </div>
                      </div>
                      <span className="font-mono text-gray-700 text-lg sm:text-right sm:px-4">
                        {template.startTime} - {template.endTime}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteTemplate(template);
                        }}
                        className="absolute top-3 right-3 flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Xóa template"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {groupId && (
        <AddTemplateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          groupId={groupId}
        />
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteTemplate}
        title="Xác nhận Xóa Template"
        message={`Bạn có chắc chắn muốn xóa template "${templateToDelete?.title}"? Hành động này không thể hoàn tác.`}
      />
    </>
  );
};

export default GroupDetailPage;
// src/pages/GroupDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { Group, TaskTemplate } from '../types';
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  orderBy,
  deleteDoc, // <-- THÊM
} from 'firebase/firestore';
import TaskView from '../components/TaskView';
import AddTemplateModal from '../components/AddTemplateModal';
import ConfirmationModal from '../components/ConfirmationModal'; // <-- THÊM

const GroupDetailPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  
  const [view, setView] = useState<'tasks' | 'setup'>('tasks');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // === PHẦN MỚI: State cho modal xóa template ===
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TaskTemplate | null>(null);
  // =============================================

  // (useEffect tải group giữ nguyên)
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

  // (useEffect tải task templates giữ nguyên)
  useEffect(() => {
    if (!groupId) return;
    const tasksQuery = query(collection(db, 'groups', groupId, 'tasks'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
        const templates: TaskTemplate[] = [];
        snapshot.forEach((doc) => {
            templates.push({ id: doc.id, ...doc.data() } as TaskTemplate);
        });
        setTaskTemplates(templates);
    });
    return () => unsubscribe();
  }, [groupId]);

  // === PHẦN MỚI: Logic Xóa Template ===
  // Hàm mở modal
  const requestDeleteTemplate = (template: TaskTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteModalOpen(true);
  };

  // Hàm xác nhận xóa
  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete || !groupId) return;

    try {
      // Xóa tài liệu Task Template trong subcollection
      await deleteDoc(doc(db, 'groups', groupId, 'tasks', templateToDelete.id));

    } catch (error) {
      console.error("Lỗi khi xóa task template:", error);
    } finally {
      setIsDeleteModalOpen(false);
      setTemplateToDelete(null);
    }
  };
  // =====================================


  if (loading) {
    return <div className="text-center p-10">Đang tải...</div>;
  }

  if (!group) {
    return <div className="text-center p-10">Không tìm thấy group.</div>;
  }

  const getDayName = (index: number) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][index];

  return (
    <>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* (Link quay lại, Tiêu đề, Tabs giữ nguyên) */}
        <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
          &larr; Quay lại Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-gray-800 mb-6">{group.name}</h1>

        <div className="flex border-b border-gray-300 mb-6">
          <button
            className={`py-3 px-6 font-semibold -mb-px ${
              view === 'tasks' 
                ? 'border-b-4 border-blue-600 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setView('tasks')}
          >
            Công việc & Lịch sử
          </button>
          <button
            className={`py-3 px-6 font-semibold -mb-px ${
              view === 'setup' 
                ? 'border-b-4 border-blue-600 text-blue-600' 
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

        {/* === PHẦN CẬP NHẬT: Tab Cài đặt === */}
        {view === 'setup' && (
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            {/* (Header của tab (Nút thêm) giữ nguyên) */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">Cài đặt Task Templates</h2>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200"
              >
                + Thêm Template mới
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Đây là nơi bạn thiết lập các công việc lặp lại cho group này.
            </p>

            {/* Cập nhật danh sách template */}
            {taskTemplates.length === 0 ? (
              <p className="text-center text-gray-500 p-6 bg-gray-50 rounded-lg">Chưa có template nào.</p>
            ) : (
              <div className="space-y-3">
                {taskTemplates.map(template => (
                  <div 
                    key={template.id} 
                    className="group p-4 border border-gray-200 rounded-lg bg-gray-50 flex justify-between items-center relative"
                  >
                    {/* Thông tin template */}
                    <div className="flex-grow">
                      <strong className="text-lg text-gray-800">{template.title}</strong>
                      <div className="text-sm text-gray-500 mt-1">
                        Lặp lại: 
                        {template.recurrence.type === 'daily' && ' Hằng ngày'}
                        {template.recurrence.type === 'once' && ` Một lần (${template.recurrence.startDate})`}
                        {template.recurrence.type === 'weekly' && 
                          ` Hằng tuần (vào: ${template.recurrence.daysOfWeek?.map(getDayName).join(', ')})`}
                      </div>
                    </div>
                    {/* Thời gian */}
                    <span className="font-mono text-gray-600 text-lg mt-2 sm:mt-0 px-4">
                      {template.startTime} - {template.endTime}
                    </span>

                    {/* Nút Xóa Template */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeleteTemplate(template);
                      }}
                      className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors"
                      title="Xóa template"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Thêm (giữ nguyên) */}
      {groupId && (
        <AddTemplateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          groupId={groupId}
        />
      )}

      {/* === PHẦN MỚI: Modal Xóa === */}
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
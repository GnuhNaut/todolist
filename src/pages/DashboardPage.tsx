// src/pages/DashboardPage.tsx
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, FormEvent } from 'react';
import { Group } from '../types';
import { Link } from 'react-router-dom';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  setDoc,
  writeBatch, // <-- THÊM
} from 'firebase/firestore';
import { getLocalDateString, ensureTasksForDay } from '../utils/taskLogic';
import { useTodayPendingTasks } from '../hooks/useTodayPendingTasks';
import ConfirmationModal from '../components/ConfirmationModal'; // <-- THÊM

// Component Loading Overlay (giữ nguyên)
const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-white bg-opacity-80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <h3 className="mt-4 text-xl font-semibold text-gray-700">Đang chuẩn bị ngày mới của bạn...</h3>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false); 
  const { taskCounts } = useTodayPendingTasks(user?.uid);

  // === PHẦN MỚI: State cho modal xóa ===
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  // ===================================

  // (useEffect checkAndGenerateTasks giữ nguyên)
  useEffect(() => {
    if (!user) return;
    const checkAndGenerateTasks = async () => {
        const todayString = getLocalDateString(new Date());
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            await setDoc(userDocRef, { email: user.email, lastTasksGeneratedForDate: '1970-01-01' }, { merge: true });
        }
        const userData = userDoc.data();
        const lastChecked = userData?.lastTasksGeneratedForDate || '1970-01-01';
        if (todayString > lastChecked) {
            setIsGenerating(true);
            const groupsQuery = query(collection(db, "groups"), where("ownerId", "==", user.uid));
            const groupsSnapshot = await getDocs(groupsQuery);
            const userGroups: Group[] = [];
            groupsSnapshot.forEach(doc => userGroups.push({id: doc.id, ...doc.data()} as Group));
            try {
                await Promise.all(userGroups.map(group => ensureTasksForDay(user.uid, group.id, new Date())));
            } catch (error) {
                console.error("Lỗi nghiêm trọng khi sinh task hàng loạt:", error);
            }
            await updateDoc(userDocRef, { lastTasksGeneratedForDate: todayString });
            setIsGenerating(false);
        }
    };
    checkAndGenerateTasks();
  }, [user]);

  // (useEffect listener cho Groups giữ nguyên)
  useEffect(() => {
    if (!user) return;
    setLoadingGroups(true);
    const q = query(collection(db, "groups"), where("ownerId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const groupsData: Group[] = [];
        querySnapshot.forEach((doc) => {
            groupsData.push({ id: doc.id, ...doc.data() } as Group);
        });
        setGroups(groupsData);
        setLoadingGroups(false);
    });
    return () => unsubscribe();
  }, [user]);

  // (handleCreateGroup giữ nguyên)
  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || newGroupName.trim() === "") return;
    try {
        await addDoc(collection(db, "groups"), {
            name: newGroupName,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            icon: 'default'
        });
        setNewGroupName("");
    } catch (error) {
        console.error("Lỗi khi tạo group:", error);
    }
  };

  // (handleLogout giữ nguyên)
  const handleLogout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Lỗi khi đăng xuất:", error);
    }
  };

  // === PHẦN MỚI: Logic Xóa Group ===
  // Hàm mở modal
  const requestDeleteGroup = (group: Group) => {
    setGroupToDelete(group);
    setIsDeleteModalOpen(true);
  };

  // Hàm xác nhận xóa
  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete || !user) return;

    try {
      const batch = writeBatch(db);

      // 1. Xóa tất cả các Task Templates (subcollection)
      const templatesQuery = query(collection(db, 'groups', groupToDelete.id, 'tasks'));
      const templatesSnapshot = await getDocs(templatesQuery);
      templatesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // 2. Xóa tất cả các Task Instances (trong collection 'taskInstances')
      const instancesQuery = query(
        collection(db, 'taskInstances'),
        where('userId', '==', user.uid),
        where('groupId', '==', groupToDelete.id)
      );
      const instancesSnapshot = await getDocs(instancesQuery);
      instancesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 3. Xóa chính group
      batch.delete(doc(db, 'groups', groupToDelete.id));

      // Commit tất cả các lệnh xóa
      await batch.commit();

    } catch (error) {
      console.error("Lỗi khi xóa group và các task liên quan:", error);
    } finally {
      // Đóng modal và reset state
      setIsDeleteModalOpen(false);
      setGroupToDelete(null);
    }
  };
  // =================================

  if (isGenerating) {
    return <LoadingOverlay />;
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* (Header và Form tạo group giữ nguyên) */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
                <h1 className="text-4xl font-bold text-gray-800">My Todo Groups</h1>
                <p className="mt-2 text-lg text-gray-600">
                    Chào mừng, {user?.displayName || user?.email}!
                </p>
            </div>
            <button 
                onClick={handleLogout}
                className="mt-4 sm:mt-0 px-4 py-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
                Đăng xuất
            </button>
        </header>

        <form 
            className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200"
            onSubmit={handleCreateGroup}
        >
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Tạo một Group mới</h2>
            <div className="flex">
                <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Tên Group mới (ví dụ: Việc nhà, Công ty...)"
                    className="flex-grow p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                    type="submit" 
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-r-md hover:bg-blue-700 transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Tạo
                </button>
            </div>
        </form>

        {/* === PHẦN CẬP NHẬT: Danh sách group === */}
        <div className="mt-6">
          {loadingGroups ? (
            <p className="text-center text-gray-500">Đang tải groups...</p>
          ) : groups.length === 0 ? (
            <p className="text-center text-gray-500 p-6 bg-gray-100 rounded-lg">
              Bạn chưa có group nào. Hãy tạo group đầu tiên!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => {
                const count = taskCounts.get(group.id) || 0;
                
                return (
                  // Bọc thẻ Link bằng div để dễ dàng layout
                  <div 
                    key={group.id}
                    className="group flex items-center p-5 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-all duration-200 relative"
                  >
                    <Link 
                      to={`/group/${group.id}`} 
                      className="flex items-center flex-grow no-underline"
                    >
                      <span 
                        className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full font-bold text-white text-lg mr-4 ${
                          count > 0 ? 'bg-red-500' : 'bg-gray-400'
                        }`}
                      >
                        {count}
                      </span>
                      
                      <span className="text-xl font-medium text-gray-800 group-hover:text-blue-600">
                        {group.name}
                      </span>
                    </Link>
                    
                    {/* Nút Xóa Group */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Ngăn click vào thẻ Link
                        requestDeleteGroup(group);
                      }}
                      className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Xóa group"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* === PHẦN MỚI: Modal xác nhận xóa === */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteGroup}
        title="Xác nhận Xóa Group"
        message={`Bạn có chắc chắn muốn xóa group "${groupToDelete?.name}"? Tất cả các task templates và lịch sử công việc liên quan cũng sẽ bị xóa vĩnh viễn.`}
      />
    </>
  );
};

export default DashboardPage;
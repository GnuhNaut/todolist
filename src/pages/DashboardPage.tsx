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
  writeBatch,
} from 'firebase/firestore';
import { getLocalDateString, ensureTasksForDay } from '../utils/taskLogic';
import { useTodayPendingTasks } from '../hooks/useTodayPendingTasks';
import ConfirmationModal from '../components/ConfirmationModal';

const DashboardPage = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  
  const { taskCounts } = useTodayPendingTasks(user?.uid);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkAndGenerateTasks = async () => {
        const todayString = getLocalDateString(new Date());
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let lastChecked = '1970-01-01';
        
        if (userDoc.exists()) {
            lastChecked = userDoc.data()?.lastTasksGeneratedForDate || '1970-01-01';
        } else {
            await setDoc(userDocRef, { email: user.email, lastTasksGeneratedForDate: '1970-01-01' }, { merge: true });
        }
        
        if (todayString > lastChecked) {
            const groupsQuery = query(collection(db, "groups"), where("ownerId", "==", user.uid));
            const groupsSnapshot = await getDocs(groupsQuery);
            const userGroups: Group[] = [];
            groupsSnapshot.forEach(doc => userGroups.push({id: doc.id, ...doc.data()} as Group));
            
            try {
                await Promise.all(userGroups.map(group => ensureTasksForDay(user.uid, group.id, new Date())));
            } catch (error) {
                console.error("Lỗi khi sinh task hàng loạt:", error);
            }
            await updateDoc(userDocRef, { lastTasksGeneratedForDate: todayString });
        }
    };
    checkAndGenerateTasks();
  }, [user]);

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

  const handleLogout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Lỗi khi đăng xuất:", error);
    }
  };

  const requestDeleteGroup = (group: Group) => {
    setGroupToDelete(group);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete || !user) return;

    try {
      const batch = writeBatch(db);

      const templatesQuery = query(collection(db, 'groups', groupToDelete.id, 'tasks'));
      const templatesSnapshot = await getDocs(templatesQuery);
      templatesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      const instancesQuery = query(
        collection(db, 'taskInstances'),
        where('userId', '==', user.uid),
        where('groupId', '==', groupToDelete.id)
      );
      const instancesSnapshot = await getDocs(instancesQuery);
      instancesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      batch.delete(doc(db, 'groups', groupToDelete.id));

      await batch.commit();

    } catch (error) {
      console.error("Lỗi khi xóa group và các task liên quan:", error);
    } finally {
      setIsDeleteModalOpen(false);
      setGroupToDelete(null);
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-800">My Todo Groups</h1>
                <p className="mt-2 text-lg text-gray-600">
                    Chào mừng, {user?.displayName || user?.email}!
                </p>
            </div>
            <button 
                onClick={handleLogout}
                className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H21" />
              </svg>
              Đăng xuất
            </button>
        </header>

        <form 
            className="mb-10 p-6 bg-white rounded-lg shadow-sm border border-gray-200"
            onSubmit={handleCreateGroup}
        >
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Tạo một Group mới</h2>
            <div className="flex">
                <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Tên Group mới (ví dụ: Việc nhà, Công ty...)"
                    className="flex-grow p-3 border-gray-300 rounded-l-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <button 
                    type="submit" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-r-md hover:bg-blue-700 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Tạo
                </button>
            </div>
        </form>

        <div className="mt-6">
          {loadingGroups ? (
            <p className="text-center text-gray-500">Đang tải groups...</p>
          ) : groups.length === 0 ? (
            <div className="text-center text-gray-500 p-8 bg-gray-50 rounded-lg shadow-inner border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mx-auto text-gray-400 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12.75h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
              </svg>
              <p className="text-lg">
                Bạn chưa có group nào.
              </p>
              <p>Hãy tạo group đầu tiên ở bên trên!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {groups.map((group) => {
                const count = taskCounts.get(group.id) || 0;
                
                return (
                  <div 
                    key={group.id}
                    className="group relative flex items-center p-5 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:border-blue-300 transform hover:scale-[1.02] transition-all duration-200"
                  >
                    <Link 
                      to={`/group/${group.id}`} 
                      className="flex items-center flex-grow no-underline"
                    >
                      <span 
                        className={`flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full font-bold text-white text-lg mr-4 ${
                          count > 0 ? 'bg-red-500' : 'bg-gray-400'
                        }`}
                      >
                        {count}
                      </span>
                      
                      <span className="text-xl font-medium text-gray-800 group-hover:text-blue-600">
                        {group.name}
                      </span>
                    </Link>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); 
                        requestDeleteGroup(group);
                      }}
                      className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      title="Xóa group"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
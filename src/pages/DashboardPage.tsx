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
} from 'firebase/firestore';
import { getLocalDateString, ensureTasksForDay } from '../utils/taskLogic';
import { useTodayPendingTasks } from '../hooks/useTodayPendingTasks';

const dashboardStyle: React.CSSProperties = { padding: '20px' };
const formStyle: React.CSSProperties = { margin: '20px 0', display: 'flex' };
const groupListStyle: React.CSSProperties = { marginTop: '20px' };

const redDotStyle: React.CSSProperties = {
  backgroundColor: 'red',
  color: 'white',
  borderRadius: '50%',
  width: '24px',
  height: '24px',
  display: 'inline-flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '14px',
  fontWeight: 'bold',
  marginRight: '10px',
};
const groupItemStyle: React.CSSProperties = {
  padding: '10px',
  border: '1px solid #ccc',
  borderRadius: '5px',
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center',
};

const LoadingOverlay = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 9999,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  }}>
    <h3>Đang chuẩn bị ngày mới của bạn...</h3>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false); 
  const { taskCounts } = useTodayPendingTasks(user?.uid);

  useEffect(() => {
    if (!user) return;

    const checkAndGenerateTasks = async () => {
      const todayString = getLocalDateString(new Date());
      const userDocRef = doc(db, 'users', user.uid);
      
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, { 
            email: user.email,
            // Đặt luôn lastTasksGeneratedForDate là 1 ngày cũ
            lastTasksGeneratedForDate: '1970-01-01' 
          }, { merge: true });
      }

      const userData = userDoc.data();
      const lastChecked = userData?.lastTasksGeneratedForDate || '1970-01-01';

      if (todayString > lastChecked) {
        setIsGenerating(true); 

        const groupsQuery = query(
          collection(db, "groups"),
          where("ownerId", "==", user.uid)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        const userGroups: Group[] = [];
        groupsSnapshot.forEach(doc => userGroups.push({id: doc.id, ...doc.data()} as Group));

        try {
          await Promise.all(
            userGroups.map(group => 
              ensureTasksForDay(user.uid, group.id, new Date())
            )
          );
        } catch (error) {
          console.error("Lỗi nghiêm trọng khi sinh task hàng loạt:", error);
        }

        await updateDoc(userDocRef, {
          lastTasksGeneratedForDate: todayString,
        });

        setIsGenerating(false);
      }
    };

    checkAndGenerateTasks();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingGroups(true);
    const q = query(
      collection(db, "groups"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
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

  if (isGenerating) {
    return <LoadingOverlay />;
  }

  return (
    <div style={dashboardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My Todo Groups</h1>
        <button onClick={handleLogout}>Đăng xuất</button>
      </div>
      <p>Chào mừng, {user?.displayName}!</p>

      <form style={formStyle} onSubmit={handleCreateGroup}>
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Tên Group mới..."
          style={{ padding: '10px', flex: 1 }}
        />
        <button type="submit" style={{ padding: '10px' }}>Tạo</button>
      </form>

      <div style={groupListStyle}>
        {loadingGroups ? (
          <p>Đang tải groups...</p>
        ) : groups.length === 0 ? (
          <p>Bạn chưa có group nào. Hãy tạo group đầu tiên!</p>
        ) : (
          groups.map((group) => {
            const count = taskCounts.get(group.id) || 0;
            
            return (
              <Link 
                to={`/group/${group.id}`} 
                key={group.id} 
                style={{...groupItemStyle, textDecoration: 'none', color: 'black'}}
              >
                {count > 0 && (
                  <span style={redDotStyle}>
                    {count}
                  </span>
                )}
                
                {count === 0 && (
                    <span style={{...redDotStyle, backgroundColor: '#ccc'}}>
                      0
                    </span>
                )}
                
                {group.name}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
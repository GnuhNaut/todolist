// src/components/AddTemplateModal.tsx
import { useState, FormEvent, Fragment } from 'react';
import { db } from '../config/firebase';
import { Recurrence, TaskTemplate } from '../types'; // <-- Thêm TaskTemplate
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, Transition } from '@headlessui/react';
import { useAuth } from '../context/AuthContext'; // <-- THÊM
import { getLocalDateString, doesTemplateMatchDate } from '../utils/taskLogic'; // <-- THÊM

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

const initialFormState: TaskFormState = {
  title: '',
  startTime: '09:00',
  endTime: '10:00',
  recurrenceType: 'daily',
  daysOfWeek: [],
  startDate: new Date().toISOString().split('T')[0],
};

interface TaskFormState {
  title: string;
  startTime: string;
  endTime: string;
  recurrenceType: 'daily' | 'weekly' | 'once';
  daysOfWeek: number[];
  startDate: string;
}

const AddTemplateModal = ({ isOpen, onClose, groupId }: AddTemplateModalProps) => {
  const [formState, setFormState] = useState<TaskFormState>(initialFormState);
  const { user } = useAuth(); // <-- THÊM: Lấy thông tin user

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupId || !user) return; // <-- THÊM: Đảm bảo có user

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
      // 1. Tạo Task Template
      const docRef = await addDoc(collection(db, 'groups', groupId, 'tasks'), {
        title: formState.title,
        startTime: formState.startTime,
        endTime: formState.endTime,
        recurrence: recurrence,
        groupId: groupId,
        createdAt: serverTimestamp(),
      });

      // *** BẮT ĐẦU PHẦN SỬA LỖI ***
      // 2. Kiểm tra xem template mới này có áp dụng cho hôm nay không
      const today = new Date();
      const todayString = getLocalDateString(today);
      
      // Tạo một object template tạm thời để kiểm tra logic
      const newTemplate: TaskTemplate = {
        id: docRef.id,
        title: formState.title,
        startTime: formState.startTime,
        endTime: formState.endTime,
        recurrence: recurrence,
        groupId: groupId,
        createdAt: serverTimestamp() // (timestamp là giả, không quan trọng cho logic kiểm tra)
      };

      // 3. Nếu template này khớp với hôm nay, tạo ngay một instance cho hôm nay
      if (doesTemplateMatchDate(newTemplate, today)) {
        const newInstanceData = {
          title: newTemplate.title,
          startTime: newTemplate.startTime,
          endTime: newTemplate.endTime,
          userId: user.uid, // <-- Dùng user.uid
          groupId: groupId,
          templateId: newTemplate.id,
          date: todayString,
          status: 'pending',
        };
        // Thêm vào collection 'taskInstances'
        await addDoc(collection(db, 'taskInstances'), newInstanceData);
      }
      // *** KẾT THÚC PHẦN SỬA LỖI ***

      setFormState(initialFormState);
      onClose();
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

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-xl font-bold leading-6 text-gray-900"
                >
                  Thêm Task Template mới
                </Dialog.Title>
                <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tên Task:</label>
                    <input
                      type="text"
                      name="title"
                      value={formState.title}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">Bắt đầu:</label>
                      <input type="time" name="startTime" value={formState.startTime} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">Kết thúc:</label>
                      <input type="time" name="endTime" value={formState.endTime} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tùy chọn lặp lại:</label>
                    <select name="recurrenceType" value={formState.recurrenceType} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                      <option value="daily">Hằng ngày</option>
                      <option value="weekly">Hằng tuần</option>
                      <option value="once">Chỉ một lần</option>
                    </select>
                  </div>

                  {formState.recurrenceType === 'weekly' && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm font-medium text-gray-700">Chọn ngày:</span>
                      {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => (
                        <label
                          key={index}
                          className={`cursor-pointer px-3 py-1 rounded-full text-sm ${
                            formState.daysOfWeek.includes(index)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
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
                      <label className="block text-sm font-medium text-gray-700">Chọn ngày:</label>
                      <input type="date" name="startDate" value={formState.startDate} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                      onClick={onClose}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Thêm Task
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AddTemplateModal;
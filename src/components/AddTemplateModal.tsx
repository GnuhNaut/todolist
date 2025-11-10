import { useState, FormEvent, Fragment } from 'react';
import { db } from '../config/firebase';
import { Recurrence, TaskTemplate } from '../types';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Dialog, Transition } from '@headlessui/react';
import { useAuth } from '../context/AuthContext';
import { getLocalDateString, doesTemplateMatchDate } from '../utils/taskLogic';

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
  const { user } = useAuth();

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
      const docRef = await addDoc(collection(db, 'groups', groupId, 'tasks'), {
        title: formState.title,
        startTime: formState.startTime,
        endTime: formState.endTime,
        recurrence: recurrence,
        groupId: groupId,
        createdAt: serverTimestamp(),
      });

      const today = new Date();
      const todayString = getLocalDateString(today);
      
      const newTemplate: TaskTemplate = {
        id: docRef.id,
        title: formState.title,
        startTime: formState.startTime,
        endTime: formState.endTime,
        recurrence: recurrence,
        groupId: groupId,
        createdAt: Timestamp.now()
      };

      if (doesTemplateMatchDate(newTemplate, today)) {
        const newInstanceData = {
          title: newTemplate.title,
          startTime: newTemplate.startTime,
          endTime: newTemplate.endTime,
          userId: user.uid, 
          groupId: groupId,
          templateId: newTemplate.id,
          date: todayString,
          status: 'pending',
        };
        await addDoc(collection(db, 'taskInstances'), newInstanceData);
      }

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
                <form onSubmit={handleFormSubmit} className="mt-4 space-y-5">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">Tên Task:</label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formState.title}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">Bắt đầu:</label>
                      <input type="time" id="startTime" name="startTime" value={formState.startTime} onChange={handleInputChange} required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">Kết thúc:</label>
                      <input type="time" id="endTime" name="endTime" value={formState.endTime} onChange={handleInputChange} required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="recurrenceType" className="block text-sm font-medium text-gray-700">Tùy chọn lặp lại:</label>
                    <select id="recurrenceType" name="recurrenceType" value={formState.recurrenceType} onChange={handleInputChange} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500">
                      <option value="daily">Hằng ngày</option>
                      <option value="weekly">Hằng tuần</option>
                      <option value="once">Chỉ một lần</option>
                    </select>
                  </div>

                  {formState.recurrenceType === 'weekly' && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm font-medium text-gray-700 mr-2">Chọn ngày:</span>
                      {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => (
                        <button
                          type="button"
                          key={index}
                          onClick={() => handleDayToggle(index)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            formState.daysOfWeek.includes(index)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  )}

                  {formState.recurrenceType === 'once' && (
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Chọn ngày:</label>
                      <input type="date" id="startDate" name="startDate" value={formState.startDate} onChange={handleInputChange} required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                      onClick={onClose}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
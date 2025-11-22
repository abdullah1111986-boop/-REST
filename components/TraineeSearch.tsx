
import React, { useState } from 'react';
import { Search, AlertCircle, Book, User, GraduationCap, FileQuestion } from 'lucide-react';
import { searchTraineeByNationalId, getSubjects } from '../services/firebase';
import { Trainee, Subject } from '../types';

const TraineeSearch: React.FC = () => {
  const [queryId, setQueryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ trainee: Trainee, remainingSubjects: Subject[] } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryId) return;
    
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const [trainee, allSubjects] = await Promise.all([
        searchTraineeByNationalId(queryId.trim()), // Ensure whitespace is removed
        getSubjects()
      ]);

      if (!trainee) {
        setError('لم يتم العثور على سجل لهذا الرقم. تأكد من رفع البيانات من قبل المشرف.');
        return;
      }

      // Filter subjects that are in the trainee's "failedSubjectIds" list (which stores Remaining subjects in this version)
      const remaining = allSubjects.filter(
        s => trainee.failedSubjectIds?.includes(s.code) || trainee.failedSubjectIds?.includes(s.id)
      ).sort((a,b) => a.level - b.level);

      setResult({ trainee, remainingSubjects: remaining });
    } catch (err) {
      console.error(err);
      setError('حدث خطأ في الاتصال بقاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Search Box */}
      {!result && (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-teal-50 text-center mb-8 animate-fade-in">
          <div className="mb-6">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-teal-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">الاستعلام عن المواد المتبقية</h2>
            <p className="text-gray-500 mt-2">أدخل رقم الهوية أو الرقم التدريبي</p>
          </div>

          <form onSubmit={handleSearch} className="relative max-w-md mx-auto">
            <input
              type="text"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder="أدخل الرقم هنا..."
              className="w-full pl-4 pr-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:bg-white transition-all text-lg text-center shadow-inner outline-none font-mono"
              autoFocus
            />
            <div className="absolute left-2 top-2 bottom-2">
              <button 
                type="submit"
                disabled={loading}
                className="h-full px-6 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-bold disabled:opacity-70"
              >
                {loading ? '...' : 'بحث'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center justify-center gap-2 animate-pulse">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-scale-up">
           
           {/* Header Card */}
           <div className="bg-gray-800 text-white p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                 <div>
                   <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                     <User /> {result.trainee.fullName}
                   </h1>
                   <p className="text-gray-400 text-sm">المواد المسجلة في النظام كمتبقية</p>
                 </div>
                 <button onClick={() => setResult(null)} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors">
                    بحث جديد
                 </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-700/50 p-4 rounded-xl text-sm border border-gray-600">
                 <div>
                    <span className="block text-gray-400 text-xs">رقم الهوية</span>
                    <span className="font-mono font-bold">{result.trainee.nationalId}</span>
                 </div>
                 <div>
                    <span className="block text-gray-400 text-xs">الرقم التدريبي</span>
                    <span className="font-mono font-bold">{result.trainee.traineeNumber || '-'}</span>
                 </div>
                  <div>
                    <span className="block text-gray-400 text-xs">التخصص</span>
                    <span className="font-bold">{result.trainee.major || 'عام'}</span>
                 </div>
                 <div>
                    <span className="block text-gray-400 text-xs">المعدل</span>
                    <span className="font-bold font-mono text-teal-400">{result.trainee.gpa || '-'}</span>
                 </div>
              </div>
           </div>

           {/* Body */}
           <div className="p-6 bg-gray-50">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
               <FileQuestion className="text-orange-600" size={20} />
               المواد المتبقية ({result.remainingSubjects.length})
             </h3>
             
             {result.remainingSubjects.length === 0 ? (
                <div className="text-center py-8 bg-white rounded border border-gray-200 text-green-600 font-bold">
                  لا توجد مواد متبقية مسجلة لهذا المتدرب.
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.remainingSubjects.map(sub => (
                     <div key={sub.id} className="bg-white border-r-4 border-orange-500 p-4 rounded shadow-sm hover:shadow-md transition-shadow">
                        <div className="font-bold text-gray-800">{sub.name}</div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex gap-2">
                             <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{sub.code}</span>
                             {sub.level > 0 && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">مستوى {sub.level}</span>}
                          </div>
                          <span className="text-xs font-bold text-orange-600">{sub.creditHours || 3} ساعات</span>
                        </div>
                     </div>
                  ))}
                </div>
             )}
           </div>
        </div>
      )}
    </div>
  );
};

export default TraineeSearch;

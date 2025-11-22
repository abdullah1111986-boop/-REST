import React, { useState, useEffect, useRef } from 'react';
import { FileSpreadsheet, Loader, Upload, Search, Trash2, User, BookOpen, X, AlertTriangle, HardDrive, Cloud } from 'lucide-react';
import { Subject, Trainee } from '../types.ts';
import { 
  getSubjects, getTrainees, deleteTrainee, deleteSubject,
  processBulkImport, getAppMode
} from '../services/firebase.ts';
import * as XLSX from 'xlsx';

const AdminDashboard: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // UI States
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appMode = getAppMode();
  const isLocal = appMode === 'local';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subs, trains] = await Promise.all([getSubjects(), getTrainees()]);
      setSubjects(subs.sort((a, b) => a.level - b.level));
      setTrainees(trains);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrainee = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف سجل المتدرب؟")) return;
    await deleteTrainee(id);
    fetchData();
    if (selectedTrainee?.id === id) setSelectedTrainee(null);
  };

  // --- CORE LOGIC: PARSE ROW DATA ---
  const parseSheetData = (rows: any[][]) => {
      if (!rows || rows.length === 0) return { success: false, msg: "الملف فارغ" };

      const identityKeywords = ['رقم', 'هوية', 'سجل', 'id', 'no', 'num', 'student', 'trainee', 'المتدرب', 'اكاديمي'];
      const subjectCodeKeywords = ['رمز', 'كود', 'code', 'symbol', 'course', 'مقرر', 'مادة', 'المادة'];
      const subjectNameKeywords = ['اسم المادة', 'اسم المقرر', 'name', 'وصف', 'desc', 'title'];

      let headerRowIndex = -1;
      let maxMatches = 0;
      let bestColMap = new Map<string, number>();

      // 1. Find Header Row
      for (let i = 0; i < Math.min(rows.length, 25); i++) {
          const rowStr = rows[i].map(c => String(c).toLowerCase().trim());
          let matches = 0;
          if (rowStr.some(c => identityKeywords.some(kw => c.includes(kw)))) matches++;
          if (rowStr.some(c => subjectCodeKeywords.some(kw => c.includes(kw)))) matches++;
          
          if (matches > maxMatches) {
            maxMatches = matches;
            headerRowIndex = i;
            const map = new Map<string, number>();
            rowStr.forEach((cell, idx) => map.set(cell, idx));
            bestColMap = map;
          }
      }

      if (maxMatches < 1) {
          return { success: false, msg: "لم يتم التعرف على العناوين. تأكد من وجود 'رقم المتدرب' و 'رمز المقرر' أو تأكد من ترميز الملف." };
      }

      const findCol = (keywords: string[]) => {
         for (const [colName, idx] of bestColMap.entries()) {
            if (keywords.some(kw => colName.includes(kw))) return idx;
         }
         return -1;
      };

      const idColIdx = findCol(identityKeywords);
      const codeColIdx = findCol(subjectCodeKeywords);

      if (idColIdx === -1 || codeColIdx === -1) {
         return { success: false, msg: "العناوين غير مكتملة. يجب أن يحتوي الملف على عمود لرقم المتدرب وعمود لرمز المقرر." };
      }

      // 2. Extract Data
      const importedSubjects = new Map<string, any>();
      const importedTrainees = new Map<string, any>();
      
      const nameColIdx = findCol(subjectNameKeywords);
      const traineeNameColIdx = findCol(['اسم المتدرب', 'student name', 'full name', 'الاسم']);
      const phoneColIdx = findCol(['جوال', 'هاتف', 'mobile', 'phone']);
      const majorColIdx = findCol(['تخصص', 'major', 'department']);

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
         const row = rows[i];
         if (!row) continue;
         
         let rawId = row[idColIdx];
         if (!rawId) continue;
         const idStr = String(rawId).replace(/[^a-zA-Z0-9]/g, '');
         if (idStr.length < 3) continue;

         let subCode = String(row[codeColIdx] || '').trim();
         if (!subCode || subCode.length < 2) continue;

         let subName = nameColIdx !== -1 ? String(row[nameColIdx] || '').trim() : '';
         if (!subName) subName = subCode;

         let traineeName = `متدرب ${idStr}`;
         if (traineeNameColIdx !== -1 && row[traineeNameColIdx]) {
            traineeName = String(row[traineeNameColIdx]).trim();
         }
         
         if (!importedTrainees.has(idStr)) {
            importedTrainees.set(idStr, {
               fullName: traineeName,
               nationalId: idStr,
               traineeNumber: idStr,
               phoneNumber: phoneColIdx !== -1 ? String(row[phoneColIdx] || '') : '',
               major: majorColIdx !== -1 ? String(row[majorColIdx] || '') : '',
               gpa: '',
               completedHours: 0,
               remainingHours: 0,
               passedSubjectIds: [],
               failedSubjectIds: new Set()
            });
         }

         const t = importedTrainees.get(idStr);
         t.failedSubjectIds.add(subCode);

         if (!importedSubjects.has(subCode)) {
           importedSubjects.set(subCode, {
             name: subName,
             code: subCode,
             level: 1, 
             creditHours: 3 
           });
         }
      }

      return { success: true, subjects: importedSubjects, trainees: importedTrainees };
  };

  // --- FILE UPLOAD HANDLER ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const completeImport = async (result: any) => {
        if (result.trainees.size === 0) {
            alert("تم قراءة الملف ولكن لم يتم العثور على بيانات متدربين صالحة.");
            setImporting(false);
            return;
        }

        try {
            const traineesPayload = new Map<string, any>();
            result.trainees.forEach((val: any, key: string) => {
                traineesPayload.set(key, {
                  ...val,
                  failedSubjectIds: Array.from(val.failedSubjectIds)
                });
            });

            await processBulkImport({
              subjects: result.subjects,
              trainees: traineesPayload
            });

            alert(`تم بنجاح! \nتم تحديث بيانات ${traineesPayload.size} متدرب في ${isLocal ? 'قاعدة البيانات المحلية' : 'قاعدة بيانات السحابة'}.`);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("حدث خطأ أثناء حفظ البيانات.");
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Reader Implementation (same as before)
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const data = evt.target?.result;
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            
            const result = parseSheetData(rows);
            
            if (result.success) {
                await completeImport(result);
            } else {
                const textReader = new FileReader();
                textReader.onload = async (textEvt) => {
                     try {
                         const textStr = textEvt.target?.result as string;
                         const wb2 = XLSX.read(textStr, { type: 'string' });
                         const ws2 = wb2.Sheets[wb2.SheetNames[0]];
                         const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1 }) as any[][];
                         const result2 = parseSheetData(rows2);
                         if (result2.success) {
                             await completeImport(result2);
                         } else {
                             alert(`فشل قراءة الملف.\nالسبب: ${result.msg}`);
                             setImporting(false);
                         }
                     } catch (err2) {
                         alert("فشل قراءة الملف.");
                         setImporting(false);
                     }
                };
                textReader.readAsText(file, 'windows-1256');
            }

        } catch (err) {
            console.error(err);
            alert("خطأ غير متوقع في قراءة الملف.");
            setImporting(false);
        }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- RENDER HELPERS ---

  const filteredTrainees = trainees.filter(t => 
    t.fullName.includes(searchTerm) || 
    t.nationalId.includes(searchTerm) ||
    t.traineeNumber.includes(searchTerm) ||
    (t.phoneNumber && t.phoneNumber.includes(searchTerm))
  );

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Hero Section: Upload Only */}
      <div className={`bg-white p-8 rounded-2xl shadow-lg border-t-4 ${isLocal ? 'border-orange-500' : 'border-teal-600'} text-center relative overflow-hidden`}>
         
         {isLocal && (
            <div className="absolute top-4 right-4 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
               <HardDrive size={14} /> قاعدة بيانات محلية (Browser)
            </div>
         )}

         <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isLocal ? 'bg-orange-50 text-orange-600' : 'bg-teal-50 text-teal-600'}`}>
           <FileSpreadsheet size={40} />
         </div>
         <h2 className="text-2xl font-bold text-gray-800 mb-2">إدارة المواد المتبقية</h2>
         <p className="text-gray-500 max-w-xl mx-auto mb-6">
           قم برفع ملف الإكسل أو CSV.
           <br/>
           <span className={`text-xs font-bold ${isLocal ? 'text-orange-600' : 'text-teal-600'}`}>
             سيتم الحفظ في: {isLocal ? 'المتصفح الحالي فقط (Temporary)' : 'السيرفر السحابي (Cloud)'}
           </span>
         </p>
         
         <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className={`px-8 py-4 rounded-xl text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 mx-auto text-lg font-bold disabled:opacity-60 disabled:cursor-not-allowed ${isLocal ? 'bg-orange-600 hover:bg-orange-700' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            {importing ? <Loader className="animate-spin" /> : <Upload />}
            {importing ? 'جاري المعالجة محلياً...' : 'رفع ملف المواد المتبقية'}
          </button>
      </div>

      {/* Results Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[400px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className={`font-bold flex items-center gap-2 ${isLocal ? 'text-orange-700' : 'text-teal-700'}`}>
             <User size={20}/>
             قائمة المتدربين ({trainees.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-3 text-gray-400" size={18} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث (الاسم / الرقم)..."
              className={`w-full pr-10 pl-4 py-2 border rounded-lg focus:outline-none text-sm focus:ring-2 ${isLocal ? 'focus:ring-orange-500' : 'focus:ring-teal-500'}`}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-grow overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-600 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-4">المتدرب</th>
                <th className="px-6 py-4">التخصص</th>
                <th className="px-6 py-4 text-center">رقم الهوية / التدريبي</th>
                <th className="px-6 py-4 text-center">المواد المتبقية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTrainees.map(t => (
                <tr 
                  key={t.id} 
                  onClick={() => setSelectedTrainee(t)}
                  className={`cursor-pointer transition-colors group ${isLocal ? 'hover:bg-orange-50' : 'hover:bg-teal-50'}`}
                >
                  <td className="px-6 py-4">
                    <div className={`font-bold text-gray-800 transition-colors ${isLocal ? 'group-hover:text-orange-700' : 'group-hover:text-teal-700'}`}>{t.fullName}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.major || '-'}</td>
                  <td className="px-6 py-4 text-center font-mono text-gray-600">{t.nationalId}</td>
                  <td className="px-6 py-4 text-center font-bold text-orange-600">
                    {t.failedSubjectIds?.length || 0} مادة
                  </td>
                </tr>
              ))}
              {filteredTrainees.length === 0 && (
                <tr>
                   <td colSpan={4} className="py-12 text-center text-gray-400 flex flex-col items-center justify-center">
                     <AlertTriangle className="mb-2 opacity-50" size={32}/>
                     <span>لا يوجد بيانات. قم برفع الملف أولاً.</span>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer (Reset) */}
        <div className="bg-gray-50 p-3 border-t flex justify-end">
           <button 
             onClick={() => {
                if(window.confirm(`هل تريد حذف جميع البيانات من ${isLocal ? 'قاعدة البيانات المحلية' : 'قاعدة بيانات السحابة'}؟`)) {
                    subjects.forEach(s => deleteSubject(s.id));
                    trainees.forEach(t => deleteTrainee(t.id));
                    setTimeout(() => window.location.reload(), 1000);
                }
             }}
             className="text-xs text-red-400 hover:text-red-600 hover:underline"
           >
             إفراغ قاعدة البيانات ({isLocal ? 'Local' : 'Firebase'})
           </button>
        </div>
      </div>

      {/* TRANSCRIPT MODAL VIEW */}
      {selectedTrainee && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 animate-scale-up">
            
            {/* Header */}
            <div className="bg-gray-800 text-white p-6 relative">
              <button 
                onClick={() => setSelectedTrainee(null)} 
                className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-8">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedTrainee.fullName}</h2>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-300 font-mono">
                    <span className="bg-gray-700 px-2 py-1 rounded">الرقم: {selectedTrainee.traineeNumber || selectedTrainee.nationalId}</span>
                    {selectedTrainee.phoneNumber && <span className="bg-gray-700 px-2 py-1 rounded">هاتف: {selectedTrainee.phoneNumber}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                   <button 
                      onClick={() => handleDeleteTrainee(selectedTrainee.id)}
                      className="bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} /> حذف السجل
                   </button>
                </div>
              </div>
            </div>

            {/* Transcript Body */}
            <div className="p-6 bg-gray-100 overflow-y-auto max-h-[60vh]">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <BookOpen size={20} className="text-orange-600"/>
                 المواد المتبقية ({selectedTrainee.failedSubjectIds?.length || 0})
              </h3>

              {selectedTrainee.failedSubjectIds?.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed">
                  لا توجد مواد متبقية مسجلة في الملف لهذا المتدرب.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                   {subjects
                     .filter(s => selectedTrainee.failedSubjectIds.includes(s.code) || selectedTrainee.failedSubjectIds.includes(s.id))
                     .map(sub => (
                       <div key={sub.id} className="bg-white border-r-4 border-orange-500 p-4 rounded shadow-sm flex flex-col gap-1">
                          <div className="font-bold text-gray-800">{sub.name}</div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{sub.code}</span>
                            <span className="text-xs font-bold text-orange-600">{sub.creditHours || 3} ساعات</span>
                          </div>
                       </div>
                   ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
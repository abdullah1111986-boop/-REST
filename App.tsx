import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import TraineeSearch from './components/TraineeSearch';
import { ADMIN_PASSWORD_HASH, FirebaseConfig } from './types';
import { initFirebase, isFirebaseInitialized } from './services/firebase';
import { Lock, Settings, Save, HelpCircle, Check } from 'lucide-react';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Default to true since we hardcoded the config in services/firebase.ts
  const [firebaseReady, setFirebaseReady] = useState(true);

  useEffect(() => {
    // Double check just in case
    if (isFirebaseInitialized()) {
        setFirebaseReady(true);
    }
  }, []);

  // --- Login Component Internal ---
  const LoginScreen = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (password === ADMIN_PASSWORD_HASH) {
        setIsAdmin(true);
        setShowLogin(false);
        setPassword('');
      } else {
        setError(true);
      }
    };

    return (
      <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-xl shadow-lg text-center relative">
        <button 
           onClick={() => setShowSettings(true)}
           className="absolute top-4 left-4 text-gray-400 hover:text-teal-600"
           title="إعدادات السيرفر"
        >
           <Settings size={20} />
        </button>

        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="text-teal-700" size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">دخول المشرفين</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="كلمة المرور (1234)"
            className="w-full px-4 py-3 border rounded-lg text-center focus:ring-2 focus:ring-teal-500 outline-none dir-ltr"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">كلمة المرور غير صحيحة</p>}
          <button
            type="submit"
            className="w-full bg-teal-700 text-white py-3 rounded-lg font-bold hover:bg-teal-800 transition-colors"
          >
            دخول
          </button>
        </form>
        <button 
          onClick={() => setShowLogin(false)}
          className="mt-4 text-gray-500 text-sm hover:underline"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  };

  // --- Settings Component Internal ---
  const SettingsModal = () => {
    const [configJson, setConfigJson] = useState(
      // Default to empty string if nothing in local storage, user can paste new config to override
      localStorage.getItem('firebaseConfig') || ''
    );
    const [status, setStatus] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const handleSave = () => {
      try {
        const config: FirebaseConfig = JSON.parse(configJson);
        const success = initFirebase(config);
        if (success) {
          setStatus('تم الحفظ! سيتم إعادة التحميل...');
          setTimeout(() => {
              window.location.reload();
          }, 1000);
        } else {
          setStatus('فشل الحفظ، تأكد من صحة البيانات');
        }
      } catch (e) {
        setStatus('خطأ: تأكد أن النص بصيغة JSON صحيحة');
      }
    };

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold flex items-center gap-2"><Settings size={18} /> تحديث ربط قاعدة البيانات</h3>
            <button onClick={() => setShowSettings(false)} className="hover:text-gray-300">✕</button>
          </div>
          
          <div className="flex-grow overflow-y-auto p-6">
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                   <h4 className="font-bold text-blue-800 mb-1 flex items-center gap-2">
                     <HelpCircle size={16} /> تنويه
                   </h4>
                   <p className="text-sm text-blue-700">
                     التطبيق متصل حالياً بقاعدة البيانات الافتراضية. استخدم هذا النموذج فقط إذا كنت تريد تغيير قاعدة البيانات الحالية بأخرى جديدة.
                   </p>
            </div>

            {!showHelp ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كود الإعدادات الجديد (JSON):
                </label>
                <textarea
                  className="w-full h-64 p-4 text-xs font-mono bg-gray-900 text-green-400 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none shadow-inner"
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  placeholder={`{
  "apiKey": "...",
  "projectId": "...",
  ...
}`}
                  dir="ltr"
                />
                {status && (
                  <div className={`mt-3 p-3 rounded-lg text-sm font-bold flex items-center gap-2 ${status.includes('تم') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {status.includes('تم') ? <Check size={16}/> : <Settings size={16}/>}
                    {status}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4 text-sm text-gray-700">
                {/* Help content omitted for brevity as user already has data */}
                 <p>يمكنك العثور على البيانات في إعدادات مشروعك في فايربيس.</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0 gap-2">
              <button 
                onClick={handleSave}
                className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 flex items-center gap-2 font-bold"
              >
                <Save size={18} /> حفظ وتحديث
              </button>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Render ---

  return (
    <Router>
       <div dir="rtl" className="font-cairo">
        {showSettings && <SettingsModal />}
        
        <Layout 
          title={isAdmin ? "لوحة المشرف - متابعة المواد" : "نظام المواد المتبقية"}
          showLogout={isAdmin}
          onLogout={() => { setIsAdmin(false); setShowLogin(false); }}
          onOpenSettings={() => setShowSettings(true)}
        >
          <Routes>
            <Route path="/" element={
              showLogin ? (
                <LoginScreen />
              ) : isAdmin ? (
                <AdminDashboard />
              ) : (
                <div className="space-y-8 py-8">
                   <TraineeSearch />
                   <div className="text-center mt-16 border-t border-gray-200 pt-8 max-w-md mx-auto">
                     <p className="text-gray-400 text-sm mb-4">منطقة المشرفين والمدربين فقط</p>
                     <button 
                       onClick={() => setShowLogin(true)}
                       className="text-teal-700 font-medium bg-teal-50 px-6 py-2 rounded-full hover:bg-teal-100 flex items-center justify-center gap-2 mx-auto transition-colors"
                     >
                       <Lock size={16} />
                       دخول لوحة التحكم
                     </button>
                   </div>
                </div>
              )
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </div>
    </Router>
  );
}

export default App;
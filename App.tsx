import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import TraineeSearch from './components/TraineeSearch.tsx';
import { ADMIN_PASSWORD_HASH, FirebaseConfig } from './types.ts';
import { initFirebase, isFirebaseInitialized, getAppMode, setAppMode } from './services/firebase.ts';
import { Lock, Settings, Save, HelpCircle, Check, HardDrive, Cloud, RefreshCw } from 'lucide-react';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(true);
  
  const currentMode = getAppMode();

  useEffect(() => {
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
      <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-xl shadow-lg text-center relative animate-fade-in">
        <button 
           onClick={() => setShowSettings(true)}
           className="absolute top-4 left-4 text-gray-400 hover:text-teal-600"
           title="إعدادات السيرفر"
        >
           <Settings size={20} />
        </button>

        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${currentMode === 'local' ? 'bg-orange-100' : 'bg-teal-100'}`}>
          <Lock className={currentMode === 'local' ? 'text-orange-700' : 'text-teal-700'} size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">دخول المشرفين</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="كلمة المرور (1234)"
            className={`w-full px-4 py-3 border rounded-lg text-center focus:ring-2 outline-none dir-ltr ${currentMode === 'local' ? 'focus:ring-orange-500' : 'focus:ring-teal-500'}`}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">كلمة المرور غير صحيحة</p>}
          <button
            type="submit"
            className={`w-full text-white py-3 rounded-lg font-bold transition-colors ${currentMode === 'local' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-teal-700 hover:bg-teal-800'}`}
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
      localStorage.getItem('firebaseConfig') || ''
    );
    const [status, setStatus] = useState('');
    const [mode, setMode] = useState(currentMode);

    const handleSaveConfig = () => {
      try {
        const config: FirebaseConfig = JSON.parse(configJson);
        const success = initFirebase(config);
        if (success) {
          setStatus('تم حفظ إعدادات فايربيس! سيتم إعادة التحميل...');
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

    const handleToggleMode = (newMode: 'cloud' | 'local') => {
        if (newMode === mode) return;
        if (window.confirm(newMode === 'local' 
            ? "هل أنت متأكد من التحويل إلى الوضع المحلي؟\nسيتم حفظ البيانات في هذا المتصفح فقط ولن تكون متاحة للآخرين." 
            : "هل أنت متأكد من التحويل إلى الوضع السحابي؟\nسيتم الاتصال بـ Firebase لعرض البيانات المشتركة.")) {
            setAppMode(newMode);
        }
    };

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
          <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold flex items-center gap-2"><Settings size={18} /> إعدادات النظام</h3>
            <button onClick={() => setShowSettings(false)} className="hover:text-gray-300">✕</button>
          </div>
          
          <div className="flex-grow overflow-y-auto p-6 space-y-8">
            
            {/* MODE TOGGLE */}
            <div className="space-y-3">
                <h4 className="font-bold text-gray-700 flex items-center gap-2 text-lg border-b pb-2">
                    <HardDrive size={20} /> نوع التخزين (Database Mode)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleToggleMode('cloud')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${mode === 'cloud' ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-gray-200 hover:border-gray-300 text-gray-500'}`}
                    >
                        <Cloud size={32} className={mode === 'cloud' ? 'text-teal-600' : 'text-gray-400'} />
                        <span className="font-bold">النظام السحابي (Firebase)</span>
                        <span className="text-xs text-center">البيانات مشتركة بين جميع المستخدمين وتخزن في السيرفر</span>
                    </button>
                    
                    <button 
                         onClick={() => handleToggleMode('local')}
                         className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${mode === 'local' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 hover:border-gray-300 text-gray-500'}`}
                    >
                        <HardDrive size={32} className={mode === 'local' ? 'text-orange-500' : 'text-gray-400'} />
                        <span className="font-bold">النظام المحلي (Local DB)</span>
                        <span className="text-xs text-center">البيانات تخزن في هذا المتصفح فقط (مؤقت/للعرض)</span>
                    </button>
                </div>
            </div>

            {/* FIREBASE CONFIG */}
            {mode === 'cloud' && (
                <div className="space-y-3 opacity-100 transition-opacity">
                    <h4 className="font-bold text-gray-700 flex items-center gap-2 text-lg border-b pb-2 mt-6">
                        <RefreshCw size={20} /> تحديث إعدادات الربط (Firebase Config)
                    </h4>
                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
                        <div className="flex gap-2">
                            <HelpCircle size={16} className="text-blue-600 shrink-0 mt-0.5"/> 
                            <p className="text-sm text-blue-700">
                                استخدم هذا القسم فقط إذا كنت تريد ربط التطبيق بقاعدة بيانات فايربيس مختلفة عن الافتراضية.
                            </p>
                        </div>
                    </div>
                    <textarea
                    className="w-full h-32 p-4 text-xs font-mono bg-gray-900 text-green-400 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none shadow-inner"
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    dir="ltr"
                    placeholder='{"apiKey": "...", "projectId": "...", ...}'
                    />
                     <div className="flex justify-end">
                        <button 
                            onClick={handleSaveConfig}
                            className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black flex items-center gap-2 text-sm font-bold"
                        >
                            <Save size={16} /> تحديث المفاتيح
                        </button>
                    </div>
                    {status && (
                    <div className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 ${status.includes('تم') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {status.includes('تم') ? <Check size={16}/> : <Settings size={16}/>}
                        {status}
                    </div>
                    )}
                </div>
            )}
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
                       className={`font-medium px-6 py-2 rounded-full flex items-center justify-center gap-2 mx-auto transition-colors ${currentMode === 'local' ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' : 'text-teal-700 bg-teal-50 hover:bg-teal-100'}`}
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
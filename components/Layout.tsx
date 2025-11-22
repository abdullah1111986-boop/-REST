import React from 'react';
import { LogOut, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  title: string;
  showLogout?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, onOpenSettings, title, showLogout }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-800 font-cairo">
      {/* Header with Logos */}
      <header className="bg-white shadow-md border-b border-teal-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-700"></div>
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* Right Side: TVTC Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="https://upload.wikimedia.org/wikipedia/ar/thumb/2/2d/TVTC_Logo.svg/1200px-TVTC_Logo.svg.png" 
                alt="TVTC Logo" 
                className="h-12 sm:h-16 object-contain drop-shadow-sm"
              />
              <div className="hidden md:block border-r-2 border-gray-200 pr-3 mr-2">
                 <h2 className="text-xs text-gray-500 font-semibold">المملكة العربية السعودية</h2>
                 <h1 className="text-sm font-bold text-teal-800">المؤسسة العامة للتدريب التقني والمهني</h1>
              </div>
            </div>

            {/* Center: Title (Hidden on small screens) */}
            <div className="hidden lg:block text-center">
               <h1 className="text-xl font-bold text-gray-800 tracking-wide">{title}</h1>
            </div>

            {/* Left Side: Vision 2030 & Controls */}
            <div className="flex items-center gap-4">
              {/* Controls */}
              <div className="flex gap-2 ml-2 sm:ml-6">
                {onOpenSettings && (
                  <button 
                    onClick={onOpenSettings}
                    className="p-2 text-gray-500 hover:text-teal-700 hover:bg-teal-50 rounded-full transition-all"
                    title="الإعدادات"
                  >
                    <Settings size={20} />
                  </button>
                )}
                {showLogout && onLogout && (
                  <button 
                    onClick={onLogout}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors border border-red-200"
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">خروج</span>
                  </button>
                )}
              </div>

              {/* Vision Logo */}
              <img 
                src="https://upload.wikimedia.org/wikipedia/ar/thumb/b/bb/Saudi_Vision_2030_logo.svg/1200px-Saudi_Vision_2030_logo.svg.png" 
                alt="Vision 2030" 
                className="h-10 sm:h-14 object-contain"
              />
            </div>
          </div>
          
          {/* Title for mobile */}
          <div className="lg:hidden mt-3 text-center border-t pt-2">
             <h1 className="text-lg font-bold text-gray-800">{title}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white pt-8 pb-4 mt-auto border-t-4 border-teal-600">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 text-center md:text-right">
             <div>
               <h3 className="font-bold text-lg mb-1">نظام متابعة الخطط التدريبية</h3>
               <p className="text-gray-400 text-sm">منصة إلكترونية لمتابعة المواد المتبقية والمستوفاه للمتدربين</p>
             </div>
             <div className="bg-gray-700/50 px-6 py-3 rounded-xl border border-gray-600">
                <p className="text-xs text-gray-400 mb-1">تصميم وتطوير</p>
                <p className="font-bold text-teal-400">م. عبدالله الزهراني</p>
             </div>
          </div>
          <div className="border-t border-gray-700 pt-4 text-center text-xs text-gray-500 flex flex-col sm:flex-row justify-center gap-2">
            <span>جميع الحقوق محفوظة &copy; {new Date().getFullYear()}</span>
            <span className="hidden sm:inline">|</span>
            <span>المؤسسة العامة للتدريب التقني والمهني</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
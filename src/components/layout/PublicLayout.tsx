import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col">
      <header className="border-b border-[#333] bg-[#0A0A0A]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="ReTurnos" className="w-7 h-7 rounded-lg object-cover" />
            <span className="text-white font-semibold text-sm">ReTurnos</span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[#333] bg-[#0A0A0A]">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-center">
          <p className="text-xs text-[#9CA3AF]">
            Powered by <span className="text-[#DC2626] font-medium">ReTurnos</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

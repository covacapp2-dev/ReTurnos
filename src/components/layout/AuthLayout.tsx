import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-5">
          <img src="/logo.png" alt="ReTurnos" className="w-14 h-14 rounded-xl object-cover mb-2" />
          <h1 className="text-xl font-bold text-white tracking-tight">ReTurnos</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Sistema de gestión de reservas</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-5 shadow-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

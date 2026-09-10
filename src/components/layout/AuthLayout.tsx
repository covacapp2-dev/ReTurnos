import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ReTurnos" className="w-14 h-14 rounded-2xl object-cover mb-4" />
          <h1 className="text-2xl font-bold text-white tracking-tight">ReTurnos</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">Sistema de gestión de reservas</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-8 shadow-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

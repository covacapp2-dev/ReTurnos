import { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Search, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';
import Avatar from '../ui/Avatar';

export default function Topbar() {
  const { user, profile, business } = useAuthStore();
  const { toggleMobileMenu } = useUIStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userName = profile?.full_name || user?.email || 'Usuario';
  const userAvatar = profile?.avatar_url || null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 bg-[#080808] border-b border-[#333] flex items-center px-4 lg:px-6 gap-4">
      <button
        onClick={toggleMobileMenu}
        className="lg:hidden p-2 rounded-lg text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white transition-colors"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-[#9CA3AF]" />
          </div>
          <input
            type="text"
            placeholder="Buscar..."
            className={cn(
              'w-full rounded-lg border border-[#333] bg-[#1A1A1A] text-white',
              'placeholder:text-[#9CA3AF] pl-9 pr-3 py-2 text-sm',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]'
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {business?.name && (
          <span className="hidden md:block text-xs text-[#9CA3AF] truncate max-w-[160px]">
            {business.name}
          </span>
        )}

        <button className="relative p-2 rounded-lg text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-2 p-1.5 rounded-lg transition-colors duration-150',
              'hover:bg-[#1A1A1A]',
              dropdownOpen && 'bg-[#1A1A1A]'
            )}
          >
            <Avatar src={userAvatar} name={userName} size="sm" />
            <span className="hidden sm:block text-sm text-white truncate max-w-[120px]">
              {userName}
            </span>
            <ChevronDown size={14} className="hidden sm:block text-[#9CA3AF]" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#1A1A1A] border border-[#333] rounded-lg shadow-xl py-1 z-50">
              <div className="px-4 py-3 border-b border-[#333]">
                <p className="text-sm font-medium text-white truncate">{userName}</p>
                <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{user?.email}</p>
              </div>
              <a
                href="/mi-cuenta"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#9CA3AF] hover:bg-[#222] hover:text-white transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                <User size={16} />
                Mi cuenta
              </a>
              <hr className="border-[#333] my-1" />
              <button
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#9CA3AF] hover:bg-[#222] hover:text-white transition-colors w-full"
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

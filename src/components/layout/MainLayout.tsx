import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';

export default function MainLayout() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-[#080808]">
      <Sidebar />

      <div
        className={cn(
          'transition-all duration-300',
          'lg:ml-[250px]',
          sidebarCollapsed && 'lg:ml-[70px]'
        )}
      >
        <Topbar />

        <main className="p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

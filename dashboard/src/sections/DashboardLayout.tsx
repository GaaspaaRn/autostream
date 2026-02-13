import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Car,
  Briefcase,
  Settings,
  Menu,
  Bell,
  Search,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../hooks/useApi';
// import type { User } from '../types';

type Page = 'dashboard' | 'leads' | 'veiculos' | 'negociacoes' | 'vendedores' | 'configuracoes';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const menuItems: { page: Page; label: string; icon: typeof LayoutDashboard; roles?: string[] }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'leads', label: 'Leads', icon: Users },
  { page: 'veiculos', label: 'Veículos', icon: Car },
  { page: 'negociacoes', label: 'Negociações', icon: Briefcase },
  { page: 'vendedores', label: 'Vendedores', icon: Users, roles: ['ADMIN', 'GERENTE'] },
  { page: 'configuracoes', label: 'Configurações', icon: Settings, roles: ['ADMIN'] },
];

export function DashboardLayout({ children, currentPage, onNavigate }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const filteredMenuItems = menuItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <div>
            <span className="block font-bold text-white leading-tight">AUTOSTREAM</span>
            <span className="block text-xs text-neutral-400">CRM</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredMenuItems.map((item) => (
          <button
            key={item.page}
            onClick={() => {
              onNavigate(item.page);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${currentPage === item.page
                ? 'bg-amber-500 text-white'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
            {user?.foto_url ? (
              <img src={user.foto_url} alt={user.nome} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-white font-medium">{user?.nome.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{user?.nome}</p>
            <p className="text-neutral-400 text-xs">{user?.role}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-neutral-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-neutral-900 fixed h-full">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-neutral-900 border-neutral-800">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
              </Sheet>

              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  placeholder="Buscar..."
                  className="pl-10 w-64"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-amber-500 text-[10px]">
                  3
                </Badge>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                      {user?.foto_url ? (
                        <img src={user.foto_url} alt={user.nome} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="font-medium">{user?.nome.charAt(0)}</span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Meu Perfil</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
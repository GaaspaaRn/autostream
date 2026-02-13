import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useApi';
import { Login } from './sections/Login';
import { DashboardLayout } from './sections/DashboardLayout';
import { DashboardHome } from './sections/DashboardHome';
import { Leads } from './sections/Leads';
import { Veiculos } from './sections/Veiculos';
import { Negociacoes } from './sections/Negociacoes';
import { Vendedores } from './sections/Vendedores';
import { Configuracoes } from './sections/Configuracoes';
import { Toaster } from '@/components/ui/sonner';

type Page = 'dashboard' | 'leads' | 'veiculos' | 'negociacoes' | 'vendedores' | 'configuracoes';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardHome />;
      case 'leads':
        return <Leads />;
      case 'veiculos':
        return <Veiculos />;
      case 'negociacoes':
        return <Negociacoes />;
      case 'vendedores':
        return <Vendedores />;
      case 'configuracoes':
        return <Configuracoes />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
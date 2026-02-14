import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Star, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApi, useAuth } from '../hooks/useApi';
import type { User } from '../types';

interface VendedorWithMetrics extends User {
  _count?: {
    leads_atribuidos: number;
    negociacoes: number;
  };
  metricas?: {
    leadsRecebidos: number;
    vendasRealizadas: number;
    taxaConversao: number;
  };
}

const nivelColors: Record<string, string> = {
  JUNIOR: 'bg-blue-500',
  PLENO: 'bg-purple-500',
  SENIOR: 'bg-amber-500',
};

export function Vendedores() {
  const { user: currentUser } = useAuth();
  const { data: vendedores, loading } = useApi<VendedorWithMetrics[]>('/api/users?role=VENDEDOR');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVendedores = vendedores?.filter((v) =>
    v.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Vendedores</h1>
          <p className="text-neutral-500">Gerencie a equipe de vendas</p>
        </div>
        {currentUser?.role === 'ADMIN' && (
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Novo Vendedor
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Buscar por nome ou email..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredVendedores?.map((vendedor) => (
          <Card key={vendedor.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-neutral-200 flex items-center justify-center">
                    {vendedor.foto_url ? (
                      <img
                        src={vendedor.foto_url}
                        alt={vendedor.nome}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-medium">{vendedor.nome.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold">{vendedor.nome}</h3>
                    <p className="text-sm text-neutral-500">{vendedor.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${nivelColors[vendedor.nivel || 'JUNIOR']} text-white text-xs`}>
                        {vendedor.nivel}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {vendedor.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Ver perfil</DropdownMenuItem>
                    <DropdownMenuItem>Ver performance</DropdownMenuItem>
                    {currentUser?.role === 'ADMIN' && (
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-100">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">Leads</span>
                  </div>
                  <p className="font-bold">{vendedor._count?.leads_atribuidos || 0}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-400 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">Conversão</span>
                  </div>
                  <p className="font-bold">{vendedor.metricas?.taxaConversao || 0}%</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-400 mb-1">
                    <Star className="w-4 h-4" />
                    <span className="text-xs">Meta</span>
                  </div>
                  <p className="font-bold">{formatCurrency(vendedor.meta_mensal_valor)}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-500">Carga de trabalho</span>
                  <span className="font-medium">
                    {vendedor._count?.leads_atribuidos || 0} / {vendedor.capacidade_max_leads}
                  </span>
                </div>
                <Progress
                  value={((vendedor._count?.leads_atribuidos || 0) / vendedor.capacidade_max_leads) * 100}
                  className="h-2"
                />
              </div>

              {vendedor.especialidades.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  {vendedor.especialidades.map((esp) => (
                    <Badge key={esp} variant="secondary" className="text-xs">
                      {esp}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
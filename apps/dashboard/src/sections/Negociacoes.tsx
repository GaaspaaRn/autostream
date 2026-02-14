import { useState } from 'react';
import { Search, Plus, MoreHorizontal, ArrowRightLeft, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApi } from '../hooks/useApi';
import type { Negociacao } from '../types';

const statusColors: Record<string, string> = {
  PROSPECCAO: 'bg-neutral-500',
  PROPOSTA_PREPARACAO: 'bg-purple-500',
  PROPOSTA_ENVIADA: 'bg-amber-500',
  EM_NEGOCIACAO: 'bg-pink-500',
  FECHAMENTO_PENDENTE: 'bg-orange-500',
  GANHO: 'bg-green-500',
  PERDIDO: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  PROSPECCAO: 'Prospecção',
  PROPOSTA_PREPARACAO: 'Proposta em Preparação',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  EM_NEGOCIACAO: 'Em Negociação',
  FECHAMENTO_PENDENTE: 'Fechamento Pendente',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

export function Negociacoes() {
  const { data: negociacoes, loading } = useApi<Negociacao[]>('/api/negociacoes');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNegociacoes = negociacoes?.filter((n) =>
    n.lead.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.veiculo.modelo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price?: number) => {
    if (!price) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Negociações</h1>
          <p className="text-neutral-500">Acompanhe as negociações em andamento</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nova Negociação
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Buscar por cliente ou veículo..."
              className="pl-10"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {filteredNegociacoes?.map((neg) => (
          <Card key={neg.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  {neg.veiculo.fotos?.[0]?.url ? (
                    <img
                      src={neg.veiculo.fotos[0].url}
                      alt={neg.veiculo.modelo}
                      className="w-full h-full rounded-lg object-cover"
                    />
                  ) : (
                    <span className="text-neutral-400">{neg.lead.nome.charAt(0)}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{neg.lead.nome}</h3>
                  <p className="text-sm text-neutral-500">
                    {neg.veiculo.marca} {neg.veiculo.modelo} • {neg.veiculo.ano_modelo}
                  </p>
                  <p className="text-sm text-neutral-400">
                    Proposta: {formatPrice(neg.valor_proposta)}
                  </p>
                </div>

                <div className="hidden sm:block text-right">
                  <Badge className={`${statusColors[neg.status]} text-white`}>
                    {statusLabels[neg.status]}
                  </Badge>
                  <p className="text-sm text-neutral-500 mt-1">
                    {neg.vendedor.nome}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Mover status
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                      Marcar como Ganho
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <XCircle className="w-4 h-4 mr-2 text-red-600" />
                      Marcar como Perdido
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
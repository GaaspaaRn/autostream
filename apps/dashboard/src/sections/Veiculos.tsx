import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
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
import type { Veiculo } from '../types';

const statusColors: Record<string, string> = {
  DISPONIVEL: 'bg-green-500',
  RESERVADO: 'bg-amber-500',
  VENDIDO: 'bg-blue-500',
  MANUTENCAO: 'bg-red-500',
};

export function Veiculos() {
  const { data: veiculos, loading } = useApi<Veiculo[]>('/api/veiculos');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVeiculos = veiculos?.filter((v) =>
    v.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.modelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.codigo_interno.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => {
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
          <h1 className="text-2xl font-bold text-neutral-900">Veículos</h1>
          <p className="text-neutral-500">Gerencie o estoque de veículos</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Novo Veículo
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Buscar por marca, modelo ou código..."
              className="pl-10"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVeiculos?.map((veiculo) => (
          <Card key={veiculo.id} className="overflow-hidden">
            <div className="aspect-video relative">
              <img
                src={veiculo.fotos?.[0]?.url || 'https://via.placeholder.com/400x225?text=Sem+Imagem'}
                alt={`${veiculo.marca} ${veiculo.modelo}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge className={`${statusColors[veiculo.status]} text-white`}>
                  {veiculo.status}
                </Badge>
                {veiculo.destaque && (
                  <Badge className="bg-amber-500 text-white">Destaque</Badge>
                )}
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{veiculo.marca} {veiculo.modelo}</h3>
                  <p className="text-sm text-neutral-500">{veiculo.versao}</p>
                  <p className="text-sm text-neutral-400">
                    {veiculo.ano_modelo} • {veiculo.quilometragem.toLocaleString('pt-BR')} km
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
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-xl font-bold text-amber-600">
                  {formatPrice(veiculo.preco_venda)}
                </p>
                <p className="text-xs text-neutral-400">
                  Código: {veiculo.codigo_interno}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
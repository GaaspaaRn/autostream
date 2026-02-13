import { useState } from 'react';
import { Search, Filter, UserPlus, MoreHorizontal, Phone, Mail, AlertCircle } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApi, apiRequest, useAuth } from '../hooks/useApi';
import type { Lead, VendedorScore } from '../types';

const statusColors: Record<string, string> = {
  NOVO: 'bg-blue-500',
  EM_ATENDIMENTO: 'bg-purple-500',
  PROPOSTA_ENVIADA: 'bg-amber-500',
  NEGOCIANDO: 'bg-pink-500',
  CONVERTIDO: 'bg-green-500',
  PERDIDO: 'bg-red-500',
  ARQUIVADO: 'bg-neutral-500',
};

const tipoNegociacaoLabels: Record<string, string> = {
  AVISTA: 'À Vista',
  PARCELADO: 'Parcelado',
  ENTRADA_PARCELAS: 'Entrada + Parcelas',
};

export function Leads() {
  const { token, user } = useAuth();
  const { data: leads, loading, refetch } = useApi<Lead[]>('/api/leads');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showRecomendacoes, setShowRecomendacoes] = useState(false);
  const [recomendacoes, setRecomendacoes] = useState<VendedorScore[]>([]);

  const handleAtribuir = async (leadId: string, vendedorId: string) => {
    try {
      await apiRequest(`/api/leads/${leadId}/atribuir`, {
        method: 'POST',
        body: JSON.stringify({ vendedor_id: vendedorId }),
      }, token!);
      refetch();
      setShowRecomendacoes(false);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const verRecomendacoes = async (lead: Lead) => {
    setSelectedLead(lead);
    try {
      const data = await apiRequest<VendedorScore[]>(`/api/leads/${lead.id}/recomendacoes`, {}, token!);
      setRecomendacoes(data);
      setShowRecomendacoes(true);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredLeads = leads?.filter((lead) =>
    lead.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.whatsapp.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Leads</h1>
          <p className="text-neutral-500">Gerencie os leads do sistema</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white">
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {filteredLeads?.map((lead) => (
          <Card key={lead.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  {lead.veiculo.fotos?.[0]?.url ? (
                    <img
                      src={lead.veiculo.fotos[0].url}
                      alt={lead.veiculo.modelo}
                      className="w-full h-full rounded-lg object-cover"
                    />
                  ) : (
                    <span className="text-neutral-400 text-lg">{lead.nome.charAt(0)}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{lead.nome}</h3>
                    {lead.urgente && (
                      <Badge className="bg-red-500 text-white text-xs">Novo</Badge>
                    )}
                    {lead.slaVencendo && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm text-neutral-500">
                    {lead.veiculo.marca} {lead.veiculo.modelo} • {lead.veiculo.ano_modelo}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-sm text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {lead.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {lead.whatsapp}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block text-right">
                  <Badge className={`${statusColors[lead.status]} text-white`}>
                    {lead.status.replace('_', ' ')}
                  </Badge>
                  <p className="text-sm text-neutral-500 mt-1">
                    {tipoNegociacaoLabels[lead.tipo_negociacao]}
                  </p>
                </div>

                <div className="hidden md:block text-right min-w-[120px]">
                  {lead.vendedor ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                        {lead.vendedor.foto_url ? (
                          <img
                            src={lead.vendedor.foto_url}
                            alt={lead.vendedor.nome}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xs">{lead.vendedor.nome.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-sm">{lead.vendedor.nome}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-red-500">Não atribuído</span>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                    {!lead.vendedor && user?.role !== 'VENDEDOR' && (
                      <DropdownMenuItem onClick={() => verRecomendacoes(lead)}>
                        Atribuir vendedor
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>Arquivar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de recomendações */}
      <Dialog open={showRecomendacoes} onOpenChange={setShowRecomendacoes}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sugestão de Atribuição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-neutral-500">
              Lead: <strong>{selectedLead?.nome}</strong> - {selectedLead?.veiculo.marca} {selectedLead?.veiculo.modelo}
            </p>
            {recomendacoes.map((rec, index) => (
              <div key={rec.vendedor.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{rec.vendedor.nome}</p>
                      <p className="text-sm text-neutral-500">{rec.vendedor.nivel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600">{rec.score}%</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {rec.motivos.map((motivo, i) => (
                    <p key={i} className="text-sm text-neutral-600">{motivo}</p>
                  ))}
                </div>
                <Button
                  className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => handleAtribuir(selectedLead!.id, rec.vendedor.id)}
                >
                  Atribuir a este vendedor
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
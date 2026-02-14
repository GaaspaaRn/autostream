import { useEffect, useState } from 'react';
import {
  Users,
  Car,
  TrendingUp,
  DollarSign,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, useApi, apiRequest } from '../hooks/useApi';
import type { DashboardMetrics, Lead, Negociacao } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  // PieChart,
  // Pie,
  // Cell,
  LineChart,
  Line,
} from 'recharts';

export function DashboardHome() {
  const { token, user } = useAuth();
  const { data: metrics, loading: loadingMetrics } = useApi<DashboardMetrics>('/api/dashboard/metricas');
  const [funil, setFunil] = useState<any[]>([]);
  const [leadsPorDia, setLeadsPorDia] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [leadsAtencao, setLeadsAtencao] = useState<{ leadsNaoAtribuidos: Lead[]; leadsSemContato: Lead[]; negociacoesParadas: Negociacao[] } | null>(null);

  useEffect(() => {
    if (token) {
      apiRequest<any[]>('/api/dashboard/funil', {}, token).then(setFunil);
      apiRequest<any[]>('/api/dashboard/leads-por-dia', {}, token).then(setLeadsPorDia);
      if (user?.role !== 'VENDEDOR') {
        apiRequest<any[]>('/api/dashboard/vendedores', {}, token).then(setRanking);
      }
      apiRequest<any>('/api/dashboard/leads-atencao', {}, token).then(setLeadsAtencao);
    }
  }, [token, user]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, trend, trendUp }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-neutral-500">{title}</p>
            <h3 className="text-2xl font-bold mt-1">{value}</h3>
            {subtitle && <p className="text-xs text-neutral-400 mt-1">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-amber-600" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-4 text-sm ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{Math.abs(trend).toFixed(1)}%</span>
            <span className="text-neutral-400">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loadingMetrics || !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-500">Visão geral do desempenho da revenda</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Leads Hoje"
          value={metrics.leads.hoje}
          subtitle={`Ontem: ${metrics.leads.ontem}`}
          icon={Users}
          trend={metrics.leads.variacaoDia}
          trendUp={metrics.leads.variacaoDia >= 0}
        />
        <MetricCard
          title="Leads do Mês"
          value={metrics.leads.mes}
          subtitle={`Meta: ${metrics.leads.meta}`}
          icon={Users}
          trend={metrics.leads.variacaoMes}
          trendUp={metrics.leads.variacaoMes >= 0}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${metrics.conversao.taxa.toFixed(1)}%`}
          subtitle={`${metrics.conversao.convertidosMes} de ${metrics.conversao.totalLeadsMes} leads`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Faturamento do Mês"
          value={formatCurrency(metrics.faturamento.mes)}
          subtitle={`${metrics.veiculos.vendidosMes} veículos vendidos`}
          icon={DollarSign}
        />
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-neutral-500">Progresso da Meta (Leads)</p>
                <p className="text-2xl font-bold">{metrics.leads.progressoMeta.toFixed(1)}%</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <Progress value={metrics.leads.progressoMeta} className="h-2" />
            <p className="text-xs text-neutral-400 mt-2">
              {metrics.leads.mes} de {metrics.leads.meta} leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-neutral-500">Veículos em Estoque</p>
                <p className="text-2xl font-bold">{metrics.veiculos.estoque}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Car className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <Progress value={(metrics.veiculos.vendidosMes / metrics.veiculos.estoque) * 100} className="h-2" />
            <p className="text-xs text-neutral-400 mt-2">
              {metrics.veiculos.vendidosMes} vendidos este mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads por dia */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Dia (Últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={leadsPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="data" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="quantidade"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Funil de vendas */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funil} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis type="number" stroke="#666" fontSize={12} />
                  <YAxis dataKey="etapa" type="category" stroke="#666" fontSize={12} width={120} />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Vendedores */}
      {user?.role !== 'VENDEDOR' && ranking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ranking de Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ranking.slice(0, 5).map((vendedor, index) => (
                <div key={vendedor.id} className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center">
                    {vendedor.foto_url ? (
                      <img src={vendedor.foto_url} alt={vendedor.nome} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span>{vendedor.nome.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{vendedor.nome}</p>
                    <p className="text-sm text-neutral-500">
                      {vendedor.metricas.vendasRealizadas} vendas • {vendedor.metricas.taxaConversao}% conversão
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">
                      {formatCurrency(vendedor.metricas.valorTotal)}
                    </p>
                    <Progress value={vendedor.metricas.progressoMeta} className="w-24 h-1 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leads que requerem atenção */}
      {leadsAtencao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Leads que Requerem Atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Não atribuídos */}
              <div>
                <h4 className="text-sm font-medium text-neutral-500 mb-3">
                  Não Atribuídos ({leadsAtencao.leadsNaoAtribuidos.length})
                </h4>
                <div className="space-y-2">
                  {leadsAtencao.leadsNaoAtribuidos.slice(0, 3).map((lead) => (
                    <div key={lead.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <p className="font-medium text-sm">{lead.nome}</p>
                      <p className="text-xs text-neutral-500">
                        {lead.veiculo.marca} {lead.veiculo.modelo}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <Clock className="w-3 h-3" />
                        <span>Novo há menos de 2h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sem contato */}
              <div>
                <h4 className="text-sm font-medium text-neutral-500 mb-3">
                  Sem Contato 24h ({leadsAtencao.leadsSemContato.length})
                </h4>
                <div className="space-y-2">
                  {leadsAtencao.leadsSemContato.slice(0, 3).map((lead) => (
                    <div key={lead.id} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="font-medium text-sm">{lead.nome}</p>
                      <p className="text-xs text-neutral-500">
                        {lead.veiculo.marca} {lead.veiculo.modelo}
                      </p>
                      {lead.vendedor && (
                        <p className="text-xs text-neutral-400 mt-1">
                          Atribuído a: {lead.vendedor.nome}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Negociações paradas */}
              <div>
                <h4 className="text-sm font-medium text-neutral-500 mb-3">
                  Negociações Paradas ({leadsAtencao.negociacoesParadas.length})
                </h4>
                <div className="space-y-2">
                  {leadsAtencao.negociacoesParadas.slice(0, 3).map((neg) => (
                    <div key={neg.id} className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                      <p className="font-medium text-sm">{neg.lead.nome}</p>
                      <p className="text-xs text-neutral-500">
                        {neg.veiculo.marca} {neg.veiculo.modelo}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Vendedor: {neg.vendedor.nome}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
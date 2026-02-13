import { useState, useEffect } from 'react';
import { Save, Store, Bell, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { apiRequest, useAuth } from '../hooks/useApi';
import { toast } from 'sonner';

interface Configuracao {
  chave: string;
  valor: string;
  descricao?: string;
}

export function Configuracoes() {
  const { token } = useAuth();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) {
      apiRequest<Configuracao[]>('/api/configuracoes', {}, token)
        .then((data) => {
          const configMap: Record<string, string> = {};
          data.forEach((c) => {
            configMap[c.chave] = c.valor;
          });
          setConfigs(configMap);
          setLoading(false);
        });
    }
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const configuracoes = Object.entries(configs).map(([chave, valor]) => ({
        chave,
        valor,
      }));

      await apiRequest('/api/configuracoes/bulk', {
        method: 'POST',
        body: JSON.stringify({ configuracoes }),
      }, token!);

      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (chave: string, valor: string) => {
    setConfigs((prev) => ({ ...prev, [chave]: valor }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-900">Configurações</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-neutral-200 rounded" />
          <div className="h-64 bg-neutral-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Configurações</h1>
          <p className="text-neutral-500">Configure as preferências do sistema</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">
            <Store className="w-4 h-4 mr-2" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="notificacoes">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="sistema">
            <Shield className="w-4 h-4 mr-2" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nome_revenda">Nome da Revenda</Label>
                <Input
                  id="nome_revenda"
                  value={configs.nome_revenda || ''}
                  onChange={(e) => updateConfig('nome_revenda', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telefone_revenda">Telefone</Label>
                  <Input
                    id="telefone_revenda"
                    value={configs.telefone_revenda || ''}
                    onChange={(e) => updateConfig('telefone_revenda', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp_revenda">WhatsApp</Label>
                  <Input
                    id="whatsapp_revenda"
                    value={configs.whatsapp_revenda || ''}
                    onChange={(e) => updateConfig('whatsapp_revenda', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email_revenda">E-mail</Label>
                <Input
                  id="email_revenda"
                  type="email"
                  value={configs.email_revenda || ''}
                  onChange={(e) => updateConfig('email_revenda', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endereco_revenda">Endereço</Label>
                <Input
                  id="endereco_revenda"
                  value={configs.endereco_revenda || ''}
                  onChange={(e) => updateConfig('endereco_revenda', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Atribuição Automática</Label>
                  <p className="text-sm text-neutral-500">
                    Atribuir leads automaticamente quando score {'>'} 80%
                  </p>
                </div>
                <Switch
                  checked={configs.atribuicao_automatica === 'true'}
                  onCheckedChange={(checked) => updateConfig('atribuicao_automatica', checked.toString())}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificação por E-mail</Label>
                  <p className="text-sm text-neutral-500">
                    Enviar email para vendedor quando receber lead
                  </p>
                </div>
                <Switch
                  checked={configs.notificacao_email_lead === 'true'}
                  onCheckedChange={(checked) => updateConfig('notificacao_email_lead', checked.toString())}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sistema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sla_novo_lead_horas">SLA para Novos Leads (horas)</Label>
                <Input
                  id="sla_novo_lead_horas"
                  type="number"
                  value={configs.sla_novo_lead_horas || '4'}
                  onChange={(e) => updateConfig('sla_novo_lead_horas', e.target.value)}
                />
                <p className="text-sm text-neutral-500 mt-1">
                  Tempo máximo para atendimento de leads novos
                </p>
              </div>
              <div>
                <Label htmlFor="meta_leads_mes">Meta de Leads (mês)</Label>
                <Input
                  id="meta_leads_mes"
                  type="number"
                  value={configs.meta_leads_mes || '200'}
                  onChange={(e) => updateConfig('meta_leads_mes', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="notificacao_gerente_lead_nao_atribuido">
                  Notificar Gerente (horas)
                </Label>
                <Input
                  id="notificacao_gerente_lead_nao_atribuido"
                  type="number"
                  value={configs.notificacao_gerente_lead_nao_atribuido || '2'}
                  onChange={(e) => updateConfig('notificacao_gerente_lead_nao_atribuido', e.target.value)}
                />
                <p className="text-sm text-neutral-500 mt-1">
                  Notificar gerente após X horas se lead não for atribuído
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
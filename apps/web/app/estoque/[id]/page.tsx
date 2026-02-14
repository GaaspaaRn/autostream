import { fetchAPI } from "@/lib/api";
import { LeadForm } from "@/components/LeadForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Gauge, Fuel, Cog, ArrowLeft, Check, LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: "Detalhes do Veículo | AutoStream",
};

async function getVeiculo(id: string) {
    try {
        const data = await fetchAPI(`/veiculos/${id}`, { cache: 'no-store' });
        return data;
    } catch (error) {
        return null;
    }
}

function SpecItem({ icon: Icon, label, value }: { icon: LucideIcon, label: string, value: string | number }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="font-semibold text-white">{value}</p>
            </div>
        </div>
    );
}

export default async function VeiculoDetailsPage({ params }: { params: { id: string } }) {
    const veiculo = await getVeiculo(params.id);

    if (!veiculo) {
        notFound();
    }

    const fotoPrincipal = veiculo.fotos?.[0]?.url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=2000';

    return (
        <div className="container px-4 md:px-6 py-10">
            <div className="mb-6">
                <Button variant="ghost" asChild className="pl-0 hover:bg-transparent hover:text-primary">
                    <Link href="/estoque" className="flex items-center gap-2 text-gray-400">
                        <ArrowLeft className="h-4 w-4" /> Voltar para o estoque
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Images & Info */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Main Image */}
                    <div className="aspect-video relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
                        <img
                            src={fotoPrincipal}
                            alt={`${veiculo.marca} ${veiculo.modelo}`}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 left-4">
                            {veiculo.destaque && <Badge className="bg-amber-500 hover:bg-amber-600 text-black font-bold">Destaque</Badge>}
                        </div>
                    </div>

                    {/* Quick Specs Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <SpecItem icon={Calendar} label="Ano" value={veiculo.ano_modelo} />
                        <SpecItem icon={Gauge} label="KM" value={`${veiculo.quilometragem.toLocaleString()} km`} />
                        <SpecItem icon={Fuel} label="Combustível" value={veiculo.combustivel} />
                        <SpecItem icon={Cog} label="Câmbio" value={veiculo.transmissao} />
                    </div>

                    {/* Description & Features */}
                    <div className="glass-panel p-6 rounded-2xl space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">Sobre o Veículo</h2>
                            <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                                {veiculo.descricao || "Sem descrição disponível."}
                            </p>
                        </div>

                        <Separator className="bg-white/10" />

                        <div>
                            <h3 className="text-xl font-bold text-white mb-4">Opcionais e Itens de Série</h3>
                            {veiculo.opcionais ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Assuming opcionais is a string (JSON/CSV) or array. Need to parse if string. */}
                                    {/* Based on schema it is String (JSON or CSV). I'll try to split if CSV or parse if JSON. */}
                                    {/* For safety, rendering as string split by comma for now if simple CSV. */}
                                    {(typeof veiculo.opcionais === 'string' ? veiculo.opcionais.replace(/[\[\]"]/g, '').split(',') : []).map((item: string, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2 text-gray-300">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span>{item.trim()}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">Nenhum opcional listado.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Pricing & Lead Form */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-2xl border border-primary/20 bg-primary/5">
                        <p className="text-gray-400 text-sm mb-1">Preço à vista</p>
                        <h1 className="text-4xl font-bold text-white mb-2">
                            R$ {veiculo.preco_venda.toLocaleString('pt-BR')}
                        </h1>
                        <p className="text-sm text-gray-400">
                            *Consulte condições de financiamento.
                        </p>
                    </div>

                    <div className="sticky top-24">
                        <LeadForm veiculoId={veiculo.id} />
                    </div>
                </div>
            </div>
        </div>
    );
}

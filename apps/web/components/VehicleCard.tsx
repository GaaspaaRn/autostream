import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Gauge, Fuel, ArrowRight } from "lucide-react";

interface Vehicle {
    id: string;
    marca: string;
    modelo: string;
    versao: string;
    ano_modelo: number;
    preco_venda: number;
    quilometragem: number;
    combustivel: string;
    transmissao: string;
    fotos: { url: string }[];
    categoria: string;
}

export function VehicleCard({ veiculo }: { veiculo: Vehicle }) {
    const fotoPrincipal = veiculo.fotos?.[0]?.url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';

    return (
        <Card className="overflow-hidden border-white/10 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 group flex flex-col h-full">
            <div className="relative aspect-[16/10] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                <img
                    src={fotoPrincipal}
                    alt={`${veiculo.marca} ${veiculo.modelo}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <Badge className="absolute top-3 right-3 z-20 bg-primary/90 text-white border-none">
                    {veiculo.ano_modelo}
                </Badge>
                <div className="absolute bottom-3 left-3 z-20">
                    <p className="text-white font-bold text-lg drop-shadow-md">
                        R$ {veiculo.preco_venda.toLocaleString('pt-BR')}
                    </p>
                </div>
            </div>

            <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">
                            {veiculo.marca} {veiculo.modelo}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-1">{veiculo.versao}</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 py-2 flex-grow">
                <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>{veiculo.ano_modelo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary" />
                        <span>{veiculo.quilometragem.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Fuel className="h-4 w-4 text-primary" />
                        <span>{veiculo.combustivel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-4 w-4 flex items-center justify-center text-xs font-bold ring-1 ring-primary rounded text-primary px-1">T</span>
                        <span>{veiculo.transmissao}</span>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="p-4 pt-2">
                <Button asChild className="w-full bg-white/5 hover:bg-primary hover:text-white transition-colors border border-white/10">
                    <Link href={`/estoque/${veiculo.id}`}>
                        Ver Detalhes <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

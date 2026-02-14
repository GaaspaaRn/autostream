import { fetchAPI } from "@/lib/api";
import { VehicleCard } from "@/components/VehicleCard";
import { CatalogFilters } from "@/components/Filters";
import { Suspense } from "react";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: "Estoque | AutoStream",
    description: "Confira nosso estoque de veículos premium.",
};

async function getVeiculos(searchParams: any) {
    const params = new URLSearchParams();
    if (searchParams.search) params.set("search", searchParams.search);
    if (searchParams.marca) params.set("marca", searchParams.marca);
    if (searchParams.categoria) params.set("categoria", searchParams.categoria);
    if (searchParams.preco_min) params.set("preco_min", searchParams.preco_min);
    if (searchParams.preco_max) params.set("preco_max", searchParams.preco_max);
    params.set("status", "DISPONIVEL");

    try {
        const data = await fetchAPI(`/veiculos?${params.toString()}`, { cache: 'no-store' });
        return data;
    } catch (error) {
        console.error("Failed to fetch vehicles:", error);
        return [];
    }
}

export default async function EstoquePage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const veiculos = await getVeiculos(searchParams);

    return (
        <div className="container px-4 md:px-6 py-10 space-y-8">
            <div className="flex flex-col gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-white">Nosso Estoque</h1>
                <p className="text-gray-400">Encontre o veículo premium que combina com você.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Filters (Desktop) - Logic inside filters component */}
                {/* Filters logic is handled via URL params, UI is top bar or sidebar. 
            CatalogFilters currently implements a Top Bar style. Place it above grid. */}
            </div>

            <CatalogFilters />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {veiculos.map((veiculo: any) => (
                    <VehicleCard key={veiculo.id} veiculo={veiculo} />
                ))}
                {veiculos.length === 0 && (
                    <div className="col-span-full text-center py-20 text-gray-500">
                        Nenhum veículo encontrado com os filtros selecionados.
                    </div>
                )}
            </div>
        </div>
    );
}

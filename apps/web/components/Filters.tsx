"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function CatalogFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [marca, setMarca] = useState(searchParams.get("marca") || "");
    const [categoria, setCategoria] = useState(searchParams.get("categoria") || "");
    const [precoMin, setPrecoMin] = useState(searchParams.get("preco_min") || "");
    const [precoMax, setPrecoMax] = useState(searchParams.get("preco_max") || "");

    const handleSearch = () => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (marca && marca !== "all") params.set("marca", marca);
        if (categoria && categoria !== "all") params.set("categoria", categoria);
        if (precoMin) params.set("preco_min", precoMin);
        if (precoMax) params.set("preco_max", precoMax);

        router.push(`/estoque?${params.toString()}`);
    };

    const clearFilters = () => {
        setSearch("");
        setMarca("");
        setCategoria("");
        setPrecoMin("");
        setPrecoMax("");
        router.push("/estoque");
    };

    return (
        <div className="w-full space-y-4">
            {/* Desktop Bar */}
            <div className="hidden lg:flex flex-wrap items-end gap-4 p-4 glass-panel rounded-xl">
                <div className="space-y-2 flex-grow min-w-[200px]">
                    <Label>Busca</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Marca, modelo..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-background/50 border-white/10"
                        />
                    </div>
                </div>

                <div className="space-y-2 min-w-[150px]">
                    <Label>Marca</Label>
                    <Select value={marca} onValueChange={setMarca}>
                        <SelectTrigger className="bg-background/50 border-white/10">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="BMW">BMW</SelectItem>
                            <SelectItem value="Mercedes-Benz">Mercedes-Benz</SelectItem>
                            <SelectItem value="Audi">Audi</SelectItem>
                            <SelectItem value="Porsche">Porsche</SelectItem>
                            <SelectItem value="Land Rover">Land Rover</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2 min-w-[150px]">
                    <Label>Categoria</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                        <SelectTrigger className="bg-background/50 border-white/10">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="SUV">SUV</SelectItem>
                            <SelectItem value="SEDAN">Sedan</SelectItem>
                            <SelectItem value="COUPE">Coupe</SelectItem>
                            <SelectItem value="ESPORTIVO">Esportivo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex gap-2">
                    <Button onClick={handleSearch} className="bg-primary hover:bg-primary/90">
                        Filtrar
                    </Button>
                    {(search || marca || categoria || precoMin || precoMax) && (
                        <Button variant="ghost" onClick={clearFilters} size="icon">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Mobile Filter Button */}
            <div className="lg:hidden flex gap-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar veículos..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-background/50 border-white/10"
                    />
                </div>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="border-white/10">
                            <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="bg-background border-l border-white/10">
                        <SheetHeader>
                            <SheetTitle>Filtros</SheetTitle>
                        </SheetHeader>
                        <div className="space-y-6 mt-6">
                            <div className="space-y-2">
                                <Label>Marca</Label>
                                <Select value={marca} onValueChange={setMarca}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        <SelectItem value="BMW">BMW</SelectItem>
                                        <SelectItem value="Mercedes-Benz">Mercedes-Benz</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Add more filters here for mobile */}
                            <Button onClick={() => { handleSearch(); }} className="w-full">
                                Aplicar Filtros
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
                <Button onClick={handleSearch} size="icon" className="bg-primary">
                    <Search className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

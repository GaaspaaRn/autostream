"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, X, Car, Phone } from "lucide-react";
import { useState } from "react";

const navigation = [
    { name: "Início", href: "/" },
    { name: "Estoque", href: "/estoque" },
    { name: "Sobre Nós", href: "/sobre" },
    { name: "Contato", href: "/contato" },
];

export function Navbar() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <header className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
            <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
                <div className="flex lg:flex-1">
                    <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Car className="h-6 w-6 text-primary" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white">
                            Auto<span className="text-primary">Stream</span>
                        </span>
                    </Link>
                </div>
                <div className="flex lg:hidden">
                    <button
                        type="button"
                        className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-400 hover:text-white"
                        onClick={() => setMobileMenuOpen(true)}
                    >
                        <span className="sr-only">Abrir menu</span>
                        <Menu className="h-6 w-6" aria-hidden="true" />
                    </button>
                </div>
                <div className="hidden lg:flex lg:gap-x-12">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "text-sm font-semibold leading-6 transition-colors hover:text-primary",
                                pathname === item.href ? "text-primary" : "text-gray-300"
                            )}
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>
                <div className="hidden lg:flex lg:flex-1 lg:justify-end gap-4">
                    <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary">
                        <Phone className="mr-2 h-4 w-4" />
                        Fale Conosco
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/20">
                        Ver Ofertas
                    </Button>
                </div>
            </nav>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 z-50" />
                    <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-background px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-white/10 backdrop-blur-xl">
                        <div className="flex items-center justify-between">
                            <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <Car className="h-6 w-6 text-primary" />
                                </div>
                                <span className="font-bold text-xl text-white">AutoStream</span>
                            </Link>
                            <button
                                type="button"
                                className="-m-2.5 rounded-md p-2.5 text-gray-400 hover:text-white"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <span className="sr-only">Fechar menu</span>
                                <X className="h-6 w-6" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="mt-6 flow-root">
                            <div className="-my-6 divide-y divide-gray-500/10">
                                <div className="space-y-2 py-6">
                                    {navigation.map((item) => (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-white hover:bg-white/5"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            {item.name}
                                        </Link>
                                    ))}
                                </div>
                                <div className="py-6 flex flex-col gap-4">
                                    <Button className="w-full bg-primary hover:bg-primary/90">
                                        Ver Ofertas
                                    </Button>
                                    <Button variant="outline" className="w-full border-primary/50 text-primary">
                                        <Phone className="mr-2 h-4 w-4" />
                                        Fale Conosco
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

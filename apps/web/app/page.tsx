import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Star, Shield, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-10" />
        <div className="hero-glow" />

        {/* Background Image/Video Placeholder */}
        <div className="absolute inset-0 z-0">
          {/* In a real app, use a video or high-res image here */}
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2560&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
        </div>

        <div className="container relative z-20 px-4 md:px-6 text-center">
          <div className="inline-block rounded-full bg-secondary/50 backdrop-blur-sm px-3 py-1 text-sm leading-6 text-primary ring-1 ring-white/10 mb-6 animate-fade-in-up">
            A revolução na compra de veículos
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
            Seu Próximo Carro <br className="hidden md:block" />
            <span className="text-primary">Está Esperando Por Você</span>
          </h1>
          <p className="mx-auto max-w-[700px] text-gray-400 text-lg md:text-xl mb-10">
            Uma experiência de compra premium, transparente e digital.
            Encontre o veículo perfeito com nossa tecnologia de matching intelligente.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-2xl mx-auto glass-panel p-2 rounded-2xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <Input
                className="w-full pl-10 bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-gray-500 h-12"
                placeholder="Busque por marca, modelo..."
              />
            </div>
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
              Buscar Agora
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-primary/50 transition-colors group">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Veículos Premium</h3>
              <p className="text-gray-400">Seleção rigorosa de veículos com procedência garantida e laudo cautelar aprovado.</p>
            </div>
            <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-primary/50 transition-colors group">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Garantia Estendida</h3>
              <p className="text-gray-400">Todos os nossos veículos contam com garantia de até 1 ano para sua tranquilidade.</p>
            </div>
            <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-primary/50 transition-colors group">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Financiamento Digital</h3>
              <p className="text-gray-400">Aprovação de crédito em minutos, sem burocracia e com as melhores taxas do mercado.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
        <div className="container px-4 md:px-6 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Pronto para acelerar?</h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Visite nosso showroom ou agende um test-drive online. Seu novo carro está a um clique de distância.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="outline" className="h-14 px-8 border-white/20 text-white hover:bg-white/10">
              Ver Estoque Completo
            </Button>
            <Button size="lg" className="h-14 px-8 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20">
              Falar com Consultor <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

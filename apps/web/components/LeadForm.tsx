"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner"; // Shadcn sonner
import { fetchAPI } from "@/lib/api";

const leadSchema = z.object({
    nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.string().email("Email inválido"),
    whatsapp: z.string().min(10, "WhatsApp deve ter pelo menos 10 dígitos"),
    mensagem: z.string().optional(),
    aceita_privacidade: z.boolean().refine((val) => val === true, {
        message: "Você deve aceitar a política de privacidade",
    }),
});

type LeadFormValues = z.infer<typeof leadSchema>;

export function LeadForm({ veiculoId }: { veiculoId: string }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Toast is not installed yet? Shadcn init doesn't install toast by default unless 'add toast'.
    // I will use console.log or alert if toast missing, but better to install toast.
    // For now simple alert.

    const { register, handleSubmit, formState: { errors }, setValue } = useForm<LeadFormValues>({
        resolver: zodResolver(leadSchema),
    });

    const onSubmit = async (data: LeadFormValues) => {
        setIsSubmitting(true);
        try {
            await fetchAPI("/leads", {
                method: "POST",
                body: JSON.stringify({
                    ...data,
                    veiculo_id: veiculoId,
                    tipo_negociacao: "AVISTA", // Default or add field
                }),
            });
            toast.success("Proposta enviada com sucesso! Entraremos em contato.");
            // Reset form?
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar proposta. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="glass-panel border-white/10">
            <CardHeader>
                <CardTitle className="text-xl text-white">Tenho Interesse</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="nome">Nome Completo</Label>
                        <Input id="nome" {...register("nome")} className="bg-background/50 border-white/10" placeholder="Seu nome" />
                        {errors.nome && <p className="text-red-500 text-xs">{errors.nome.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" {...register("email")} className="bg-background/50 border-white/10" placeholder="seu@email.com" />
                        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="whatsapp">WhatsApp</Label>
                        <Input id="whatsapp" {...register("whatsapp")} className="bg-background/50 border-white/10" placeholder="(11) 99999-9999" />
                        {errors.whatsapp && <p className="text-red-500 text-xs">{errors.whatsapp.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="mensagem">Mensagem (Opcional)</Label>
                        <Textarea id="mensagem" {...register("mensagem")} className="bg-background/50 border-white/10" placeholder="Olá, tenho interesse neste veículo..." />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox id="terms" onCheckedChange={(checked: boolean) => setValue("aceita_privacidade", checked === true)} />
                        <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Aceito a política de privacidade
                        </Label>
                    </div>
                    {errors.aceita_privacidade && <p className="text-red-500 text-xs">{errors.aceita_privacidade.message}</p>}

                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                        {isSubmitting ? "Enviando..." : "Enviar Proposta"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

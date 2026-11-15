import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Clock, MessageCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const SUPPORT_EMAIL = "zappratico_suport@gmail.com";

export const SUPPORT_HOURS: { day: string; hours: string }[] = [
  { day: "Segunda a quinta", hours: "19h às 21h" },
  { day: "Sexta", hours: "17h às 21h" },
  { day: "Sábado", hours: "15h às 20h" },
  { day: "Domingo", hours: "Fechado" },
];

export const Route = createFileRoute("/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte ZapPrático — atendimento e horários" },
      {
        name: "description",
        content:
          "Fale com o suporte do ZapPrático por e-mail. Veja os horários de atendimento de segunda a sábado e o tempo de resposta.",
      },
      { property: "og:title", content: "Suporte ZapPrático" },
      {
        property: "og:description",
        content: "Atendimento por e-mail com horários de segunda a sábado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <MessageCircle className="h-3.5 w-3.5" /> Suporte
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">Precisa de ajuda?</h1>
        <p className="text-muted-foreground mb-10">
          Nosso time atende por e-mail. Descreva o que aconteceu, o nome da sua loja e, se possível,
          envie uma captura de tela — assim resolvemos na primeira resposta.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display font-semibold mb-1">E-mail de suporte</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Respondemos dentro do horário de atendimento.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-sm font-medium text-primary break-all hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            <Button asChild className="w-full mt-4">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Suporte%20ZapPr%C3%A1tico`}>Enviar e-mail</a>
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display font-semibold mb-1">Horários de atendimento</h2>
            <p className="text-sm text-muted-foreground mb-4">Horário de Brasília.</p>
            <ul className="space-y-2 text-sm">
              {SUPPORT_HOURS.map((h) => (
                <li key={h.day} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{h.day}</span>
                  <span className="font-medium">{h.hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display font-semibold mb-3">Antes de escrever</h2>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Problemas de pagamento: confira se a chave PIX e o nome do recebedor estão salvos na aba Pagamentos do bot.</li>
            <li>Bot sem responder: verifique se ele está ativo em Meus bots.</li>
            <li>Cardápio: use o botão “Salvar tudo e gerar imagem” para atualizar a imagem enviada no WhatsApp.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

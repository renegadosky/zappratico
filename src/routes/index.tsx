import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useAuth } from "@/lib/auth-context";
import {
  Bot,
  Sparkles,
  Zap,
  ShoppingCart,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Check,
  Rocket,
  Shield,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://zappratico.com.br/" },
    ],
    links: [{ rel: "canonical", href: "https://zappratico.com.br/" }],
  }),
  component: Landing,
});

const SLOGANS = [
  { highlight: "vendem sozinhos", prefix: "Bots de WhatsApp que" },
  { highlight: "enquanto você dorme", prefix: "Atenda, venda e cobre" },
  { highlight: "em 5 minutos", prefix: "Monte seu vendedor 24/7" },
];

function Landing() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [sloganIndex, setSloganIndex] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: profile?.onboarding_completed ? "/dashboard" : "/onboarding" });
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    const id = setInterval(() => setSloganIndex((i) => (i + 1) % SLOGANS.length), 3800);
    return () => clearInterval(id);
  }, []);

  const slogan = SLOGANS[sloganIndex];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 bg-gradient-glow opacity-60 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <header className="relative z-10 border-b border-border/40 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
                Criar minha loja
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="container mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-border mb-8">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Assistente de Criação de bots inclusa
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight max-w-4xl mx-auto leading-[1.05] min-h-[2.2em]">
            <span className="block">{slogan.prefix}</span>
            <span key={sloganIndex} className="text-gradient inline-block animate-fade-in">
              {slogan.highlight}
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            A primeira plataforma brasileira que junta <strong className="text-foreground/90">Assistente de Criação</strong>,
            construtor visual e pagamento PIX — pronta para faturar no piloto automático.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow text-base h-12 px-8"
              >
                Criar meu primeiro bot
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {["Sem cartão de crédito", "6 templates prontos", "Configure em 5 min"].map(
              (item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ),
            )}
          </div>
        </section>

        {/* Features carousel */}
        <section className="container mx-auto px-6 pb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold">
              Tudo que você precisa pra vender
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Arraste para conhecer cada recurso.
            </p>
          </div>

          <Carousel opts={{ align: "start", loop: true }} className="max-w-6xl mx-auto">
            <CarouselContent className="-ml-4">
              {[
                {
                  icon: Bot,
                  title: "Construtor visual",
                  desc: "Arraste blocos, conecte fluxos e crie atendimentos completos sem código.",
                },
                {
                  icon: Sparkles,
                  title: "Assistente de Criação",
                  desc: "Descreva seu negócio e a IA monta o bot inteiro — fluxo, mensagens e upsell.",
                },
                {
                  icon: ShoppingCart,
                  title: "Vendas integradas",
                  desc: "Catálogo, PIX, recuperação de carrinho e gestão de pedidos automáticos.",
                },
                {
                  icon: MessageSquare,
                  title: "Múltiplos bots",
                  desc: "Bot de vendas, suporte, pós-venda e campanhas. Crie quantos quiser.",
                },
                {
                  icon: Zap,
                  title: "Roteamento inteligente",
                  desc: "Cliente quer humano? O bot transfere. Quer comprar? Continua o fluxo.",
                },
                {
                  icon: TrendingUp,
                  title: "Analytics em tempo real",
                  desc: "Veja conversão, vendas, abandono e os produtos que mais saem.",
                },
                {
                  icon: Rocket,
                  title: "Mini-loja pública",
                  desc: "Cada bot vira uma página de vendas com link próprio para divulgar.",
                },
                {
                  icon: Shield,
                  title: "Seguro e LGPD",
                  desc: "Dados criptografados, RLS no banco e conformidade com a LGPD.",
                },
              ].map((f) => (
                <CarouselItem
                  key={f.title}
                  className="pl-4 md:basis-1/2 lg:basis-1/3"
                >
                  <div className="group h-full p-7 rounded-2xl bg-gradient-surface border border-border hover:border-primary/50 transition-all hover:shadow-glow relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-5 shadow-glow">
                        <f.icon className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <h3 className="text-lg font-display font-semibold mb-2">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4" />
            <CarouselNext className="hidden md:flex -right-4" />
          </Carousel>
        </section>

        {/* CTA — premium */}
        <section className="container mx-auto px-6 pb-32">
          <div className="relative rounded-3xl overflow-hidden border border-primary/30 shadow-elegant">
            {/* Background layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/30 blur-[100px]" />
            <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-primary/20 blur-[100px]" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
                backgroundSize: "32px 32px",
              }}
            />

            <div className="relative grid md:grid-cols-2 gap-10 p-10 md:p-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 mb-5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">Setup em 5 minutos</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight">
                  Seu próximo cliente já está digitando.
                  <span className="text-gradient block mt-2">Não deixe ele esperando.</span>
                </h2>
                <p className="mt-5 text-muted-foreground text-lg">
                  Crie sua conta, conecte o WhatsApp e venda 24 horas por dia — sem
                  desenvolvedor, sem mensalidade obrigatória.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link to="/auth">
                    <Button
                      size="lg"
                      className="bg-gradient-primary text-primary-foreground shadow-glow h-12 px-8 w-full sm:w-auto"
                    >
                      Começar agora
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/plans">
                    <Button size="lg" variant="outline" className="h-12 px-8 w-full sm:w-auto">
                      Ver planos
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "24/7", label: "Atendimento" },
                  { value: "+3x", label: "Conversão média" },
                  { value: "5 min", label: "Pra configurar" },
                  { value: "0%", label: "De código" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl bg-background/60 backdrop-blur border border-border/60 p-6 text-center"
                  >
                    <div className="text-3xl md:text-4xl font-display font-bold text-gradient">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/40 bg-surface/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <Logo />
              <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
                Plataforma brasileira para criar bots de vendas no WhatsApp com IA, sem código.
                Feito para pequenos negócios que querem escalar atendimento.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/plans" className="hover:text-foreground transition-colors">Planos</Link></li>
                <li><Link to="/auth" className="hover:text-foreground transition-colors">Criar conta</Link></li>
                <li><Link to="/auth" className="hover:text-foreground transition-colors">Entrar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Ajuda e legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/suporte" className="hover:text-foreground transition-colors">Suporte</Link></li>
                <li><Link to="/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link></li>
                <li><Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link></li>
                <li><a href="mailto:zappratico_suport@gmail.com" className="hover:text-foreground transition-colors">zappratico_suport@gmail.com</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© 2026 ZapPrático. Todos os direitos reservados.</p>
            <p>CNPJ em formação · Brasil · Feito com 💚 para empreendedores</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Shirt, UtensilsCrossed, Sparkles, Cpu, Link as LinkIcon,
  Store, ArrowRight, Eye, MessageSquare,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/templates")({
  component: () => (
    <AppShell>
      <Templates />
    </AppShell>
  ),
});

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  segment: string;
  icon: string | null;
  flow: any;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  shirt: Shirt,
  utensils: UtensilsCrossed,
  sparkles: Sparkles,
  cpu: Cpu,
  link: LinkIcon,
  store: Store,
};

function Templates() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from("bot_templates")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setTemplates((data as Template[]) ?? []);
        setLoading(false);
      });
  }, []);

  const useTemplate = async (t: Template) => {
    if (!user) return;
    const [{ count }, { data: prof }] = await Promise.all([
      supabase.from("bots").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    ]);
    const { getPlan } = await import("@/lib/plans");
    const limit = getPlan((prof as any)?.plan).botLimit;
    if ((count ?? 0) >= limit) {
      toast.error("Limite do plano atingido. Faça upgrade para criar mais bots.");
      navigate({ to: "/plans" });
      return;
    }
    setCreating(true);
    const { data: bot, error } = await supabase
      .from("bots")
      .insert({
        user_id: user.id,
        name: t.name,
        bot_type: "sales",
        segment: t.segment,
        tone: "casual",
        template_slug: t.slug,
      })
      .select()
      .single();

    if (error || !bot) {
      toast.error(error?.message ?? "Erro ao criar bot");
      setCreating(false);
      return;
    }

    await supabase.from("bot_flows").insert({
      bot_id: bot.id,
      user_id: user.id,
      blocks: t.flow,
    });

    toast.success(`Bot "${t.name}" criado! Abrindo editor...`);
    setCreating(false);
    setPreview(null);
    navigate({ to: "/bots/$botId/edit", params: { botId: bot.id } });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Templates prontos</h1>
        <p className="text-muted-foreground mt-1">
          Veja como cada modelo conversa antes de usar — você pode editar tudo depois.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const Icon = ICON_MAP[t.icon ?? "store"] ?? Store;
            const blockCount = Array.isArray(t.flow) ? t.flow.length : 0;
            return (
              <div
                key={t.id}
                className="p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 hover:shadow-card transition-all flex flex-col"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-1">{t.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1">{t.description}</p>
                <div className="text-xs text-muted-foreground mb-4 flex items-center gap-3">
                  <span>{t.segment}</span>
                  <span>·</span>
                  <span>{blockCount} blocos</span>
                </div>
                <Button
                  onClick={() => setPreview(t)}
                  variant="outline"
                  className="w-full"
                >
                  <Eye className="h-4 w-4 mr-2" /> Ver prévia
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {preview && (() => {
                const Icon = ICON_MAP[preview.icon ?? "store"] ?? Store;
                return (
                  <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                );
              })()}
              <div>
                <div>{preview?.name}</div>
                <div className="text-xs font-normal text-muted-foreground">{preview?.description}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <MessageSquare className="h-3.5 w-3.5" />
              Prévia do fluxo de conversa
            </div>
            <div className="rounded-xl bg-background border border-border p-4 space-y-2">
              {Array.isArray(preview?.flow) && preview!.flow.map((block: any, i: number) => (
                <PreviewBubble key={i} block={block} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Você poderá editar mensagens, blocos e produtos no editor depois de criar.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button
              onClick={() => preview && useTemplate(preview)}
              disabled={creating}
              className="bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Usar e editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewBubble({ block }: { block: any }) {
  const type = block?.type ?? "message";
  if (type === "message" || type === "text") {
    return (
      <div className="flex">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
          {block.text ?? "(mensagem)"}
        </div>
      </div>
    );
  }
  if (type === "options" || type === "buttons") {
    return (
      <div className="flex flex-col gap-1.5">
        {block.text && (
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
            {block.text}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pl-2">
          {(block.options ?? []).map((o: string, i: number) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border">{o}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground italic px-2">
      [{type}] {block.text ?? block.field ?? ""}
    </div>
  );
}

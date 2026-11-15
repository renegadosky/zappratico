import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PasswordStrengthMeter, scorePassword } from "@/components/PasswordStrengthMeter";
import { HumanCheck, HumanCheckHandle } from "@/components/HumanCheck";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [terms, setTerms] = useState(false);
  const [human, setHuman] = useState<HumanCheckHandle>({ isHuman: false, honeypot: "" });
  const handleHuman = useCallback((s: HumanCheckHandle) => setHuman(s), []);

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: profile?.onboarding_completed ? "/dashboard" : "/onboarding" });
    }
  }, [user, profile, authLoading, navigate]);

  const translateError = (msg: string, code?: string) => {
    if (code === "weak_password" || msg.toLowerCase().includes("weak"))
      return "Essa senha apareceu em vazamentos. Escolha uma única.";
    if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already been registered"))
      return "Este email já está cadastrado. Faça login.";
    if (msg === "Invalid login credentials") return "Email ou senha incorretos.";
    if (msg.includes("Email not confirmed")) return "Confirme seu email antes de entrar.";
    if (msg.toLowerCase().includes("rate limit")) return "Muitas tentativas. Aguarde alguns segundos.";
    return msg;
  };

  const checkBot = () => {
    if (human.honeypot) return "Falha na verificação. Recarregue a página.";
    if (!human.isHuman) return "Confirme que você não é um robô.";
    return null;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const botErr = checkBot();
    if (botErr) return toast.error(botErr);
    if (!fullName.trim()) return toast.error("Informe seu nome.");
    if (!terms) return toast.error("Você precisa aceitar os Termos e a Política de Privacidade.");
    const s = scorePassword(password);
    if (!s.isAcceptable) {
      return toast.error("Sua senha está muito fraca. Fortaleça antes de continuar.");
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { full_name: fullName.trim() },
      },
    });
    if (!error) {
      // marca aceite dos termos no perfil (best-effort)
      await supabase.from("profiles").update({ terms_accepted_at: new Date().toISOString() }).eq("id", data.user?.id ?? "");
    }
    setLoading(false);
    if (error) return toast.error(translateError(error.message, (error as any).code));
    if (data.session) toast.success("Conta criada! Vamos configurar sua loja.");
    else toast.success("Conta criada! Verifique seu email para confirmar.");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const botErr = checkBot();
    if (botErr) return toast.error(botErr);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) toast.error(translateError(error.message, (error as any).code));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="flex justify-center mb-8">
          <Logo size="lg" />
        </Link>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-elegant">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass-in">Senha</Label>
                  <Input id="pass-in" type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
                <HumanCheck onChange={handleHuman} />
                <Button type="submit" disabled={loading}
                  className="w-full bg-gradient-primary text-primary-foreground shadow-glow h-11">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name-up">Seu nome</Label>
                  <Input id="name-up" type="text" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)} placeholder="João Silva" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass-up">Senha</Label>
                  <Input id="pass-up" type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="ex: SenhaForte123!" />
                  <PasswordStrengthMeter password={password} />
                </div>

                <HumanCheck onChange={handleHuman} />

                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={terms}
                    onCheckedChange={(v) => setTerms(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span>
                    Eu li e concordo com os{" "}
                    <Link to="/termos" className="text-primary hover:underline" target="_blank">Termos de uso</Link>
                    {" "}e a{" "}
                    <Link to="/privacidade" className="text-primary hover:underline" target="_blank">Política de Privacidade</Link>.
                  </span>
                </label>

                <Button type="submit" disabled={loading}
                  className="w-full bg-gradient-primary text-primary-foreground shadow-glow h-11">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

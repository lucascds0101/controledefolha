import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When user opens the recovery link, Supabase emits PASSWORD_RECOVERY event
    // and creates a temporary session that allows updateUser({ password }).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha precisa ter ao menos 6 caracteres");
    if (password !== confirm) return toast.error("As senhas não coincidem");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha redefinida com sucesso");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center w-9 h-9 rounded-md bg-primary text-primary-foreground">
            <ClipboardList className="h-5 w-5" />
          </div>
          <span className="font-semibold">Controle de Folha</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ready
              ? "Escolha uma nova senha para sua conta."
              : "Validando link de recuperação…"}
          </p>
        </div>

        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np">Nova senha</Label>
              <Input
                id="np"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp">Confirmar senha</Label>
              <Input
                id="cp"
                type="password"
                minLength={6}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Redefinir senha
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

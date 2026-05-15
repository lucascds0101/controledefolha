import { useEffect, useState } from "react";
import { Moon, Sun, Settings as SettingsIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";

const KEY = "cf-theme";

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function set(next: boolean) {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(KEY, next ? "dark" : "light");
  }
  return { dark, set };
}

type Role = { id: string; name: string; position: number };

function RolesPanel() {
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id,name,position")
        .order("position")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("roles").insert({
        user_id: u.user!.id,
        name: newName.trim(),
        position: roles.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setNewName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("roles").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setEditingId(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Novo cargo"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) add.mutate();
          }}
        />
        <Button onClick={() => add.mutate()} disabled={!newName.trim() || add.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto sheet-scroll pr-1">
        {roles.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-md border p-2">
            {editingId === r.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingName.trim())
                      update.mutate({ id: r.id, name: editingName.trim() });
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => update.mutate({ id: r.id, name: editingName.trim() })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{r.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(r.id);
                    setEditingName(r.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remover cargo "${r.name}"?`)) remove.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ))}
        {roles.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nenhum cargo cadastrado.
          </p>
        )}
      </div>
    </div>
  );
}

function AccountPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function send() {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Email de redefinição enviado");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Email da conta</Label>
        <Input value={email} disabled />
      </div>
      <p className="text-xs text-muted-foreground">
        Enviaremos um link para redefinir sua senha no email acima.
      </p>
      <Button onClick={send} disabled={!email || loading} className="w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar link de redefinição
      </Button>
    </div>
  );
}

function AppearancePanel() {
  const { dark, set } = useTheme();
  return (
    <div className="space-y-3">
      <Label>Tema</Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => set(false)}
          className={`flex items-center justify-center gap-2 rounded-md border p-4 transition ${
            !dark ? "border-primary bg-primary/5" : "hover:bg-accent"
          }`}
        >
          <Sun className="h-5 w-5" />
          <span className="text-sm font-medium">Claro</span>
        </button>
        <button
          onClick={() => set(true)}
          className={`flex items-center justify-center gap-2 rounded-md border p-4 transition ${
            dark ? "border-primary bg-primary/5" : "hover:bg-accent"
          }`}
        >
          <Moon className="h-5 w-5" />
          <span className="text-sm font-medium">Escuro</span>
        </button>
      </div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> Configurações
          </DialogTitle>
          <DialogDescription>
            Ajuste a aparência, gerencie cargos e sua conta.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="appearance" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="roles">Cargos</TabsTrigger>
            <TabsTrigger value="account">Conta</TabsTrigger>
          </TabsList>
          <TabsContent value="appearance" className="pt-4">
            <AppearancePanel />
          </TabsContent>
          <TabsContent value="roles" className="pt-4">
            <RolesPanel />
          </TabsContent>
          <TabsContent value="account" className="pt-4">
            <AccountPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

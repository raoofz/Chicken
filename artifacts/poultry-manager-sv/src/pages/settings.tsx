import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, User, Shield, LogOut } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Lösenorden matchar inte", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Lösenordet måste vara minst 4 tecken", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const pwdError = res.status === 401 ? "Fel nuvarande lösenord" : "Kunde inte ändra lösenord";
        toast({ title: pwdError, variant: "destructive" });
        return;
      }
      toast({ title: "Lösenordet har ändrats" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Kunde inte ansluta till servern", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inställningar</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" />Kontoinformation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Namn</span>
            <span className="font-semibold">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Användarnamn</span>
            <span className="font-semibold">{user?.username}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Roll</span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-semibold">{user?.role === "admin" ? "Administratör" : "Arbetare"}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" />Ändra lösenord</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Nuvarande lösenord</Label>
              <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Ange nuvarande lösenord" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Nytt lösenord</Label>
              <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Ange nytt lösenord" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Bekräfta nytt lösenord</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ange nytt lösenord igen" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Ändrar..." : "Ändra lösenord"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full gap-2 text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-4 h-4" />Logga ut
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

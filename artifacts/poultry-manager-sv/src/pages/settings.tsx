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
      toast({ title: "Nya l\u00f6senord matchar inte", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "L\u00f6senordet m\u00e5ste vara minst 4 tecken", variant: "destructive" });
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
        const pwdError = res.status === 401 ? "Fel nuvarande l\u00f6senord" : "Fel vid byte av l\u00f6senord";
        toast({ title: pwdError, variant: "destructive" });
        return;
      }
      toast({ title: "L\u00f6senordet har \u00e4ndrats" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Serveranslutningsfel", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inst\u00e4llningar</h1>

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
            <span className="text-muted-foreground">Anv\u00e4ndarnamn</span>
            <span className="font-semibold">{user?.username}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Roll</span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-semibold">{user?.role === "admin" ? "Administrat\u00f6r" : "Arbetare"}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" />\u00c4ndra l\u00f6senord</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Nuvarande l\u00f6senord</Label>
              <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Ange nuvarande l\u00f6senord" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Nytt l\u00f6senord</Label>
              <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Ange nytt l\u00f6senord" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Bekr\u00e4fta nytt l\u00f6senord</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="\u00c5terange nytt l\u00f6senord" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "\u00c4ndrar..." : "\u00c4ndra l\u00f6senord"}</Button>
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

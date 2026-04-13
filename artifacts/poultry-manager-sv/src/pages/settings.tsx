import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, LogOut, Lock, Shield, Wrench, CheckCircle } from "lucide-react";

export default function Settings() {
  const { user, logout, isAdmin } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg("");
    setPassError("");
    setPassLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPassError(data.error || "Fel vid ändring av lösenord");
      } else {
        setPassMsg("Lösenordet har ändrats");
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setPassError("Anslutningsfel");
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inställningar</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Kontoinformation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 py-3">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {isAdmin ? (
              <>
                <Shield className="w-4 h-4 text-amber-500" />
                <span className="font-semibold">Admin</span>
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4 text-blue-500" />
                <span className="font-semibold">Arbetare</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Ändra lösenord
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{passError}</div>
            )}
            {passMsg && (
              <div className="p-3 rounded-lg bg-green-500/10 text-green-700 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {passMsg}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Nuvarande lösenord</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nytt lösenord</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={passLoading}>
              {passLoading ? "Sparar..." : "Ändra lösenord"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full gap-2 text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-4 h-4" />
            Logga ut
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

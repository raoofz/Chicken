import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, User, Shield, LogOut, Pencil, Check, X } from "lucide-react";
import { apiPost, apiPut } from "@/lib/api";

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editUsername, setEditUsername] = useState(user?.username ?? "");
  const [profileLoading, setProfileLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: t("settings.passwordMismatch"), variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: t("settings.passwordTooShort"), variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      await apiPost("/api/auth/change-password", { currentPassword, newPassword });
      toast({ title: t("settings.passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: t("settings.connectionError"), variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim() && !editUsername.trim()) return;
    setProfileLoading(true);
    try {
      await apiPut("/api/auth/profile", { name: editName.trim(), username: editUsername.trim() });
      await refreshUser();
      toast({ title: "تم تحديث المعلومات بنجاح" });
      setEditingProfile(false);
    } catch {
      toast({ title: t("settings.connectionError"), variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  };

  const startEditing = () => {
    setEditName(user?.name ?? "");
    setEditUsername(user?.username ?? "");
    setEditingProfile(true);
  };

  const cancelEditing = () => {
    setEditName(user?.name ?? "");
    setEditUsername(user?.username ?? "");
    setEditingProfile(false);
  };

  return (
    <div className="space-y-6" dir={dir}>
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {t("settings.accountInfo")}
            </div>
            {!editingProfile && (
              <Button variant="ghost" size="sm" onClick={startEditing} className="gap-1">
                <Pencil className="w-4 h-4" />
                تعديل
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editingProfile ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="الاسم الكامل"
                />
              </div>
              <div className="space-y-2">
                <Label>اسم المستخدم (بالإنجليزية)</Label>
                <Input
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  placeholder="username"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={handleUpdateProfile}
                  disabled={profileLoading}
                >
                  <Check className="w-4 h-4" />
                  {profileLoading ? "جاري الحفظ..." : "حفظ"}
                </Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={cancelEditing}>
                  <X className="w-4 h-4" />
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">{t("settings.name")}</span>
                <span className="font-semibold">{user?.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">{t("settings.username")}</span>
                <span className="font-semibold">{user?.username}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">{t("settings.role")}</span>
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{user?.role === "admin" ? t("role.admin") : t("role.worker")}</span>
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {t("settings.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">{t("settings.currentPassword")}</Label>
              <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={t("settings.currentPassword.placeholder")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">{t("settings.newPassword")}</Label>
              <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("settings.newPassword.placeholder")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("settings.confirmPassword")}</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("settings.confirmPassword.placeholder")} required />
            </div>
            <Button type="submit" className="w-full" disabled={pwLoading}>
              {pwLoading ? t("settings.changing") : t("settings.changeBtn")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full gap-2 text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-4 h-4" />
            {t("settings.logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

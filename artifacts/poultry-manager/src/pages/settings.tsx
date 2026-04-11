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
      toast({ title: "كلمة المرور الجديدة غير متطابقة", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "كلمة المرور يجب أن تكون 4 أحرف على الأقل", variant: "destructive" });
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
        toast({ title: data.error || "خطأ في تغيير كلمة المرور", variant: "destructive" });
        return;
      }
      toast({ title: "✓ تم تغيير كلمة المرور بنجاح" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "خطأ في الاتصال بالسيرفر", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            معلومات الحساب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">الاسم</span>
            <span className="font-semibold">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">اسم المستخدم</span>
            <span className="font-semibold">{user?.username}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">الدور</span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-semibold">{user?.role === "admin" ? "مدير" : "عامل"}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            تغيير كلمة المرور
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">كلمة المرور الحالية</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">كلمة المرور الجديدة</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور الجديدة"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full gap-2 text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

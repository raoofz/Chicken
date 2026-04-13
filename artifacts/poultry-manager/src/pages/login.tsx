import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogIn, Languages } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const { t, dir, toggleLang } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={dir}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-primary/6 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-100/30 blur-3xl" />
      </div>

      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg bg-card border border-border shadow-sm"
      >
        <Languages className="w-4 h-4" />
        {t("lang.switch")}
      </button>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-3xl shadow-xl border border-primary/20">
              <Logo size={64} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("app.name")}</h1>
          <p className="text-muted-foreground mt-1">{t("app.subtitle.smart")}</p>
        </div>

        <Card className="shadow-2xl border-border/50 backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-center">{t("login.title")}</CardTitle>
            <CardDescription className="text-center">{t("login.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={login} className="w-full h-11 text-base font-semibold gap-2">
              <LogIn className="w-5 h-5" />
              {t("login.submit")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

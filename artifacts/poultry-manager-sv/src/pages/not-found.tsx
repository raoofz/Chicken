import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-10">
          <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
          <h2 className="text-xl font-semibold mb-2">Sidan hittades inte</h2>
          <p className="text-muted-foreground mb-6">Sidan du letar efter finns inte eller har flyttats.</p>
          <Link href="/"><Button>Tillbaka till översikten</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

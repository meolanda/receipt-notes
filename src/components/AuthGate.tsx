import { Button } from "@/components/ui/button";
import { LogIn, Loader2 } from "lucide-react";

interface AuthGateProps {
  onSignIn: () => void;
  loading?: boolean;
}

export default function AuthGate({ onSignIn, loading }: AuthGateProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4">
      <div className="text-center space-y-2">
        <div className="text-6xl mb-2">🧾</div>
        <h1 className="text-2xl font-bold font-display">บันทึกใบเสร็จ</h1>
        <p className="text-muted-foreground text-sm">สแกนและจัดการใบเสร็จด้วย AI</p>
      </div>

      <Button
        onClick={onSignIn}
        disabled={loading}
        size="lg"
        className="gap-2 h-12 px-8 text-base"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <LogIn className="h-5 w-5" />
        )}
        เข้าสู่ระบบด้วย Google
      </Button>

      <div className="text-center space-y-1 text-xs text-muted-foreground max-w-xs">
        <p>📦 ข้อมูลเก็บใน Firebase Firestore</p>
        <p>🖼️ รูปเก็บใน Firebase Storage</p>
        <p>🔒 เข้าถึงได้เฉพาะบัญชีของคุณ</p>
        <p>📱 ใช้งานได้ทุกอุปกรณ์</p>
      </div>
    </div>
  );
}

/**
 * FirebaseSettings.tsx
 * แสดงข้อมูล Firebase account + ปุ่ม export / dedup / logout
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, LogOut, Trash2, Download } from "lucide-react";
import type { User } from "firebase/auth";
import type { Receipt } from "@/lib/receipt-store";
import { downloadCSV } from "@/lib/receipt-store";
import { deduplicateFirestore } from "@/lib/firestore-store";
import { toast } from "sonner";

interface FirebaseSettingsProps {
  user: User;
  receipts: Receipt[];
  profile: "personal" | "company";
  onLogout: () => void;
}

export default function FirebaseSettings({ user, receipts, profile, onLogout }: FirebaseSettingsProps) {
  const [isDeduping, setIsDeduping] = useState(false);

  const profileLabel = profile === "personal" ? "ส่วนตัว" : "บริษัท";
  const profileReceipts = receipts.filter((r) => r.profile === profile);

  const handleDedup = async () => {
    setIsDeduping(true);
    try {
      const { found, deleted } = await deduplicateFirestore(user.uid);
      if (found === 0) {
        toast.success("ไม่พบข้อมูลซ้ำ ✅");
      } else {
        toast.success(`ลบซ้ำแล้ว ${deleted} ใบ ✅`);
      }
    } catch (err: any) {
      toast.error("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsDeduping(false);
    }
  };

  return (
    <Card className="receipt-shadow fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5 text-primary" />
          Firebase Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          {user.photoURL && (
            <img src={user.photoURL} alt="avatar" className="h-10 w-10 rounded-full" />
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{user.displayName || "ผู้ใช้"}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 text-green-700 border-green-300 bg-green-50">
            ✅ เชื่อมต่อแล้ว
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-2xl font-bold">{receipts.length}</p>
            <p className="text-xs text-muted-foreground">ใบเสร็จทั้งหมด</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-2xl font-bold">{profileReceipts.length}</p>
            <p className="text-xs text-muted-foreground">({profileLabel})</p>
          </div>
        </div>

        {/* Export CSV */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => downloadCSV(profileReceipts, profileLabel)}
          disabled={profileReceipts.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV ({profileLabel})
        </Button>

        {/* Dedup */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
          onClick={handleDedup}
          disabled={isDeduping}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {isDeduping ? "กำลังตรวจซ้ำ..." : "ตรวจและลบใบเสร็จซ้ำ (Firestore)"}
        </Button>
        <p className="text-xs text-muted-foreground">
          ตรวจจาก: วันที่ + ยอดรวม → เก็บอันเก่า ลบอันใหม่
        </p>

        {/* Logout */}
        <Button
          variant="ghost"
          className="w-full gap-2 text-muted-foreground hover:text-destructive"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </Button>
      </CardContent>
    </Card>
  );
}

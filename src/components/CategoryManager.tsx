import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tags, Plus, Trash2, AlertCircle } from "lucide-react";
import {
  DEFAULT_PERSONAL_CATEGORIES,
  DEFAULT_COMPANY_CATEGORIES,
  getCustomCategories,
  addCustomCategory,
  removeCustomCategory,
  isCategoryUsed,
  getCategoriesForProfile,
  type Profile,
} from "@/lib/receipt-store";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CategoryManager() {
  const [newCatPersonal, setNewCatPersonal] = useState("");
  const [newCatCompany, setNewCatCompany] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ profile: Profile; category: string } | null>(null);
  const [, setRefresh] = useState(0);

  const personalCategories = getCategoriesForProfile("personal");
  const companyCategories = getCategoriesForProfile("company");
  const custom = getCustomCategories();

  const isDefault = (profile: Profile, cat: string) => {
    const defaults = profile === "personal" ? DEFAULT_PERSONAL_CATEGORIES : DEFAULT_COMPANY_CATEGORIES;
    return defaults.includes(cat);
  };

  const handleAdd = (profile: Profile) => {
    const value = (profile === "personal" ? newCatPersonal : newCatCompany).trim();
    if (!value) return;
    const existing = getCategoriesForProfile(profile);
    if (existing.includes(value)) {
      toast.error("หมวดหมู่นี้มีอยู่แล้ว");
      return;
    }
    addCustomCategory(profile, value);
    if (profile === "personal") setNewCatPersonal("");
    else setNewCatCompany("");
    setRefresh((r) => r + 1);
    toast.success(`เพิ่มหมวดหมู่ "${value}" เรียบร้อย`);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const { profile, category } = deleteTarget;

    if (isCategoryUsed(category, profile)) {
      toast.error(`ไม่สามารถลบ "${category}" ได้ เพราะมีใบเสร็จที่ใช้หมวดหมู่นี้อยู่`);
      setDeleteTarget(null);
      return;
    }

    removeCustomCategory(profile, category);
    setRefresh((r) => r + 1);
    toast.success(`ลบหมวดหมู่ "${category}" เรียบร้อย`);
    setDeleteTarget(null);
  };

  const renderSection = (profile: Profile, categories: string[], newValue: string, setNewValue: (v: string) => void) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        {profile === "personal" ? "🧑 ส่วนตัว" : "🏢 บริษัท"}
      </h3>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const isDef = isDefault(profile, cat);
          const isCustom = !isDef;
          return (
            <Badge key={cat} variant="outline" className="flex items-center gap-1 py-1 px-2">
              <span className="text-xs">{cat}</span>
              {isDef && <span className="text-[10px] text-muted-foreground">(ค่าเริ่มต้น)</span>}
              {isCustom && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ profile, category: cat })}
                  className="ml-1 text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="ชื่อหมวดหมู่ใหม่..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd(profile))}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => handleAdd(profile)} disabled={!newValue.trim()}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่ม
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Card className="receipt-shadow fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tags className="h-5 w-5 text-primary" />
            จัดการหมวดหมู่
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderSection("personal", personalCategories, newCatPersonal, setNewCatPersonal)}
          <div className="border-t border-border" />
          {renderSection("company", companyCategories, newCatCompany, setNewCatCompany)}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ยืนยันการลบ
            </AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบหมวดหมู่ "{deleteTarget?.category}" หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

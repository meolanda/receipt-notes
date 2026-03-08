import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Plus, Trash2, Receipt } from "lucide-react";
import { saveReceipt, CATEGORIES, type ReceiptItem } from "@/lib/receipt-store";
import { toast } from "sonner";

interface ReceiptFormProps {
  onSaved: () => void;
}

export default function ReceiptForm({ onSaved }: ReceiptFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ReceiptItem[]>([{ name: "", quantity: 1, price: 0 }]);
  const [imageData, setImageData] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addItem = () => setItems([...items, { name: "", quantity: 1, price: 0 }]);

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ReceiptItem, value: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("กรุณากรอกชื่อใบเสร็จ");
      return;
    }
    if (!category) {
      toast.error("กรุณาเลือกหมวดหมู่");
      return;
    }
    saveReceipt({
      title: title.trim(),
      description: description.trim(),
      category,
      date,
      totalAmount,
      items: items.filter((i) => i.name.trim()),
      imageData,
    });
    toast.success("บันทึกใบเสร็จเรียบร้อย!");
    // Reset
    setTitle("");
    setDescription("");
    setCategory("");
    setDate(new Date().toISOString().slice(0, 10));
    setItems([{ name: "", quantity: 1, price: 0 }]);
    setImageData(undefined);
    onSaved();
  };

  return (
    <Card className="receipt-shadow fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-primary" />
          บันทึกใบเสร็จใหม่
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Image upload */}
          <div>
            <Label>รูปใบเสร็จ (ไม่บังคับ)</Label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            {imageData ? (
              <div className="relative mt-2">
                <img src={imageData} alt="ใบเสร็จ" className="w-full max-h-48 object-cover rounded-lg border border-border" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => setImageData(undefined)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="mt-2 w-full border-dashed h-24 flex flex-col gap-1" onClick={() => fileRef.current?.click()}>
                <Camera className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">ถ่ายรูป / เลือกรูป</span>
              </Button>
            )}
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="title">ชื่อใบเสร็จ *</Label>
              <Input id="title" placeholder="เช่น ค่าอาหารกลางวัน" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="date">วันที่</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="category">หมวดหมู่ *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="เลือก..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="desc">รายละเอียด</Label>
            <Textarea id="desc" placeholder="รายละเอียดเพิ่มเติม..." value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} />
          </div>

          {/* Items */}
          <div>
            <Label>รายการสินค้า/บริการ</Label>
            <div className="mt-2 space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input placeholder="ชื่อรายการ" value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} className="flex-1" />
                  <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} className="w-16 text-center" />
                  <Input type="number" min={0} step={0.01} placeholder="ราคา" value={item.price || ""} onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)} className="w-24" />
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-primary" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
            </Button>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="font-medium text-muted-foreground">ยอดรวม</span>
            <span className="text-2xl font-bold font-display text-primary">
              ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <Button type="submit" className="w-full" size="lg">
            บันทึกใบเสร็จ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

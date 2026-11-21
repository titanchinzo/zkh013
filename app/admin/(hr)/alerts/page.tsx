import { AlertsPanel } from "@/components/hr/alerts-panel";

export default function AlertsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Зарлан мэдээлэх</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Энд бичсэн мэдээлэл зөвшөөрөгдсөн бүх утсанд мэдэгдлээр очиж, аппад нь харагдана. Хүн бүр «Хүлээн авлаа»
          дарахад энд тэмдэглэгдэнэ. Мэдээлэл бүр хугацаатай: эхлэх цагт нь утсанд очиж, дуусах цаг өнгөрмөгц утаснаас
          болон эндээс автоматаар устна. Хүний нөөц, админ утсан дээрх аппаасаа ч илгээж болно.
        </p>
      </div>
      <AlertsPanel />
    </div>
  );
}

import { ReadinessPanel } from "@/components/hr/readiness-panel";

export default function ReadinessPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Дохионы бэлэн байдал</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Хэний утас дуугүй үед ч улаан дохио сонсогдохыг эндээс хянана: Android дээр апп суулгасан, iPhone дээр яаралтай
          дуудлагыг (Emergency Bypass) тохируулсан байх ёстой. Хүний нөөц, админ утсан дээрх аппаасаа ч харна.
        </p>
      </div>
      <ReadinessPanel />
    </div>
  );
}

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background tactical-grid">
      {/* Production Clerk-д Google-ээр нэвтрэхэд Google Cloud-ийн OAuth (client ID/secret) тохиргоо хэрэгтэй —
          хийгээгүй тул товч нь алдаа өгдөг. Тохируулах хүртэл нууж, и-мэйлээр нэвтэрнэ */}
      <SignIn appearance={{ elements: { socialButtonsRoot: { display: "none" }, dividerRow: { display: "none" } } }} />
    </div>
  );
}

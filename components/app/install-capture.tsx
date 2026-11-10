/**
 * Хөтөч апп суулгах цонхоо React ачаалахаас өмнө санал болгож болох тул үйл явдлыг эрт барьж
 * window.__installEvent-д хадгална — useInstall() (components/app/install.tsx) түүнийг уншина.
 */
export function InstallCapture() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installEvent=e});",
      }}
    />
  );
}

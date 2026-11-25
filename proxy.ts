import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    await auth.protect();
  }
});

// robots.txt, sitemap.xml-ийг хайлтын робот, /.well-known-ыг Android (аппын баталгаажуулалт), APK-г утас Clerk-ээр
// дамжуулалгүй шууд авна
export const config = {
  matcher: [
    "/((?!_next|\\.well-known/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|apk|webmanifest|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};

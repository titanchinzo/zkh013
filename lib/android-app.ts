// Улаан дохиог утас дуугүй үед ч дуугаргадаг Android апп (android/ хавтас). Шинэ хувилбар гаргахад
// android/app/build.gradle-ийн versionCode, public/android дахь APK, энэ файлыг хамт шинэчилнэ.
export const ANDROID_APP = {
  // Жинхэнэ утсан дээр туршиж дуустал false: татах хуудсанд «Туршилтын хувилбар» гэж харагдана, аппын нүүр, илгээх
  // маягтад санал болгохгүй. Туршаад true болгоно.
  released: false,
  version: 2,
  url: "/android/zkh013-2.apk",
  // Аппын «Улаан дохионы тохиргоо» дэлгэц; апп суугаагүй утсанд татах хуудас нээгдэнэ
  setupUrl:
    "intent://setup#Intent;scheme=zkh013;package=mn.unit013.app;S.browser_fallback_url=https%3A%2F%2Funit013.mn%2Fdownload;end",
};

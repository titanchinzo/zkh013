package mn.unit013.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Утасны төлөв: Chrome, хуучин вэб апп, үйлдвэрлэгч */
final class Phone {
    static final String CHROME = "com.android.chrome";
    private static final String WEBAPK = "org.chromium.webapk";
    // Апп хаалттай үед өөр аппаас (Chrome) асаахыг анхнаасаа хориглодог утаснууд
    private static final List<String> AUTOSTART = Arrays.asList(
            "xiaomi", "redmi", "poco", "huawei", "honor", "oppo", "vivo", "realme", "oneplus", "tecno", "infinix", "itel", "meizu");

    private Phone() {}

    static boolean chromeReady(Context c) {
        try {
            return c.getPackageManager().getApplicationInfo(CHROME, 0).enabled;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    /**
     * Chrome-оор суулгасан хуучин вэб апп (WebAPK), байхгүй бол null. Тэр суусан байвал Chrome мэдэгдлийг энэ апп руу
     * биш, түүн рүү дамжуулдаг тул дохио дуугарахгүй.
     */
    static String oldApp(Context c) {
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse(c.getString(R.string.app_url))).addCategory(Intent.CATEGORY_BROWSABLE);
        for (ResolveInfo r : c.getPackageManager().queryIntentActivities(link, PackageManager.MATCH_ALL)) {
            String name = r.activityInfo == null ? "" : r.activityInfo.packageName;
            if (name.startsWith(WEBAPK)) return name;
        }
        return null;
    }

    static boolean needsAutostart() {
        return AUTOSTART.contains(Build.MANUFACTURER.toLowerCase(Locale.ROOT))
                || AUTOSTART.contains(Build.BRAND.toLowerCase(Locale.ROOT));
    }
}

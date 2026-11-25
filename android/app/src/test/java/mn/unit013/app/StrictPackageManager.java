package mn.unit013.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Implementation;
import org.robolectric.annotation.Implements;
import org.robolectric.shadows.ShadowApplicationPackageManager;

/** Жинхэнэ Android шиг: манифестэд байхгүй хэсгийн төлөвийг солих гэвэл алдаа өгнө (Robolectric чимээгүй өнгөрөөдөг) */
@Implements(className = "android.app.ApplicationPackageManager", isInAndroidSdk = false)
public class StrictPackageManager extends ShadowApplicationPackageManager {
    @Implementation
    @Override
    protected void setComponentEnabledSetting(ComponentName component, int state, int flags) {
        Context app = RuntimeEnvironment.getApplication();
        String name = component.getClassName();
        // Robolectric өөрийн туслах хэсгүүдээ мөн ийм замаар асаадаг
        boolean own = component.getPackageName().equals(app.getPackageName()) && !name.startsWith("org.robolectric.");
        if (own && !declared(app, name)) {
            throw new IllegalArgumentException("Component class " + name + " does not exist in " + component.getPackageName());
        }
        super.setComponentEnabledSetting(component, state, flags);
    }

    private static boolean declared(Context app, String name) {
        try {
            PackageInfo info = app.getPackageManager().getPackageInfo(app.getPackageName(),
                    PackageManager.GET_ACTIVITIES | PackageManager.GET_SERVICES | PackageManager.GET_RECEIVERS
                            | PackageManager.MATCH_DISABLED_COMPONENTS);
            if (info.activities != null) for (android.content.pm.ActivityInfo a : info.activities) if (a.name.equals(name)) return true;
            if (info.services != null) for (android.content.pm.ServiceInfo s : info.services) if (s.name.equals(name)) return true;
            if (info.receivers != null) for (android.content.pm.ActivityInfo r : info.receivers) if (r.name.equals(name)) return true;
            return false;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}

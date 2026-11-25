package mn.unit013.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * Апп унасан бол алдааны мөрийг зөвхөн энэ утсан дээр хадгална (хаашаа ч илгээхгүй). Дараагийн удаа тохиргооны дэлгэц дээр
 * харагдаж, хэрэглэгч өөрөө хуулж илгээнэ.
 */
final class Crash {
    private static final String PREFS = "crash";
    private static final String KEY_TRACE = "trace";
    private static final String KEY_NEW = "new";
    private static final int MAX = 6000;

    private Crash() {}

    static void watch(Context c) {
        Thread.UncaughtExceptionHandler system = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            save(c, error);
            if (system != null) system.uncaughtException(thread, error);
        });
    }

    @SuppressLint("ApplySharedPref") // Процесс одоо унтарна — шууд бичнэ
    static void save(Context c, Throwable error) {
        String trace = "v" + BuildConfig.VERSION_NAME + " · " + Build.MANUFACTURER + " " + Build.MODEL
                + " · Android " + Build.VERSION.RELEASE + "\n" + Log.getStackTraceString(error);
        if (trace.length() > MAX) trace = trace.substring(0, MAX);
        prefs(c).edit().putString(KEY_TRACE, trace).putBoolean(KEY_NEW, true).commit();
    }

    /** Хамгийн сүүлийн алдаа, байхгүй бол null */
    static String last(Context c) {
        return prefs(c).getString(KEY_TRACE, null);
    }

    /** Унаснаас хойш хэрэглэгч тохиргооны дэлгэцээс апп-ыг дахин нээгээгүй */
    static boolean isNew(Context c) {
        return prefs(c).getBoolean(KEY_NEW, false);
    }

    static void seen(Context c) {
        prefs(c).edit().putBoolean(KEY_NEW, false).apply();
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

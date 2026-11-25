package mn.unit013.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;

import com.google.androidbrowserhelper.trusted.SharedPreferencesTokenStore;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Оношилгоо: дохио ирсэн, дуугарсан эсэх сүүлийн тэмдэглэл ба утасны тохиргоо. Зөвхөн энэ утсан дээр хадгалагдаж,
 * хэрэглэгч өөрөө хуулж илгээнэ. Мэдэгдлийн гарчиг, текст, илгээгч энд бичигдэхгүй.
 */
final class Diary {
    private static final String PREFS = "diary";
    private static final String KEY = "lines";
    private static final int MAX = 40;

    private Diary() {}

    static synchronized void add(Context c, String text) {
        String time = new SimpleDateFormat("MM-dd HH:mm:ss", Locale.ROOT).format(new Date());
        String[] old = lines(c).split("\n");
        StringBuilder next = new StringBuilder();
        for (int i = Math.max(0, old.length - MAX + 1); i < old.length; i++) if (!old[i].isEmpty()) next.append(old[i]).append('\n');
        next.append(time).append("  ").append(text.replace('\n', ' '));
        prefs(c).edit().putString(KEY, next.toString()).apply();
    }

    static String lines(Context c) {
        return prefs(c).getString(KEY, "");
    }

    static String report(Context c) {
        NotificationManager nm = Alarm.manager(c);
        AudioManager audio = c.getSystemService(AudioManager.class);
        NotificationChannel channel = nm.getNotificationChannel(Alarm.SERVICE_CHANNEL);
        StringBuilder r = new StringBuilder();
        r.append("013 анги v").append(BuildConfig.VERSION_NAME).append(" · ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL)
                .append(" · Android ").append(Build.VERSION.RELEASE).append('\n');
        r.append("Chrome: ").append(chrome(c)).append(", холбогдсон: ").append(yes(linked(c))).append('\n');
        String old = Phone.oldApp(c);
        r.append("Хуучин апп: ").append(old == null ? "үгүй" : old).append('\n');
        r.append("Мэдэгдэл: ").append(yes(nm.areNotificationsEnabled())).append(", суваг: ")
                .append(channel == null ? "—" : String.valueOf(channel.getImportance())).append(", бүтэн дэлгэц: ")
                .append(yes(Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || nm.canUseFullScreenIntent())).append('\n');
        r.append("DND эрх: ").append(yes(nm.isNotificationPolicyAccessGranted())).append(", горим: ").append(nm.getCurrentInterruptionFilter())
                .append(", хонх: ").append(audio.getRingerMode()).append(", сэрүүлэг: ").append(audio.getStreamVolume(AudioManager.STREAM_ALARM))
                .append('/').append(audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)).append('\n');
        r.append("Батарей чөлөөтэй: ").append(yes(c.getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(c.getPackageName())))
                .append(", яг цагийн сэрүүлэг: ").append(yes(exactAlarms(c))).append('\n');
        String lines = lines(c);
        r.append(lines.isEmpty() ? "Тэмдэглэл алга" : lines);
        return r.toString();
    }

    private static String yes(boolean value) {
        return value ? "тийм" : "үгүй";
    }

    private static String chrome(Context c) {
        try {
            PackageInfo info = c.getPackageManager().getPackageInfo(Phone.CHROME, 0);
            return info.versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "суугаагүй";
        }
    }

    /** Апп Chrome-оор нэг удаа ч болов бүрэн нээгдсэн — тэгэхэд л Chrome мэдэгдлээ дамжуулдаг */
    private static boolean linked(Context c) {
        try {
            return new SharedPreferencesTokenStore(c).load() != null;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private static boolean exactAlarms(Context c) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

package mn.unit013.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.service.notification.StatusBarNotification;
import android.util.Log;

/**
 * Улаан дохио. Дууг апп өөрөө биш, систем «Улаан дохио» сувгийн дуугаар (USAGE_ALARM — сэрүүлгийн дуу) давтан
 * тоглуулдаг: утасны хонх, мэдэгдлийн дуу хаалттай байсан ч дуугарч, апп-ын процесс унтарсан ч тасрахгүй.
 * Мэдэгдлийг цуцлахад (зогсоох товч, хажуу тийш шудрах, хугацаа дуусах, «Хүлээн авлаа») дуу зогсоно.
 */
final class Alarm {
    static final String CHANNEL = "red_alarm";
    /** Улаан мэдээллийн бичвэр: дуугүй суваг — дохиотой зэрэг дуугарахгүй */
    static final String MESSAGE_CHANNEL = "red_message";
    static final String TAG = "red_alarm";
    static final int ID = 13;

    static final long RING_MS = 5 * 60_000;
    static final long TEST_MS = 20_000;
    /** Систем нэг апп-ын мэдэгдлийг секундэд нэгээс олон удаа дуугаргадаггүй тул дуугараагүй бол дахин өгнө */
    static final long CHECK_MS = 2_500;

    private static final String LOG = "zkh013";
    private static final String PREFS = "alarm";
    private static final String KEY_SOURCE = "source";
    private static final String KEY_VOLUME = "volume";
    private static final int VIBRATE_SECONDS = 60;

    /** Дохионы дэлгэц нээлттэй бол зогсоход хаагдана */
    static Runnable onStop;

    private Alarm() {}

    static NotificationManager manager(Context c) {
        return c.getSystemService(NotificationManager.class);
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static AudioAttributes alarmAudio() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    static void createChannels(Context c) {
        NotificationChannel alarm =
                new NotificationChannel(CHANNEL, c.getString(R.string.channel_alarm), NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription(c.getString(R.string.channel_alarm_about));
        Uri siren = new Uri.Builder()
                .scheme(ContentResolver.SCHEME_ANDROID_RESOURCE)
                .authority(c.getPackageName())
                .appendPath("raw")
                .appendPath("siren")
                .build();
        alarm.setSound(siren, alarmAudio());
        // Чичиргээг өөрсдөө өгнө: сувагт чичиргээ байвал зарим утас түгжээгүй үедээ дуугүйгээр зөвхөн чичирдэг
        alarm.enableVibration(false);
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        // «Бүү саад бол» горимын эрх өгсөн бол тэр горимыг ч давна
        alarm.setBypassDnd(manager(c).isNotificationPolicyAccessGranted());
        manager(c).createNotificationChannel(alarm);

        NotificationChannel message = new NotificationChannel(
                MESSAGE_CHANNEL, c.getString(R.string.channel_message), NotificationManager.IMPORTANCE_LOW);
        message.setDescription(c.getString(R.string.channel_message_about));
        message.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager(c).createNotificationChannel(message);
    }

    /**
     * Дохиог эхлүүлнэ (аль хэдийн дуугарч байвал үргэлжилнэ).
     * source — вэб мэдэгдлийн дугаар: түүнийг хаахад (аппад «Хүлээн авлаа» дарсан г.м) дохио зогсоно.
     */
    static synchronized void ring(Context context, String source, String title, long forMs) {
        Context c = context.getApplicationContext();
        createChannels(c);
        prefs(c).edit().putString(KEY_SOURCE, source).apply();
        raiseVolume(c);
        post(c, title, forMs);
        vibrate(c, Math.min(forMs, VIBRATE_SECONDS * 1000L));
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (source.equals(prefs(c).getString(KEY_SOURCE, null)) && !isSounding(c)) post(c, title, forMs);
        }, CHECK_MS);
    }

    private static void post(Context c, String title, long forMs) {
        Intent open = MainActivity.openIntent(c);
        Intent screen = new Intent(c, AlarmActivity.class)
                .putExtra(AlarmActivity.EXTRA_TITLE, title)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent stop = new Intent(c, StopReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent stopIntent = PendingIntent.getBroadcast(c, 0, stop, flags);

        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(c.getColor(R.color.red))
                .setContentTitle(c.getString(R.string.alarm_title))
                .setContentText(title)
                .setStyle(new Notification.BigTextStyle().bigText(title))
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(PendingIntent.getActivity(c, 0, open, flags))
                .setFullScreenIntent(PendingIntent.getActivity(c, 1, screen, flags), true)
                .setDeleteIntent(stopIntent)
                .addAction(new Notification.Action.Builder(null, c.getString(R.string.alarm_stop), stopIntent).build())
                .setTimeoutAfter(forMs)
                .build();
        // Цуцлах хүртэл дууг давтана
        n.flags |= Notification.FLAG_INSISTENT;
        manager(c).notify(TAG, ID, n);
    }

    static synchronized void stop(Context context) {
        Context c = context.getApplicationContext();
        manager(c).cancel(TAG, ID);
        prefs(c).edit().remove(KEY_SOURCE).apply();
        vibrator(c).cancel();
        restoreVolume(c);
        Runnable close = onStop;
        if (close != null) new Handler(Looper.getMainLooper()).post(close);
    }

    /** Вэб мэдэгдэл хаагдахад (хүлээн авсан, дарсан) түүний дохио зогсоно; өөр мэдээллийн дохио үргэлжилнэ */
    static void stopFor(Context c, String source) {
        if (source.equals(prefs(c).getString(KEY_SOURCE, null))) stop(c);
    }

    /** Дохио дуугарч байсан утас унтарч ассан г.м тохиолдолд сэрүүлгийн дууны түвшинг буцаана */
    static void tidy(Context c) {
        if (!isPosted(c)) restoreVolume(c);
    }

    static boolean isPosted(Context c) {
        for (StatusBarNotification n : manager(c).getActiveNotifications()) {
            if (n.getId() == ID && TAG.equals(n.getTag())) return true;
        }
        return false;
    }

    /** Сэрүүлгийн дуугаар ямар нэг зүйл яг одоо дуугарч байгаа эсэх */
    static boolean isSounding(Context c) {
        for (AudioPlaybackConfiguration p : c.getSystemService(AudioManager.class).getActivePlaybackConfigurations()) {
            if (p.getAudioAttributes().getUsage() == AudioAttributes.USAGE_ALARM) return true;
        }
        return false;
    }

    /** Сэрүүлгийн дууг дээд хэмжээнд хүргэнэ (хэрэглэгч 0 болгосон ч); дохио зогсоход буцаана */
    private static void raiseVolume(Context c) {
        AudioManager audio = c.getSystemService(AudioManager.class);
        int now = audio.getStreamVolume(AudioManager.STREAM_ALARM);
        if (!prefs(c).contains(KEY_VOLUME)) prefs(c).edit().putInt(KEY_VOLUME, now).apply();
        setVolume(audio, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM));
    }

    private static void restoreVolume(Context c) {
        if (!prefs(c).contains(KEY_VOLUME)) return;
        setVolume(c.getSystemService(AudioManager.class), prefs(c).getInt(KEY_VOLUME, 0));
        prefs(c).edit().remove(KEY_VOLUME).apply();
    }

    private static void setVolume(AudioManager audio, int volume) {
        try {
            audio.setStreamVolume(AudioManager.STREAM_ALARM, volume, 0);
        } catch (SecurityException e) {
            // Зарим «Бүү саад бол» горимд апп дууны түвшин өөрчилж чадахгүй — дохио одоогийн түвшнээр дуугарна
            Log.w(LOG, "Сэрүүлгийн дууны түвшинг өөрчилж чадсангүй", e);
        }
    }

    private static Vibrator vibrator(Context c) {
        return c.getSystemService(Vibrator.class);
    }

    private static void vibrate(Context c, long forMs) {
        Vibrator v = vibrator(c);
        if (!v.hasVibrator()) return;
        int cycles = (int) Math.max(1, forMs / 1200);
        long[] pattern = new long[cycles * 2];
        for (int i = 0; i < cycles; i++) {
            pattern[i * 2] = i == 0 ? 0 : 400;
            pattern[i * 2 + 1] = 800;
        }
        v.vibrate(VibrationEffect.createWaveform(pattern, -1), alarmAudio());
    }
}

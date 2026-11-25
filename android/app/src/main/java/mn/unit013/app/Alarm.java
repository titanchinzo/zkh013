package mn.unit013.app;

import android.app.AlarmManager;
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
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.service.notification.StatusBarNotification;
import android.util.Log;

/**
 * Улаан дохио. Сэрүүлэг, «Find My Device» шиг AlarmService өөрөө сэрүүлгийн сувгаар (USAGE_ALARM) дуугаргана: утасны хонх,
 * мэдэгдлийн дуу хаалттай, апп хаалттай ч дуугарна. Систем үйлчилгээг эхлүүлэхийг зөвшөөрөхгүй, эсвэл дуу гараагүй бол
 * дуутай мэдэгдлээр («Улаан дохио» суваг) дуугаргаж үзнэ. Зогсоох товч, шудрах, хугацаа дуусах, «Хүлээн авлаа»-гаар зогсоно.
 */
final class Alarm {
    /** Дуутай мэдэгдэл — зөвхөн үйлчилгээ дуугаргаж чадаагүй үед */
    static final String CHANNEL = "red_alarm";
    /** Үйлчилгээний мэдэгдэл: дуу нь тусдаа тул сувагт дуу байхгүй */
    static final String SERVICE_CHANNEL = "red_alarm_service";
    /** Улаан мэдээллийн бичвэр: дуугүй суваг — дохиотой зэрэг дуугарахгүй */
    static final String MESSAGE_CHANNEL = "red_message";
    static final String TAG = "red_alarm";
    static final int ID = 13;
    static final int SERVICE_ID = 14;

    static final long RING_MS = 5 * 60_000;
    static final long TEST_MS = 20_000;
    /** Ийм хугацааны дараа дуугарсан эсэхийг шалгана */
    static final long CHECK_MS = 2_500;

    private static final String LOG = "zkh013";
    private static final String PREFS = "alarm";
    private static final String KEY_SOURCE = "source";
    private static final String KEY_VOLUME = "volume";
    private static final String KEY_FILTER = "filter";
    private static final int VIBRATE_SECONDS = 60;

    /** Дохионы дэлгэц нээлттэй бол зогсоход хаагдана */
    static Runnable onStop;

    /** Үйлчилгээ эхлүүлэх арга (тестэд солино) */
    interface Starter {
        void start(Context c, Intent service);
    }

    static Starter starter = Context::startForegroundService;

    private Alarm() {}

    static NotificationManager manager(Context c) {
        return c.getSystemService(NotificationManager.class);
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static AudioAttributes alarmAudio() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    static void createChannels(Context c) {
        // «Бүү саад бол» горимын эрх өгсөн бол тэр горимыг ч давна
        boolean bypass = manager(c).isNotificationPolicyAccessGranted();

        NotificationChannel service = new NotificationChannel(
                SERVICE_CHANNEL, c.getString(R.string.channel_alarm), NotificationManager.IMPORTANCE_HIGH);
        service.setDescription(c.getString(R.string.channel_alarm_about));
        service.setSound(null, null);
        service.enableVibration(false);
        service.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        service.setBypassDnd(bypass);
        manager(c).createNotificationChannel(service);

        NotificationChannel alarm = new NotificationChannel(
                CHANNEL, c.getString(R.string.channel_backup), NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription(c.getString(R.string.channel_backup_about));
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
        alarm.setBypassDnd(bypass);
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
        openDnd(c);
        raiseVolume(c);
        vibrate(c, Math.min(forMs, VIBRATE_SECONDS * 1000L));
        Diary.add(c, "Дохио эхэллээ");
        startSiren(c, title, forMs);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!source.equals(prefs(c).getString(KEY_SOURCE, null))) return;
            boolean sounding = isSounding(c);
            AudioManager audio = c.getSystemService(AudioManager.class);
            Diary.add(c, (sounding ? "Дуугарч байна" : "ДУУГАРСАНГҮЙ") + " · сэрүүлэг " + audio.getStreamVolume(AudioManager.STREAM_ALARM)
                    + "/" + audio.getStreamMaxVolume(AudioManager.STREAM_ALARM) + " · хонх " + audio.getRingerMode()
                    + " · DND " + manager(c).getCurrentInterruptionFilter());
            if (!sounding) postWithSound(c, title, forMs);
        }, CHECK_MS);
    }

    private static void startSiren(Context c, String title, long forMs) {
        Intent service = AlarmService.intent(c, title, forMs);
        try {
            starter.start(c, service);
            return;
        } catch (RuntimeException e) {
            // Android 12+: апп хаалттай үед шууд эхлүүлэхийг хориглож болно (батарейн хязгаарлалтаас чөлөөлөөгүй г.м)
            Diary.add(c, "Шууд эхлүүлэхийг хориглосон: " + e.getClass().getSimpleName());
        }
        try {
            // Сэрүүлэг шиг: яг одоо болох сэрүүлгээс үйлчилгээ эхлүүлэхийг систем зөвшөөрдөг
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            PendingIntent show = PendingIntent.getActivity(c, 0, MainActivity.openIntent(c), flags);
            c.getSystemService(AlarmManager.class).setAlarmClock(
                    new AlarmManager.AlarmClockInfo(System.currentTimeMillis() + 100, show),
                    PendingIntent.getForegroundService(c, 2, service, flags));
        } catch (RuntimeException e) {
            Diary.add(c, "Сэрүүлгээр эхлүүлж чадсангүй: " + e.getClass().getSimpleName());
            postWithSound(c, title, forMs);
        }
    }

    static Notification build(Context c, String channel, String title) {
        Intent screen = new Intent(c, AlarmActivity.class)
                .putExtra(AlarmActivity.EXTRA_TITLE, title)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent stop = PendingIntent.getBroadcast(c, 0, new Intent(c, StopReceiver.class), flags);
        Notification.Builder builder = new Notification.Builder(c, channel);
        // Систем үйлчилгээний мэдэгдлийг 10 секунд хүлээлгэхгүй, шууд харуулна
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return builder
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(c.getColor(R.color.red))
                .setContentTitle(c.getString(R.string.alarm_title))
                .setContentText(title)
                .setStyle(new Notification.BigTextStyle().bigText(title))
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(PendingIntent.getActivity(c, 0, MainActivity.openIntent(c), flags))
                .setFullScreenIntent(PendingIntent.getActivity(c, 1, screen, flags), true)
                .setDeleteIntent(stop)
                .addAction(new Notification.Action.Builder(null, c.getString(R.string.alarm_stop), stop).build())
                .build();
    }

    /** Нөөц арга: систем «Улаан дохио» сувгийн дуугаар (мөн сэрүүлгийн суваг) давтан дуугаргана */
    static void postWithSound(Context c, String title, long forMs) {
        Notification n = Notification.Builder.recoverBuilder(c, build(c, CHANNEL, title)).setTimeoutAfter(forMs).build();
        // Цуцлах хүртэл дууг давтана
        n.flags |= Notification.FLAG_INSISTENT;
        manager(c).notify(TAG, ID, n);
    }

    static synchronized void stop(Context context) {
        Context c = context.getApplicationContext();
        if (isActive(c)) Diary.add(c, "Дохио зогслоо");
        prefs(c).edit().remove(KEY_SOURCE).apply();
        // Эхэлж амжаагүй үйлчилгээг гаднаас зогсоовол систем апп-ыг унагадаг — тэр өөрөө KEY_SOURCE-ийг хараад зогсоно
        if (AlarmService.running) c.stopService(new Intent(c, AlarmService.class));
        manager(c).cancel(TAG, ID);
        vibrator(c).cancel();
        restoreVolume(c);
        restoreDnd(c);
        Runnable close = onStop;
        if (close != null) new Handler(Looper.getMainLooper()).post(close);
    }

    /** Вэб мэдэгдэл хаагдахад (хүлээн авсан, дарсан) түүний дохио зогсоно; өөр мэдээллийн дохио үргэлжилнэ */
    static void stopFor(Context c, String source) {
        if (source.equals(prefs(c).getString(KEY_SOURCE, null))) stop(c);
    }

    /** Дохио эхэлсэн, зогсоогүй */
    static boolean isActive(Context c) {
        return prefs(c).contains(KEY_SOURCE);
    }

    /** Дохио дуугарч байсан утас унтарч ассан г.м тохиолдолд сэрүүлгийн дуу, «Бүү саад бол» горимыг буцаана */
    static void tidy(Context c) {
        if (AlarmService.running || isPosted(c)) return;
        restoreVolume(c);
        restoreDnd(c);
    }

    /** Нөөц, дуутай мэдэгдэл гарсан эсэх */
    static boolean isPosted(Context c) {
        for (StatusBarNotification n : manager(c).getActiveNotifications()) {
            if (n.getId() == ID && TAG.equals(n.getTag())) return true;
        }
        return false;
    }

    /** Сэрүүлгийн сувгаар ямар нэг зүйл яг одоо дуугарч байгаа эсэх */
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

    /**
     * «Бүү саад бол» горим сэрүүлгийг ч хаасан бол (бүрэн чимээгүй) дохионы хугацаанд «зөвхөн сэрүүлэг» болгоно. Android 15-аас
     * систем апп-д үүнийг зөвшөөрөхгүй.
     */
    private static void openDnd(Context c) {
        NotificationManager nm = manager(c);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM || !nm.isNotificationPolicyAccessGranted()) return;
        int filter = nm.getCurrentInterruptionFilter();
        boolean muted = filter == NotificationManager.INTERRUPTION_FILTER_NONE
                || (filter == NotificationManager.INTERRUPTION_FILTER_PRIORITY && !alarmsAllowed(nm));
        if (!muted) return;
        if (!prefs(c).contains(KEY_FILTER)) prefs(c).edit().putInt(KEY_FILTER, filter).apply();
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS);
    }

    private static boolean alarmsAllowed(NotificationManager nm) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return true;
        return (nm.getNotificationPolicy().priorityCategories & NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS) != 0;
    }

    private static void restoreDnd(Context c) {
        if (!prefs(c).contains(KEY_FILTER)) return;
        int filter = prefs(c).getInt(KEY_FILTER, NotificationManager.INTERRUPTION_FILTER_ALL);
        prefs(c).edit().remove(KEY_FILTER).apply();
        NotificationManager nm = manager(c);
        if (nm.isNotificationPolicyAccessGranted()) nm.setInterruptionFilter(filter);
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

package mn.unit013.app;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.io.IOException;

/**
 * Дохиог сэрүүлэг шиг өөрөө дуугаргадаг үйлчилгээ: дуугүй, чичиргээний горимд ч, апп хаалттай ч дуугарна. Мэдэгдлийн
 * дуунаас тусдаа тул утас мэдэгдлийн дууг хаасан ч (Samsung г.м) нөлөөлөхгүй.
 */
public class AlarmService extends Service {
    private static final String EXTRA_TITLE = "title";
    private static final String EXTRA_FOR = "for";

    /** startForeground дуудагдсан — түүнээс өмнө зогсоовол систем апп-ыг унагадаг */
    static volatile boolean running;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeUp = () -> Alarm.stop(this);
    MediaPlayer player;

    static Intent intent(Context c, String title, long forMs) {
        return new Intent(c, AlarmService.class).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_FOR, forMs);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent == null ? null : intent.getStringExtra(EXTRA_TITLE);
        long forMs = intent == null ? Alarm.TEST_MS : intent.getLongExtra(EXTRA_FOR, Alarm.RING_MS);
        if (title == null) title = getString(R.string.alarm_fallback);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(Alarm.SERVICE_ID, Alarm.build(this, Alarm.SERVICE_CHANNEL, title), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(Alarm.SERVICE_ID, Alarm.build(this, Alarm.SERVICE_CHANNEL, title));
            }
            running = true;
        } catch (RuntimeException e) {
            Diary.add(this, "Үйлчилгээ эхэлж чадсангүй: " + e.getClass().getSimpleName());
            if (Alarm.isActive(this)) Alarm.postWithSound(this, title, forMs);
            stopSelf();
            return START_NOT_STICKY;
        }
        // Эхлэх хооронд хүлээн авсан, зогсоосон
        if (!Alarm.isActive(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!play()) Alarm.postWithSound(this, title, forMs);
        handler.removeCallbacks(timeUp);
        handler.postDelayed(timeUp, forMs);
        return START_NOT_STICKY;
    }

    private boolean play() {
        if (player != null) return true;
        MediaPlayer p = new MediaPlayer();
        try (AssetFileDescriptor siren = getResources().openRawResourceFd(R.raw.siren)) {
            p.setAudioAttributes(Alarm.alarmAudio());
            p.setDataSource(siren.getFileDescriptor(), siren.getStartOffset(), siren.getLength());
            p.setLooping(true);
            p.setVolume(1f, 1f);
            p.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            p.prepare();
            p.start();
            player = p;
            return true;
        } catch (IOException | RuntimeException e) {
            p.release();
            Diary.add(this, "Дуу тоглуулж чадсангүй: " + e.getClass().getSimpleName());
            return false;
        }
    }

    boolean isPlaying() {
        return player != null && player.isPlaying();
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacks(timeUp);
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

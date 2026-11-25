package mn.unit013.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Looper;
import android.os.Vibrator;
import android.service.notification.StatusBarNotification;

import androidx.test.core.app.ApplicationProvider;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;
import org.robolectric.shadows.ShadowMediaPlayer;

import java.io.InputStream;
import java.util.Collections;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class AlarmTest {
    private static final String ORIGIN = "p#https://unit013.mn/#1";
    private static final String RED = "🔴 ";

    private Application app;
    private NotificationManager nm;
    private AudioManager audio;
    private AlarmDelegationService chrome;

    @Before
    public void setUp() {
        app = ApplicationProvider.getApplicationContext();
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        nm = app.getSystemService(NotificationManager.class);
        audio = app.getSystemService(AudioManager.class);
        audio.setStreamVolume(AudioManager.STREAM_ALARM, 1, 0);
        chrome = Robolectric.setupService(AlarmDelegationService.class);
        ShadowMediaPlayer.setMediaInfoProvider(source -> new ShadowMediaPlayer.MediaInfo(6000, 0));
    }

    @After
    public void tearDown() {
        Alarm.starter = Context::startForegroundService;
        AlarmService.running = false;
    }

    private Notification web(String title) {
        return new Notification.Builder(app, "chrome").setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText("текст").build();
    }

    private boolean push(String tag, String title) {
        return chrome.onNotifyNotificationWithChannel(ORIGIN + tag, -1, web(title), "General");
    }

    private StatusBarNotification posted(String tag, int id) {
        for (StatusBarNotification n : nm.getActiveNotifications()) if (n.getId() == id && tag.equals(n.getTag())) return n;
        return null;
    }

    /** Нөөц: дуутай мэдэгдэл */
    private Notification backup() {
        StatusBarNotification n = posted(Alarm.TAG, Alarm.ID);
        return n == null ? null : n.getNotification();
    }

    private int volume() {
        return audio.getStreamVolume(AudioManager.STREAM_ALARM);
    }

    private int maxVolume() {
        return audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
    }

    private Intent started() {
        Intent i = shadowOf(app).getNextStartedService();
        return i != null && i.getComponent() != null && AlarmService.class.getName().equals(i.getComponent().getClassName()) ? i : null;
    }

    private ServiceController<AlarmService> run(Intent service) {
        return Robolectric.buildService(AlarmService.class, service).create().startCommand(0, 1);
    }

    private void sounding(boolean yes) {
        AudioAttributes alarm = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
        shadowOf(audio).setActivePlaybackConfigurationsFor(yes ? Collections.singletonList(alarm) : Collections.emptyList());
    }

    private void afterCheck() {
        shadowOf(Looper.getMainLooper()).idleFor(Alarm.CHECK_MS + 100, TimeUnit.MILLISECONDS);
    }

    @Test
    public void redAlertStartsTheAlarmService() {
        audio.setRingerMode(AudioManager.RINGER_MODE_SILENT);
        assertTrue(push("alert-1", RED + "Түгшүүр"));
        Intent i = started();
        assertNotNull("үйлчилгээ эхэлсэн", i);
        assertEquals("Түгшүүр", i.getStringExtra("title"));
        assertEquals(Alarm.RING_MS, i.getLongExtra("for", 0));
        assertEquals("сэрүүлгийн дуу дээд хэмжээнд", maxVolume(), volume());
        assertTrue(shadowOf(app.getSystemService(Vibrator.class)).isVibrating());
        assertNull("нөөц мэдэгдэл шууд гарахгүй", backup());
    }

    @Test
    public void serviceRingsLikeAnAlarmClock() {
        push("alert-1", RED + "Түгшүүр");
        ServiceController<AlarmService> c = run(started());
        AlarmService s = c.get();
        assertTrue("дуугарч байна", s.isPlaying());
        assertTrue("давтагдана", s.player.isLooping());
        assertTrue(AlarmService.running);
        Notification n = shadowOf(s).getLastForegroundNotification();
        assertEquals(Alarm.SERVICE_ID, shadowOf(s).getLastForegroundNotificationId());
        assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK, s.getForegroundServiceType());
        assertEquals(Notification.CATEGORY_ALARM, n.category);
        assertNotNull("бүтэн дэлгэц", n.fullScreenIntent);
        assertEquals("Түгшүүр", n.extras.getCharSequence(Notification.EXTRA_TEXT).toString());
        NotificationChannel channel = nm.getNotificationChannel(n.getChannelId());
        assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.getImportance());
        assertNull("мэдэгдлийн дуу биш, сэрүүлгийн дуу", channel.getSound());
        assertFalse(channel.shouldVibrate());
        // Давтан дохио нэг л дуутай
        MediaPlayer first = s.player;
        s.onStartCommand(AlarmService.intent(app, "Түгшүүр", 3_000), 0, 2);
        assertSame(first, s.player);
        assertTrue(s.isPlaying());
        // Хугацаа дуусахад өөрөө зогсоно
        shadowOf(Looper.getMainLooper()).idleFor(3_100, TimeUnit.MILLISECONDS);
        assertEquals(AlarmService.class.getName(), shadowOf(app).getNextStoppedService().getComponent().getClassName());
        assertFalse(Alarm.isActive(app));
        c.destroy();
        assertFalse(s.isPlaying());
        assertFalse(AlarmService.running);
        assertEquals(1, volume());
    }

    @Test
    public void whenAndroidForbidsTheServiceAnAlarmClockStartsIt() {
        Alarm.starter = (c, i) -> {
            throw new IllegalStateException("хориглосон");
        };
        push("alert-1", RED + "Түгшүүр");
        ShadowAlarmManager.ScheduledAlarm a = shadowOf(app.getSystemService(AlarmManager.class)).peekNextScheduledAlarm();
        assertNotNull("сэрүүлэг товлосон", a);
        assertNotNull("сэрүүлгийн цаг — хориглолтод хамаарахгүй", a.getAlarmClockInfo());
        assertTrue(shadowOf(a.operation).isForegroundService());
        assertEquals(AlarmService.class.getName(), shadowOf(a.operation).getSavedIntent().getComponent().getClassName());
    }

    @Test
    public void silentServiceFallsBackToANotificationWithSound() {
        sounding(false);
        push("alert-1", RED + "Түгшүүр");
        afterCheck();
        Notification n = backup();
        assertNotNull(n);
        assertTrue("дуу давтагдана", (n.flags & Notification.FLAG_INSISTENT) != 0);
        assertEquals(Alarm.RING_MS, n.getTimeoutAfter());
        NotificationChannel channel = nm.getNotificationChannel(n.getChannelId());
        assertEquals(Alarm.CHANNEL, channel.getId());
        assertEquals(AudioAttributes.USAGE_ALARM, channel.getAudioAttributes().getUsage());
        assertEquals("android.resource://mn.unit013.app/raw/siren", channel.getSound().toString());
        assertTrue(Diary.lines(app).contains("ДУУГАРСАНГҮЙ"));
    }

    @Test
    public void soundingServiceNeedsNoFallback() {
        sounding(true);
        push("alert-1", RED + "Түгшүүр");
        afterCheck();
        assertNull(backup());
        assertTrue(Diary.lines(app).contains("Дуугарч байна"));
    }

    @Test
    public void brokenPlayerFallsBackAtOnce() {
        push("alert-1", RED + "Түгшүүр");
        ShadowMediaPlayer.setMediaInfoProvider(source -> {
            throw new IllegalStateException("дуу нээгдсэнгүй");
        });
        AlarmService s = run(started()).get();
        assertFalse(s.isPlaying());
        assertNotNull(backup());
    }

    @Test
    public void messageIsKeptOnASilentChannel() {
        push("alert-1", RED + "Түгшүүр");
        StatusBarNotification message = posted(ORIGIN + "alert-1", -1);
        assertNotNull(message);
        assertEquals(Alarm.MESSAGE_CHANNEL, message.getNotification().getChannelId());
        assertEquals(NotificationManager.IMPORTANCE_LOW, nm.getNotificationChannel(Alarm.MESSAGE_CHANNEL).getImportance());
    }

    @Test
    public void otherNotificationsDoNotRing() {
        push("alert-1", "🟡 Шар");
        push("alert-2", "🟢 Ногоон");
        push("alert-3", "🟡 🔴 гарчигтаа улаантай шар");
        push("chat-user_1", RED + "ийм нэртэй хүний зурвас");
        push("news-1", RED + "мэдээ");
        push("duty", "Харуулын сануулга");
        assertNull(started());
        assertFalse(Alarm.isActive(app));
        assertEquals(1, volume());
        assertNotNull("энгийн мэдэгдэл харагдана", posted(ORIGIN + "chat-user_1", -1));
        assertEquals(
                "бусад мэдэгдэл өндөр ач холбогдолтой суваг",
                NotificationManager.IMPORTANCE_HIGH,
                nm.getNotificationChannel(posted(ORIGIN + "chat-user_1", -1).getNotification().getChannelId()).getImportance());
    }

    @Test
    public void acknowledgingInTheAppStopsIt() {
        push("alert-1", RED + "Түгшүүр");
        run(started());
        chrome.onCancelNotification(ORIGIN + "alert-2", -1);
        assertTrue("өөр мэдээллийг хаахад зогсохгүй", Alarm.isActive(app));
        chrome.onCancelNotification(ORIGIN + "alert-1", -1);
        assertFalse(Alarm.isActive(app));
        assertNotNull("үйлчилгээ зогссон", shadowOf(app).getNextStoppedService());
        assertNull(posted(ORIGIN + "alert-1", -1));
        assertEquals("сэрүүлгийн дууны түвшин буцсан", 1, volume());
        assertFalse(shadowOf(app.getSystemService(Vibrator.class)).isVibrating());
    }

    @Test
    public void stopButtonKeepsTheMessage() {
        push("alert-1", RED + "Түгшүүр");
        run(started());
        new StopReceiver().onReceive(app, new Intent());
        assertFalse(Alarm.isActive(app));
        assertEquals(1, volume());
        assertNotNull(posted(ORIGIN + "alert-1", -1));
        push("alert-1", RED + "Түгшүүр");
        assertNotNull("минут тутмын давталт дахин дуугарна", started());
    }

    @Test
    public void stoppedBeforeTheServiceStarts() {
        push("alert-1", RED + "Түгшүүр");
        Intent i = started();
        Alarm.stop(app);
        assertNull("эхэлж амжаагүй үйлчилгээг гаднаас зогсоохгүй (систем унагадаг)", shadowOf(app).getNextStoppedService());
        AlarmService s = run(i).get();
        assertNotNull("startForeground заавал дуудагдана", shadowOf(s).getLastForegroundNotification());
        assertFalse("дуугарахгүй", s.isPlaying());
        assertTrue(shadowOf(s).isStoppedBySelf());
    }

    @Test
    public void secondRingKeepsTheOriginalVolume() {
        push("alert-1", RED + "Түгшүүр");
        push("alert-1", RED + "Түгшүүр");
        push("alert-2", RED + "Хоёр дахь");
        Alarm.stop(app);
        assertEquals(1, volume());
    }

    @Test
    public void silentAlarmIsRaisedFromZero() {
        audio.setStreamVolume(AudioManager.STREAM_ALARM, 0, 0);
        audio.setRingerMode(AudioManager.RINGER_MODE_SILENT);
        push("alert-1", RED + "Түгшүүр");
        assertEquals(maxVolume(), volume());
        Alarm.stop(app);
        assertEquals(0, volume());
    }

    @Test
    public void totalSilenceIsOpenedForTheAlarmOnly() {
        shadowOf(nm).setNotificationPolicyAccessGranted(true);
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE);
        push("alert-1", RED + "Түгшүүр");
        assertEquals(NotificationManager.INTERRUPTION_FILTER_ALARMS, nm.getCurrentInterruptionFilter());
        push("alert-1", RED + "Түгшүүр");
        Alarm.stop(app);
        assertEquals("хуучин горим", NotificationManager.INTERRUPTION_FILTER_NONE, nm.getCurrentInterruptionFilter());
    }

    @Test
    public void ordinaryDndIsLeftAlone() {
        shadowOf(nm).setNotificationPolicyAccessGranted(true);
        for (int filter : new int[] {NotificationManager.INTERRUPTION_FILTER_ALL, NotificationManager.INTERRUPTION_FILTER_ALARMS}) {
            nm.setInterruptionFilter(filter);
            push("alert-1", RED + "Түгшүүр");
            assertEquals(filter, nm.getCurrentInterruptionFilter());
            Alarm.stop(app);
            assertEquals(filter, nm.getCurrentInterruptionFilter());
        }
    }

    @Test
    public void stoppedAlarmIsNotRepeated() {
        push("alert-1", RED + "Түгшүүр");
        Alarm.stop(app);
        afterCheck();
        assertNull(backup());
        assertEquals(1, volume());
    }

    @Test
    public void volumeIsRestoredAfterAReboot() {
        push("alert-1", RED + "Түгшүүр");
        nm.cancelAll();
        Alarm.tidy(app);
        assertEquals(1, volume());
    }

    @Test
    public void nothingIsShownWithoutPermission() {
        shadowOf(nm).setNotificationsEnabled(false);
        assertFalse(push("alert-1", RED + "Түгшүүр"));
        assertNull(started());
        assertEquals(1, volume());
    }

    @Test
    public void diaryHasNoContent() {
        push("alert-1", RED + "Нууц гарчиг");
        push("chat-user_2abc", "Цэцэгмаа: нууц зурвас");
        String report = Diary.report(app);
        assertTrue(report, report.contains("Chrome → апп: alert (УЛААН)"));
        assertTrue(report, report.contains("Chrome → апп: chat"));
        assertFalse(report, report.contains("Нууц") || report.contains("нууц") || report.contains("Цэцэгмаа") || report.contains("user_2abc"));
        assertTrue(report, report.contains("Мэдэгдэл: тийм") && report.contains("сэрүүлэг: ") && report.contains("Хуучин апп: үгүй"));
        for (int i = 0; i < 100; i++) Diary.add(app, "мөр " + i);
        assertTrue("сүүлийн тэмдэглэлүүд л үлдэнэ", Diary.lines(app).split("\n").length <= 40);
        assertTrue(Diary.lines(app).endsWith("мөр 99"));
    }

    @Test
    public void kindOfANotification() {
        assertEquals("alert", AlarmDelegationService.kind(ORIGIN + "alert-65f0"));
        assertEquals("chat", AlarmDelegationService.kind(ORIGIN + "chat-user_1"));
        assertEquals("бусад", AlarmDelegationService.kind(ORIGIN + "duty"));
        assertEquals("бусад", AlarmDelegationService.kind("p#https://unit013.mn/#0123"));
    }

    @Test
    public void sirenIsALongEnoughWave() throws Exception {
        try (InputStream in = app.getResources().openRawResource(R.raw.siren)) {
            byte[] head = new byte[12];
            assertEquals(12, in.read(head));
            assertEquals("RIFF", new String(head, 0, 4));
            assertEquals("WAVE", new String(head, 8, 4));
            assertTrue(in.available() > 16_000 * 2 * 5);
        }
    }
}

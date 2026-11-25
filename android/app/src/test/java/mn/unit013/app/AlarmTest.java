package mn.unit013.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Looper;
import android.os.Vibrator;
import android.service.notification.StatusBarNotification;

import androidx.test.core.app.ApplicationProvider;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.io.InputStream;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class AlarmTest {
    private static final String ORIGIN = "p#https://unit013.mn/#1";
    private static final String RED = "🔴 ";

    private Application app;
    private NotificationManager nm;
    private AudioManager audio;
    private AlarmDelegationService service;

    @Before
    public void setUp() {
        app = ApplicationProvider.getApplicationContext();
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        nm = app.getSystemService(NotificationManager.class);
        audio = app.getSystemService(AudioManager.class);
        audio.setStreamVolume(AudioManager.STREAM_ALARM, 1, 0);
        service = Robolectric.setupService(AlarmDelegationService.class);
    }

    private Notification web(String title) {
        return new Notification.Builder(app, "chrome").setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText("текст").build();
    }

    private boolean push(String tag, String title) {
        return service.onNotifyNotificationWithChannel(ORIGIN + tag, -1, web(title), "General");
    }

    private StatusBarNotification posted(String tag, int id) {
        for (StatusBarNotification n : nm.getActiveNotifications()) if (n.getId() == id && tag.equals(n.getTag())) return n;
        return null;
    }

    private Notification alarm() {
        StatusBarNotification n = posted(Alarm.TAG, Alarm.ID);
        return n == null ? null : n.getNotification();
    }

    private int volume() {
        return audio.getStreamVolume(AudioManager.STREAM_ALARM);
    }

    @Test
    public void redAlertRingsOnTheAlarmStream() {
        assertTrue(push("alert-1", RED + "Түгшүүр"));
        Notification n = alarm();
        assertNotNull(n);
        assertTrue("дуу давтагдана", (n.flags & Notification.FLAG_INSISTENT) != 0);
        assertEquals(Notification.CATEGORY_ALARM, n.category);
        assertNotNull("бүтэн дэлгэц", n.fullScreenIntent);
        assertEquals("Түгшүүр", n.extras.getCharSequence(Notification.EXTRA_TEXT).toString());
        assertEquals(Alarm.RING_MS, n.getTimeoutAfter());

        NotificationChannel channel = nm.getNotificationChannel(Alarm.CHANNEL);
        assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.getImportance());
        assertEquals(AudioAttributes.USAGE_ALARM, channel.getAudioAttributes().getUsage());
        assertEquals("android.resource://mn.unit013.app/raw/siren", channel.getSound().toString());
        assertFalse("чичиргээ сувагт байхгүй", channel.shouldVibrate());

        assertEquals("сэрүүлгийн дуу дээд хэмжээнд", audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), volume());
        assertTrue(shadowOf(app.getSystemService(Vibrator.class)).isVibrating());
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
        assertNull(alarm());
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
        service.onCancelNotification(ORIGIN + "alert-2", -1);
        assertNotNull("өөр мэдээллийг хаахад зогсохгүй", alarm());
        service.onCancelNotification(ORIGIN + "alert-1", -1);
        assertNull(alarm());
        assertNull(posted(ORIGIN + "alert-1", -1));
        assertEquals("сэрүүлгийн дууны түвшин буцсан", 1, volume());
        assertFalse(shadowOf(app.getSystemService(Vibrator.class)).isVibrating());
    }

    @Test
    public void stopButtonKeepsTheMessage() {
        push("alert-1", RED + "Түгшүүр");
        new StopReceiver().onReceive(app, new Intent());
        assertNull(alarm());
        assertEquals(1, volume());
        assertNotNull(posted(ORIGIN + "alert-1", -1));
        push("alert-1", RED + "Түгшүүр");
        assertNotNull("минут тутмын давталт дахин дуугарна", alarm());
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
        assertEquals(audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), volume());
        Alarm.stop(app);
        assertEquals(0, volume());
    }

    @Test
    public void mutedFirstTryIsRepeated() {
        push("alert-1", RED + "Түгшүүр");
        long first = posted(Alarm.TAG, Alarm.ID).getPostTime();
        nm.cancel(Alarm.TAG, Alarm.ID);
        shadowOf(Looper.getMainLooper()).idleFor(Alarm.CHECK_MS + 100, TimeUnit.MILLISECONDS);
        assertNotNull("дуугараагүй бол дахин өгнө", alarm());
        assertTrue(first >= 0);
    }

    @Test
    public void stoppedAlarmIsNotRepeated() {
        push("alert-1", RED + "Түгшүүр");
        Alarm.stop(app);
        shadowOf(Looper.getMainLooper()).idleFor(Alarm.CHECK_MS + 100, TimeUnit.MILLISECONDS);
        assertNull(alarm());
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
        assertNull(alarm());
        assertEquals(1, volume());
    }

    @Test
    public void sirenIsALongEnoughWave() throws Exception {
        Context c = app;
        try (InputStream in = c.getResources().openRawResource(R.raw.siren)) {
            byte[] head = new byte[12];
            assertEquals(12, in.read(head));
            assertEquals("RIFF", new String(head, 0, 4));
            assertEquals("WAVE", new String(head, 8, 4));
            assertTrue(in.available() > 16_000 * 2 * 5);
        }
    }
}

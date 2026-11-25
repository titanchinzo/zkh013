package mn.unit013.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.Activity;
import android.app.Application;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.test.core.app.ApplicationProvider;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class ScreensTest {
    private Application app;
    private NotificationManager nm;

    @Before
    public void setUp() {
        app = ApplicationProvider.getApplicationContext();
        nm = app.getSystemService(NotificationManager.class);
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        // Өмнөх тестийн нээлттэй үлдсэн цонх энэ тестэд нөлөөлөхгүй
        ReflectionHelpers.setStaticField(LauncherActivity.class, "sLauncherActivitiesAlive", 0);
    }

    private static void collect(View v, List<TextView> out) {
        if (v instanceof TextView) out.add((TextView) v);
        if (v instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) v).getChildCount(); i++) collect(((ViewGroup) v).getChildAt(i), out);
    }

    private static List<String> texts(Activity a) {
        List<TextView> views = new ArrayList<>();
        collect(a.findViewById(android.R.id.content), views);
        List<String> out = new ArrayList<>();
        for (TextView t : views) out.add(t.getText().toString());
        return out;
    }

    private static Button button(Activity a, String text) {
        List<TextView> views = new ArrayList<>();
        collect(a.findViewById(android.R.id.content), views);
        for (TextView t : views) if (t instanceof Button && t.getText().toString().startsWith(text)) return (Button) t;
        return null;
    }

    /** Дүрс, мэдэгдлээс нээхэд систем ийм тэмдэгтэй илгээдэг (үгүй бол LauncherActivity өөрийгөө шинээр эхлүүлнэ) */
    private Intent launch(Uri link) {
        return new Intent(link == null ? Intent.ACTION_MAIN : Intent.ACTION_VIEW, link)
                .setClass(app, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    private void finishSetup() {
        SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
        button(a, "Апп нээх").performClick();
    }

    private void installOldApp() {
        ComponentName activity = new ComponentName("org.chromium.webapk.abc123", "org.chromium.webapk.shell_apk.Main");
        shadowOf(app.getPackageManager()).addActivityIfNotPresent(activity);
        IntentFilter filter = new IntentFilter(Intent.ACTION_VIEW);
        filter.addCategory(Intent.CATEGORY_BROWSABLE);
        filter.addCategory(Intent.CATEGORY_DEFAULT);
        filter.addDataScheme("https");
        filter.addDataAuthority("unit013.mn", null);
        try {
            shadowOf(app.getPackageManager()).addIntentFilterForActivity(activity, filter);
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    @Test
    public void firstStartShowsTheSetup() {
        MainActivity a = Robolectric.buildActivity(MainActivity.class, launch(null)).create().get();
        assertEquals(SetupActivity.class.getName(), shadowOf(a).getNextStartedActivity().getComponent().getClassName());
        assertTrue(a.isFinishing());
    }

    @Test
    public void setupOpensTheAppAndIsNotShownAgain() {
        SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
        button(a, "Апп нээх").performClick();
        assertTrue(SetupActivity.isDone(app));
        assertEquals(MainActivity.class.getName(), shadowOf(a).getNextStartedActivity().getComponent().getClassName());
        assertTrue(a.isFinishing());
    }

    @Test
    public void siteHomeLinkGoesToTheBrowser() {
        finishSetup();
        MainActivity a = Robolectric.buildActivity(MainActivity.class, launch(Uri.parse("https://unit013.mn/"))).create().get();
        Intent started = shadowOf(a).getNextStartedActivity();
        assertEquals(Phone.CHROME, started.getPackage());
        assertEquals("https://unit013.mn/", started.getDataString());
        assertTrue(a.isFinishing());
    }

    @Test
    public void launchUrlCarriesTheVersion() {
        finishSetup();
        ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class, launch(null));
        c.create();
        Uri url = c.get().getLaunchingUrl();
        assertEquals("https://unit013.mn/app?apk=" + BuildConfig.VERSION_CODE, url.toString());
        MainActivity b = Robolectric.buildActivity(MainActivity.class, launch(Uri.parse("https://unit013.mn/app?chat=user_1"))).create().get();
        assertEquals("https://unit013.mn/app?chat=user_1", b.getLaunchingUrl().toString());
    }

    @Test
    public void foreignLinksAreNotOpenedInTheApp() {
        finishSetup();
        // Туршилтын (debuggable) хувилбарт шууд алдаа өгнө, эцсийн хувилбарт үндсэн хаягаа нээнэ
        assertThrows(SecurityException.class,
                () -> Robolectric.buildActivity(MainActivity.class, launch(Uri.parse("https://evil.example/app"))).create());
    }

    @Test
    public void openingTheAppFromTheAlarmStopsIt() {
        finishSetup();
        Alarm.ring(app, "x", "Түгшүүр", Alarm.RING_MS);
        assertTrue(Alarm.isPosted(app));
        Robolectric.buildActivity(MainActivity.class, MainActivity.openIntent(app)).create();
        assertFalse(Alarm.isPosted(app));
    }

    @Test
    public void setupListsWhatIsMissing() {
        shadowOf(nm).setNotificationsEnabled(false);
        SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
        List<String> t = texts(a);
        assertTrue(t.toString(), t.contains("✗ Мэдэгдэл"));
        assertTrue(t.toString(), t.contains("✗ Google Chrome"));
        assertTrue(t.toString(), t.contains("✗ «Бүү саад бол» горим"));
        assertTrue(t.toString(), t.contains("✗ Батарейн хязгаарлалт"));
        assertFalse("хуучин апп байхгүй", t.toString().contains("Хуучин «013 анги» дүрс"));
        assertFalse("Autostart-ын утас биш", t.toString().contains("Autostart"));
    }

    @Test
    public void setupShowsGrantedSteps() {
        shadowOf(nm).setNotificationPolicyAccessGranted(true);
        SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
        List<String> t = texts(a);
        assertTrue(t.toString(), t.contains("✓ Мэдэгдэл"));
        assertTrue(t.toString(), t.contains("✓ «Бүү саад бол» горим"));
        assertTrue(nm.getNotificationChannel(Alarm.CHANNEL).canBypassDnd());
    }

    @Test
    public void oldWebAppIsOfferedForRemoval() {
        installOldApp();
        assertEquals("org.chromium.webapk.abc123", Phone.oldApp(app));
        SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
        assertTrue(texts(a).toString(), texts(a).contains("✗ Хуучин «013 анги» дүрс"));
        button(a, "Устгах").performClick();
        Intent delete = shadowOf(a).getNextStartedActivity();
        assertEquals(Intent.ACTION_DELETE, delete.getAction());
        assertEquals("package:org.chromium.webapk.abc123", delete.getDataString());
    }

    @Test
    public void autostartHintOnTheseMakers() {
        String before = android.os.Build.MANUFACTURER;
        ReflectionHelpers.setStaticField(android.os.Build.class, "MANUFACTURER", "Xiaomi");
        try {
            SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
            assertTrue(texts(a).toString(), texts(a).contains("• Autostart (автоматаар эхлэх)"));
        } finally {
            ReflectionHelpers.setStaticField(android.os.Build.class, "MANUFACTURER", before);
        }
    }

    @Test
    public void testButtonRingsAfterTheDelay() {
        SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
        Button test = button(a, "Дохио турших");
        test.performClick();
        assertFalse(test.isEnabled());
        assertFalse(Alarm.isPosted(app));
        shadowOf(Looper.getMainLooper()).idleFor(5100, TimeUnit.MILLISECONDS);
        assertTrue(Alarm.isPosted(app));
        assertEquals(Alarm.TEST_MS, nm.getActiveNotifications()[0].getNotification().getTimeoutAfter());
        assertTrue(test.isEnabled());
    }

    @Test
    public void alarmScreenShowsTheTitleAndStops() {
        Alarm.ring(app, "x", "Түгшүүр", Alarm.RING_MS);
        Intent intent = new Intent(app, AlarmActivity.class).putExtra(AlarmActivity.EXTRA_TITLE, "Түгшүүр");
        AlarmActivity a = Robolectric.buildActivity(AlarmActivity.class, intent).setup().get();
        assertTrue(texts(a).toString(), texts(a).contains("Түгшүүр"));
        button(a, "Дуу зогсоох").performClick();
        shadowOf(Looper.getMainLooper()).idle();
        assertFalse(Alarm.isPosted(app));
        assertTrue(a.isFinishing());
    }

    @Test
    public void alarmScreenOpensTheApp() {
        Alarm.ring(app, "x", "Түгшүүр", Alarm.RING_MS);
        AlarmActivity a = Robolectric.buildActivity(AlarmActivity.class, new Intent()).setup().get();
        assertTrue(texts(a).toString(), texts(a).contains("Улаан түвшний зарлан мэдээлэл"));
        button(a, "Апп нээх").performClick();
        Intent started = shadowOf(a).getNextStartedActivity();
        assertNotNull(started);
        assertEquals(MainActivity.class.getName(), started.getComponent().getClassName());
        assertEquals("https://unit013.mn/app", started.getDataString());
        assertFalse(Alarm.isPosted(app));
    }

    @Test
    public void alarmScreenClosesWhenStoppedElsewhere() {
        AlarmActivity a = Robolectric.buildActivity(AlarmActivity.class, new Intent()).setup().get();
        assertNotNull(Alarm.onStop);
        Alarm.stop(app);
        shadowOf(Looper.getMainLooper()).idle();
        assertTrue(a.isFinishing());
        assertNull("устгахад дохио эзэнгүй", afterDestroy(a));
    }

    private Runnable afterDestroy(AlarmActivity a) {
        ReflectionHelpers.callInstanceMethod(a, "onDestroy");
        return Alarm.onStop;
    }
}

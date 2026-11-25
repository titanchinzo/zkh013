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
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.test.core.app.ApplicationProvider;

import android.support.customtabs.ICustomTabsService;

import com.google.androidbrowserhelper.trusted.FocusActivity;
import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity;
import com.google.androidbrowserhelper.trusted.NotificationPermissionRequestActivity;
import com.google.androidbrowserhelper.trusted.SharedPreferencesTokenStore;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.shadows.ShadowKeyguardManager;
import org.robolectric.util.ReflectionHelpers;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, shadows = StrictPackageManager.class)
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
    public void siteLinksGoToTheBrowser() {
        finishSetup();
        for (String url : new String[] {"https://unit013.mn", "https://unit013.mn/", "https://unit013.mn/news/abc", "https://unit013.mn/admin/devices?x=1"}) {
            MainActivity a = Robolectric.buildActivity(MainActivity.class, launch(Uri.parse(url))).create().get();
            Intent started = shadowOf(a).getNextStartedActivity();
            assertEquals(Phone.CHROME, started.getPackage());
            assertEquals(url, started.getDataString());
            assertTrue(a.isFinishing());
            ReflectionHelpers.setStaticField(LauncherActivity.class, "sLauncherActivitiesAlive", 0);
        }
    }

    /** Chrome мэдэгдэл дамжуулах апп-ыг сайтын хаягаар (зам нь хоосон эсвэл "/"), аппын хаягаар хайдаг */
    @Test
    public void chromeCanFindTheAppForTheSite() {
        for (String url : new String[] {"https://unit013.mn", "https://unit013.mn/", "https://unit013.mn/app?apk=3", "https://unit013.mn/sign-in"}) {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE).setPackage("mn.unit013.app");
            assertEquals(url, MainActivity.class.getName(),
                    app.getPackageManager().resolveActivity(i, 0) == null ? null : app.getPackageManager().resolveActivity(i, 0).activityInfo.name);
        }
        Intent service = new Intent("android.support.customtabs.trusted.TRUSTED_WEB_ACTIVITY_SERVICE").setPackage("mn.unit013.app");
        assertEquals(AlarmDelegationService.class.getName(), app.getPackageManager().resolveService(service, 0).serviceInfo.name);
    }

    @Test
    public void remainingOldAppBringsTheSetupBack() {
        finishSetup();
        installOldApp();
        MainActivity a = Robolectric.buildActivity(MainActivity.class, launch(null)).create().get();
        assertEquals(SetupActivity.class.getName(), shadowOf(a).getNextStartedActivity().getComponent().getClassName());
        // Тохиргооноос «Апп нээх» дарвал дутуу ч гэсэн нээнэ
        SetupActivity s = Robolectric.setupActivity(SetupActivity.class);
        button(s, "Апп нээх").performClick();
        Intent open = shadowOf(s).getNextStartedActivity();
        assertTrue(open.getBooleanExtra(MainActivity.EXTRA_SKIP_SETUP, false));
        ReflectionHelpers.setStaticField(LauncherActivity.class, "sLauncherActivitiesAlive", 0);
        MainActivity b = Robolectric.buildActivity(MainActivity.class, open).create().get();
        Intent next = shadowOf(b).getNextStartedActivity();
        assertFalse(next != null && next.getComponent() != null && SetupActivity.class.getName().equals(next.getComponent().getClassName()));
    }

    @Test
    public void setupShowsTheDiary() {
        Diary.add(app, "туршилтын тэмдэглэл");
        SetupActivity a = Robolectric.setupActivity(SetupActivity.class);
        assertTrue(texts(a).toString(), texts(a).toString().contains("туршилтын тэмдэглэл") && texts(a).toString().contains("Оношилгоо"));
        button(a, "Хуулах").performClick();
        ClipboardManager clip = app.getSystemService(ClipboardManager.class);
        assertTrue(clip.getPrimaryClip().getItemAt(0).getText().toString().contains("туршилтын тэмдэглэл"));
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
        assertTrue(Alarm.isActive(app));
        Robolectric.buildActivity(MainActivity.class, MainActivity.openIntent(app)).create();
        assertFalse(Alarm.isActive(app));
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
        assertFalse(Alarm.isActive(app));
        shadowOf(Looper.getMainLooper()).idleFor(5100, TimeUnit.MILLISECONDS);
        assertTrue(Alarm.isActive(app));
        Intent service = shadowOf(app).getNextStartedService();
        assertEquals(Alarm.TEST_MS, service.getLongExtra("for", 0));
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
        assertFalse(Alarm.isActive(app));
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
        assertFalse(Alarm.isActive(app));
    }

    @Test
    public void lockedPhoneOpensTheAppOnlyAfterUnlocking() {
        ShadowKeyguardManager guard = shadowOf(app.getSystemService(KeyguardManager.class));
        guard.setKeyguardLocked(true);
        Alarm.ring(app, "x", "Түгшүүр", Alarm.RING_MS);
        AlarmActivity a = Robolectric.buildActivity(AlarmActivity.class, new Intent()).setup().get();
        button(a, "Апп нээх").performClick();
        shadowOf(Looper.getMainLooper()).idle();
        assertFalse("дуу зогссон", Alarm.isActive(app));
        assertFalse("түгжээ тайлуулах цонхны цаана дэлгэц хаагдахгүй", a.isFinishing());
        assertNull("түгжээтэй үед апп нээгдэхгүй", shadowOf(a).getNextStartedActivity());
        guard.setKeyguardLocked(false);
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(MainActivity.class.getName(), shadowOf(a).getNextStartedActivity().getComponent().getClassName());
        assertTrue(a.isFinishing());
    }

    /**
     * LauncherActivity апп нээх бүрд ManageDataLauncherActivity-г идэвхжүүлдэг (setComponentEnabledSetting): манифестэд
     * байхгүй бол жинхэнэ утсан дээр апп унадаг. Robolectric үүнийг шалгадаггүй тул энд шалгана.
     */
    @Test
    public void libraryScreensAreDeclared() throws Exception {
        for (Class<?> c : new Class<?>[] {
            ManageDataLauncherActivity.class, FocusActivity.class, NotificationPermissionRequestActivity.class
        }) {
            assertNotNull(app.getPackageManager().getActivityInfo(
                    new ComponentName(app, c), PackageManager.MATCH_DISABLED_COMPONENTS | PackageManager.GET_META_DATA));
        }
    }

    /** Тохиргооны «Апп нээх» → Chrome-той холбогдох → unit013.mn/app-ыг Trusted Web Activity-аар нээх бүтэн зам */
    @Test
    public void openingTheAppReachesChrome() {
        ApplicationInfo info = new ApplicationInfo();
        info.packageName = Phone.CHROME;
        info.enabled = true;
        PackageInfo chrome = new PackageInfo();
        chrome.packageName = Phone.CHROME;
        chrome.applicationInfo = info;
        // Мэдэгдэл дамжуулах эрхийг гарын үсгээр нь олгодог
        chrome.signingInfo = Shadow.newInstanceOf(SigningInfo.class);
        shadowOf(chrome.signingInfo).setSignatures(new Signature[] {new Signature("c0de")});
        shadowOf(app.getPackageManager()).installPackage(chrome);
        assertTrue(Phone.chromeReady(app));
        ICustomTabsService.Stub service = new FakeChrome();
        shadowOf(app).setComponentNameAndServiceForBindService(new ComponentName(Phone.CHROME, "Service"), service);

        finishSetup();
        ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class, launch(null));
        MainActivity a = c.create().start().resume().get();
        shadowOf(Looper.getMainLooper()).idle();
        Intent bound = shadowOf(app).getNextStartedService();
        assertNotNull("Chrome-ийн үйлчилгээнд холбогдсон", bound);
        assertEquals(Phone.CHROME, bound.getPackage());
        Intent opened = shadowOf(a).getNextStartedActivity();
        assertNotNull("Chrome руу илгээсэн", opened);
        assertEquals(Phone.CHROME, opened.getPackage());
        assertEquals("https://unit013.mn/app?apk=" + BuildConfig.VERSION_CODE, opened.getDataString());
        assertTrue(opened.getBooleanExtra("android.support.customtabs.extra.LAUNCH_AS_TRUSTED_WEB_ACTIVITY", false));
        assertTrue("цаана үлдэхгүй", a.isFinishing());
        assertNotNull("мэдэгдэл дамжуулах эрх Chrome-д олгогдсон", new SharedPreferencesTokenStore(app).load());
    }

    @Test
    public void crashIsShownInTheSetupInsteadOfLooping() {
        finishSetup();
        Crash.save(app, new IllegalStateException("туршилтын алдаа"));
        MainActivity a = Robolectric.buildActivity(MainActivity.class, launch(null)).create().get();
        assertEquals(SetupActivity.class.getName(), shadowOf(a).getNextStartedActivity().getComponent().getClassName());
        SetupActivity s = Robolectric.setupActivity(SetupActivity.class);
        assertTrue(texts(s).toString(), texts(s).toString().contains("туршилтын алдаа"));
        button(s, "Хуулах").performClick();
        ClipboardManager clip = app.getSystemService(ClipboardManager.class);
        assertTrue(clip.getPrimaryClip().getItemAt(0).getText().toString().contains("IllegalStateException"));
        button(s, "Апп нээх").performClick();
        assertFalse("дараагийн нээлтэд дахин саад болохгүй", Crash.isNew(app));
        assertNotNull(Crash.last(app));
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

package mn.unit013.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ShortcutManager;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsCallback;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

/**
 * Аппын дүрс: unit013.mn/app-ыг Chrome-оор бүтэн дэлгэцээр (Trusted Web Activity) нээнэ — нэвтрэлт, утасны бүртгэл,
 * түгжээ, мэдэгдлийн захиалга нь Chrome дахь хуучин вэб апптай ижил. Анх нээхэд тохиргооны дэлгэц гарна.
 */
public class MainActivity extends LauncherActivity {
    private static final String EXTRA_STOP = "stop_alarm";
    private boolean isSite;
    private boolean needsSetup;

    /** Аппыг нээж, дуугарч буй дохиог зогсооно */
    static Intent openIntent(Context c) {
        return new Intent(Intent.ACTION_VIEW, Uri.parse(c.getString(R.string.app_url)))
                .setClass(c, MainActivity.class)
                .putExtra(EXTRA_STOP, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    @Override
    protected void onCreate(Bundle state) {
        Uri link = getIntent().getData();
        isSite = link != null && "/".equals(link.getPath());
        // Анх удаа, эсвэл сая унасан бол (дахин дахин унахгүйн тулд) тохиргооны дэлгэц рүү
        needsSetup = !SetupActivity.isDone(this) || Crash.isNew(this);
        super.onCreate(state);
        // Сангийн нэмдэг «Site settings» товчлол: бүртгэлийг санамсаргүй арилгах боломжтой тул харуулахгүй
        getSystemService(ShortcutManager.class).removeAllDynamicShortcuts();
        if (getIntent().getBooleanExtra(EXTRA_STOP, false)) Alarm.stop(this);
        else Alarm.tidy(this);
        if (isFinishing()) return;
        if (isSite) {
            openSite(link);
            finish();
        } else if (needsSetup) {
            startActivity(new Intent(this, SetupActivity.class));
            finish();
        }
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return !isSite && !needsSetup;
    }

    /** Сайт түр ажиллахгүй үед (5xx г.м) хөтөч апп-ыг унагахыг хүсдэг — энгийн алдааны хуудас л харуулна */
    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new CustomTabsCallback();
    }

    /** Сайтын нүүр хуудасны холбоосыг (unit013.mn) апп биш, хөтөч нээнэ */
    private void openSite(Uri link) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, link).setPackage(Phone.CHROME));
        } catch (ActivityNotFoundException e) {
            // Chrome-гүй утас — нээх хөтөчгүй
        }
    }

    /** Сайт аппын хувилбарыг мэдэж, шинэ хувилбар гарсныг хэлнэ (components/app/android-app.tsx) */
    @Override
    protected Uri getLaunchingUrl() {
        Uri url = super.getLaunchingUrl();
        // Мэдэгдлээс, дохионоос нээсэн хаягийг (/app?chat=… г.м) хэвээр нь үлдээнэ
        if (getIntent().getData() != null) return url;
        return url.buildUpon().appendQueryParameter("apk", String.valueOf(BuildConfig.VERSION_CODE)).build();
    }

    /** Бүртгэл, мэдэгдлийн захиалга нь Chrome-д хадгалагддаг тул өөр хөтөч үндсэн байсан ч Chrome-оор нээнэ */
    @Override
    protected TwaLauncher createTwaLauncher() {
        return Phone.chromeReady(this) ? new TwaLauncher(this, Phone.CHROME) : super.createTwaLauncher();
    }
}

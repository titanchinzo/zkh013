package mn.unit013.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Дохио дуугарахад хэрэгтэй зөвшөөрлүүд — ✓ болгож, дохиог турших дэлгэц. Анх нээхэд болон «Дохионы тохиргоо»-оор. */
public class SetupActivity extends Activity {
    private static final String PREFS = "setup";
    private static final String KEY_DONE = "done";
    private static final int TEST_DELAY_MS = 5_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private LinearLayout steps;

    static boolean isDone(Context c) {
        return c.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_DONE, false);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Alarm.createChannels(this);

        LinearLayout page = Ui.column(this);
        Ui.padForSystemBars(page, Ui.dp(this, 20));
        TextView heading = Ui.text(this, getString(R.string.setup_title), 24, R.color.text);
        heading.setTypeface(Typeface.DEFAULT_BOLD);
        page.addView(heading);
        page.addView(Ui.text(this, getString(R.string.setup_intro), 15, R.color.muted), Ui.spaced(this, 8));
        steps = Ui.column(this);
        page.addView(steps, Ui.spaced(this, 8));

        page.addView(Ui.text(this, getString(R.string.test_about), 15, R.color.muted), Ui.spaced(this, 20));
        Button test = Ui.button(this, getString(R.string.test_start), getColor(R.color.red), 0xFFFFFFFF);
        test.setOnClickListener(v -> startTest(test));
        page.addView(test, Ui.spaced(this, 8));
        Button open = Ui.button(this, getString(R.string.alarm_open), getColor(R.color.primary), getColor(R.color.on_primary));
        open.setOnClickListener(v -> openApp());
        page.addView(open, Ui.spaced(this, 12));

        ScrollView scroll = new ScrollView(this);
        scroll.addView(page);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Тохиргооноос буцах бүрд ✓-г шинэчилнэ; «Бүү саад бол» эрх өгсөн бол сувагт тусгана
        Alarm.createChannels(this);
        Alarm.tidy(this);
        refresh();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] names, int[] results) {
        super.onRequestPermissionsResult(code, names, results);
        // Өмнө нь татгалзсан бол систем асуухаа больдог — тохиргоог нь нээнэ
        if (results.length > 0 && results[0] != PackageManager.PERMISSION_GRANTED
                && !shouldShowRequestPermissionRationale(names[0])) {
            openNotificationSettings();
        }
        refresh();
    }

    private void refresh() {
        steps.removeAllViews();
        NotificationManager nm = Alarm.manager(this);
        if (!Phone.chromeReady(this)) {
            step(false, R.string.step_chrome, R.string.step_chrome_about, R.string.install,
                    () -> go(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + Phone.CHROME))));
        }
        String old = Phone.oldApp(this);
        if (old != null) {
            step(false, R.string.step_old, R.string.step_old_about, R.string.uninstall,
                    () -> go(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + old))));
        }
        boolean allowed = nm.areNotificationsEnabled();
        step(allowed, R.string.step_notifications, R.string.step_notifications_about, R.string.allow, this::askNotifications);
        if (allowed && !channelOk(nm)) {
            step(false, R.string.step_channel, R.string.step_channel_about, R.string.open_settings,
                    () -> go(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                            .putExtra(Settings.EXTRA_CHANNEL_ID, Alarm.CHANNEL)));
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            step(nm.canUseFullScreenIntent(), R.string.step_screen, R.string.step_screen_about, R.string.allow,
                    () -> go(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, self())));
        }
        step(nm.isNotificationPolicyAccessGranted(), R.string.step_dnd, R.string.step_dnd_about, R.string.allow,
                () -> go(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)));
        step(getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName()),
                R.string.step_battery, R.string.step_battery_about, R.string.allow, this::askBattery);
        if (Phone.needsAutostart()) {
            step(null, R.string.step_autostart, R.string.step_autostart_about, R.string.open_settings,
                    () -> go(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, self())));
        }
    }

    /** Хэрэглэгч сувгийн дууг унтраасан, ач холбогдлыг нь бууруулсан эсэх */
    private static boolean channelOk(NotificationManager nm) {
        NotificationChannel channel = nm.getNotificationChannel(Alarm.CHANNEL);
        return channel == null
                || (channel.getImportance() >= NotificationManager.IMPORTANCE_DEFAULT && channel.getSound() != null);
    }

    private Uri self() {
        return Uri.parse("package:" + getPackageName());
    }

    /** ok — null бол шалгах боломжгүй алхам (Autostart) */
    private void step(Boolean ok, int title, int about, int action, Runnable onAction) {
        LinearLayout card = Ui.column(this);
        int pad = Ui.dp(this, 14);
        card.setPadding(pad, pad, pad, pad);
        card.setBackground(Ui.box(this, getColor(R.color.card)));
        boolean done = Boolean.TRUE.equals(ok);
        String mark = done ? "✓ " : ok == null ? "• " : "✗ ";
        TextView name = Ui.text(this, mark + getString(title), 17, done ? R.color.primary : R.color.warning);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(name);
        if (!done) {
            card.addView(Ui.text(this, getString(about), 15, R.color.muted), Ui.spaced(this, 4));
            Button b = Ui.button(this, getString(action), getColor(R.color.primary), getColor(R.color.on_primary));
            b.setOnClickListener(v -> onAction.run());
            card.addView(b, Ui.spaced(this, 10));
        }
        steps.addView(card, Ui.spaced(this, 8));
    }

    private void go(Intent intent) {
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException e) {
            // Зарим утсанд энэ тохиргооны дэлгэц байдаггүй — аппын ерөнхий тохиргоог нээнэ
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, self()));
        }
    }

    private void askNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 1);
        } else {
            openNotificationSettings();
        }
    }

    private void openNotificationSettings() {
        go(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
    }

    // Play Store-ийн дүрэм — энэ апп Play-ээр тархдаггүй; яаралтай дохио унтсан утсанд ч ирэх ёстой
    @SuppressLint("BatteryLife")
    private void askBattery() {
        go(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, self()));
    }

    /** Дэлгэцээ унтрааж, утсаа дуугүй болгох хугацаа өгөөд дохиог дуугаргана */
    private void startTest(Button button) {
        if (!Alarm.manager(this).areNotificationsEnabled()) {
            button.setText(R.string.test_no_permission);
            return;
        }
        button.setEnabled(false);
        button.setText(R.string.test_waiting);
        Context app = getApplicationContext();
        handler.postDelayed(() -> {
            Alarm.ring(app, "test", app.getString(R.string.alarm_test), Alarm.TEST_MS);
            button.setEnabled(true);
            button.setText(R.string.test_start);
        }, TEST_DELAY_MS);
    }

    private void openApp() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_DONE, true).apply();
        startActivity(new Intent(this, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }
}

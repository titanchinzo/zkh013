package mn.unit013.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Бүтэн дэлгэцийн улаан дохио — түгжээтэй дэлгэц дээр ч гарна. Зөвхөн гарчиг: дэлгэрэнгүй нь аппын түгжээний цаана. */
public class AlarmActivity extends Activity {
    static final String EXTRA_TITLE = "title";

    private TextView title;
    private final Runnable close = this::finish;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(content());
        show(getIntent());
        Alarm.onStop = close;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        show(intent);
    }

    @Override
    protected void onDestroy() {
        if (Alarm.onStop == close) Alarm.onStop = null;
        super.onDestroy();
    }

    private void show(Intent intent) {
        String text = intent.getStringExtra(EXTRA_TITLE);
        title.setText(text == null || text.isEmpty() ? getString(R.string.alarm_fallback) : text);
    }

    private LinearLayout content() {
        LinearLayout page = Ui.column(this);
        page.setBackgroundColor(getColor(R.color.red));
        Ui.padForSystemBars(page, Ui.dp(this, 24));

        LinearLayout middle = Ui.column(this);
        middle.setGravity(Gravity.CENTER);
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_siren);
        middle.addView(icon, new LinearLayout.LayoutParams(Ui.dp(this, 96), Ui.dp(this, 96)));
        TextView level = Ui.text(this, getString(R.string.red_level), 16, R.color.text);
        level.setAllCaps(true);
        level.setTypeface(Typeface.DEFAULT_BOLD);
        level.setGravity(Gravity.CENTER);
        middle.addView(level, Ui.spaced(this, 16));
        title = Ui.text(this, "", 28, R.color.text);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        middle.addView(title, Ui.spaced(this, 8));
        TextView hint = Ui.text(this, getString(R.string.alarm_hint), 16, R.color.text);
        hint.setGravity(Gravity.CENTER);
        middle.addView(hint, Ui.spaced(this, 16));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(middle);
        page.addView(scroll, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        Button open = Ui.button(this, getString(R.string.alarm_open), 0xFFFFFFFF, getColor(R.color.red));
        open.setOnClickListener(v -> open());
        page.addView(open, Ui.spaced(this, 16));
        Button stop = Ui.button(this, getString(R.string.alarm_stop), 0x33FFFFFF, 0xFFFFFFFF);
        stop.setOnClickListener(v -> {
            Alarm.stop(this);
            finish();
        });
        page.addView(stop, Ui.spaced(this, 12));
        return page;
    }

    /** Утас түгжээтэй бол эхлээд түгжээг тайлуулна */
    private void open() {
        // Түгжээ тайлуулах цонх гарч байхад энэ дэлгэц хаагдвал тайлах хүсэлт цуцлагдана — апп нээгдтэл хаахгүй
        Alarm.onStop = null;
        Alarm.stop(this);
        KeyguardManager guard = getSystemService(KeyguardManager.class);
        if (!guard.isKeyguardLocked()) {
            launch();
            return;
        }
        guard.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
            @Override
            public void onDismissSucceeded() {
                launch();
            }
        });
    }

    private void launch() {
        startActivity(MainActivity.openIntent(this));
        finish();
    }
}

package mn.unit013.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Хоёр дэлгэцийн энгийн хэсгүүд */
final class Ui {
    private Ui() {}

    static int dp(Context c, int value) {
        return Math.round(value * c.getResources().getDisplayMetrics().density);
    }

    static LinearLayout column(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    static TextView text(Context c, String value, int sp, int color) {
        TextView t = new TextView(c);
        t.setText(value);
        t.setTextSize(sp);
        t.setTextColor(c.getColor(color));
        return t;
    }

    static GradientDrawable box(Context c, int color) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(c, 12));
        return d;
    }

    static Button button(Context c, String label, int background, int color) {
        Button b = new Button(c);
        b.setText(label);
        b.setTextSize(17);
        b.setAllCaps(false);
        b.setTextColor(color);
        b.setStateListAnimator(null);
        b.setMinHeight(dp(c, 52));
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x33000000), box(c, background), null));
        return b;
    }

    static LinearLayout.LayoutParams spaced(Context c, int top) {
        LinearLayout.LayoutParams p =
                new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        p.topMargin = dp(c, top);
        return p;
    }

    /** Дэлгэцийн дээд, доод мөр (цаг, товчнууд), зүсэлтийн цаана юу ч орохгүй */
    static void padForSystemBars(View v, int pad) {
        v.setPadding(pad, pad, pad, pad);
        v.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = i.left;
                top = i.top;
                right = i.right;
                bottom = i.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(pad + left, pad + top, pad + right, pad + bottom);
            return insets;
        });
    }
}

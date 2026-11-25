package mn.unit013.app;

import android.annotation.SuppressLint;
import android.app.Notification;

import androidx.annotation.NonNull;

import com.google.androidbrowserhelper.trusted.DelegationService;
import com.google.androidbrowserhelper.trusted.NotificationUtils;

/**
 * Сайтын мэдэгдэл ирэхэд Chrome (апп хаалттай байсан ч) энэ үйлчилгээг дуудаж, мэдэгдлийг аппын нэрээр харуулдаг.
 * Улаан түвшний зарлан мэдээлэл бол сэрүүлгийн дуугаар дохио өгнө; бусад нь энгийн мэдэгдэл.
 */
public class AlarmDelegationService extends DelegationService {
    // Chrome-ийн мэдэгдлийн дугаар: p#<origin>#1<tag>; зарлан мэдээллийн tag нь alert-<id> (сайтын lib/alerts.ts)
    private static final String ALERT = "#1alert-";
    // Улаан түвшний гарчгийн өмнөх 🔴 (сайтын lib/hr.ts ALERT_LEVEL_MARK)
    private static final String RED_MARK = "🔴";

    static boolean isRed(String platformTag, Notification n) {
        CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
        return platformTag.contains(ALERT) && title != null && title.toString().startsWith(RED_MARK);
    }

    @Override
    @SuppressLint("MissingPermission") // Мэдэгдлийн зөвшөөрлийг areNotificationsEnabled шалгана
    public boolean onNotifyNotificationWithChannel(
            @NonNull String platformTag, int platformId, @NonNull Notification notification, @NonNull String channelName) {
        if (!isRed(platformTag, notification)) {
            return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, channelName);
        }
        if (!NotificationUtils.areNotificationsEnabled(this, channelName)) return false;
        String title = notification.extras.getCharSequence(Notification.EXTRA_TITLE, "").toString();
        Alarm.ring(this, platformTag, title.substring(RED_MARK.length()).trim(), Alarm.RING_MS);
        // Мэдээллийн бичвэр дуугүй сувгаар: дохио зогссон ч жагсаалтад үлдэнэ, дарахад апп нээгдэнэ
        Notification quiet = Notification.Builder.recoverBuilder(this, notification).setChannelId(Alarm.MESSAGE_CHANNEL).build();
        Alarm.manager(this).notify(platformTag, platformId, quiet);
        return true;
    }

    @Override
    public void onCancelNotification(@NonNull String platformTag, int platformId) {
        super.onCancelNotification(platformTag, platformId);
        Alarm.stopFor(this, platformTag);
    }
}

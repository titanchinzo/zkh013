package mn.unit013.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** «Дуу зогсоох» товч, дохионы мэдэгдлийг шудрах, хугацаа дуусах */
public class StopReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Alarm.stop(context);
    }
}

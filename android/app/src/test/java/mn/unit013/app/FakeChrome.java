package mn.unit013.app;

import android.net.Uri;
import android.os.Bundle;
import android.os.IBinder;
import android.support.customtabs.IAuthTabCallback;
import android.support.customtabs.ICustomTabsCallback;
import android.support.customtabs.ICustomTabsService;

import java.util.List;

/** Апп холбогдох Chrome-ийн үйлчилгээний орлогч: ямар ч session-ийг зөвшөөрнө */
class FakeChrome extends ICustomTabsService.Stub {
    @Override
    public boolean warmup(long flags) {
        return true;
    }

    @Override
    public boolean newSession(ICustomTabsCallback callback) {
        return true;
    }

    @Override
    public boolean newSessionWithExtras(ICustomTabsCallback callback, Bundle extras) {
        return true;
    }

    @Override
    public boolean mayLaunchUrl(ICustomTabsCallback callback, Uri url, Bundle extras, List<Bundle> others) {
        return true;
    }

    @Override
    public void prefetch(ICustomTabsCallback callback, Uri url, Bundle options) {}

    @Override
    public void prefetchWithMultipleUrls(ICustomTabsCallback callback, List<Uri> urls, Bundle options) {}

    @Override
    public Bundle extraCommand(String name, Bundle args) {
        return null;
    }

    @Override
    public boolean updateVisuals(ICustomTabsCallback callback, Bundle bundle) {
        return true;
    }

    @Override
    public boolean requestPostMessageChannel(ICustomTabsCallback callback, Uri origin) {
        return false;
    }

    @Override
    public boolean requestPostMessageChannelWithExtras(ICustomTabsCallback callback, Uri origin, Bundle extras) {
        return false;
    }

    @Override
    public int postMessage(ICustomTabsCallback callback, String message, Bundle extras) {
        return 0;
    }

    @Override
    public boolean validateRelationship(ICustomTabsCallback callback, int relation, Uri origin, Bundle extras) {
        return true;
    }

    @Override
    public boolean receiveFile(ICustomTabsCallback callback, Uri uri, int purpose, Bundle extras) {
        return false;
    }

    @Override
    public boolean isEngagementSignalsApiAvailable(ICustomTabsCallback callback, Bundle extras) {
        return false;
    }

    @Override
    public boolean setEngagementSignalsCallback(ICustomTabsCallback callback, IBinder signals, Bundle extras) {
        return false;
    }

    @Override
    public boolean newAuthTabSession(IAuthTabCallback callback, Bundle extras) {
        return false;
    }

    @Override
    public int getInterfaceVersion() {
        return VERSION;
    }
}

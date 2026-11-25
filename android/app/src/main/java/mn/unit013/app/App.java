package mn.unit013.app;

import android.app.Application;

public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        Crash.watch(this);
    }
}

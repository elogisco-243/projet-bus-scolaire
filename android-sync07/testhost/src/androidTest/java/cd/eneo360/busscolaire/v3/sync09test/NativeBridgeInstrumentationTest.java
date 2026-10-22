package cd.eneo360.busscolaire.v3.sync09test;

import android.os.SystemClock;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import cd.eneo360.busscolaire.v3.MainActivity;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.*;

/**
 * Actual WebView JS -> Capacitor 8 bridge -> native SQLCipher/Keystore test.
 * Synthetic local HTML; no network, no student data; no UI-145 integration.
 */
@RunWith(AndroidJUnit4.class)
public final class NativeBridgeInstrumentationTest {
    @Test public void debuggingOptInIsTypedBooleanAndDebugOnly() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                try {
                    android.content.pm.ApplicationInfo info =
                        activity.getPackageManager().getApplicationInfo(
                            activity.getPackageName(),
                            android.content.pm.PackageManager.GET_META_DATA
                        );
                    assertTrue("test APK must be debuggable",
                        (info.flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
                    assertNotNull("debug manifest metadata required", info.metaData);
                    Object actual = info.metaData.get(
                        "org.eneo360.a2sscola.sync08.NATIVE_QUEUE_TEST_ENABLED"
                    );
                    assertEquals("opt-in must be typed Boolean (not text)",
                        Boolean.TRUE, actual);
                } catch (Exception e) {
                    throw new AssertionError("Cannot read native test manifest", e);
                }
            });
        }
    }

    @Test public void javascriptReallyCallsSecureNativePlugin() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            String last = null;
            long deadline = SystemClock.elapsedRealtime() + 70000L;
            while (SystemClock.elapsedRealtime() < deadline) {
                AtomicReference<String> result = new AtomicReference<>();
                CountDownLatch ready = new CountDownLatch(1);
                scenario.onActivity(activity -> {
                    if (activity.getBridge() == null || activity.getBridge().getWebView() == null) {
                        result.set("\"WEBVIEW_UNAVAILABLE\"");
                        ready.countDown();
                        return;
                    }
                    activity.getBridge().getWebView().evaluateJavascript(
                        "String(window.__sync11Result || 'PENDING')",
                        value -> { result.set(value); ready.countDown(); }
                    );
                });
                assertTrue("JS result callback timeout", ready.await(8, TimeUnit.SECONDS));
                last = result.get();
                if ("\"PASS\"".equals(last)) return;
                if (last != null && last.startsWith("\"FAIL:"))
                    fail("Native JS smoke failed: " + last);
                Thread.sleep(300L);
            }
            fail("JS->Native bridge never completed. Last state: " + last);
        }
    }
}

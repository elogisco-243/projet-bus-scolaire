package org.eneo360.a2sscola.sync08;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eneo360.a2sscola.sync07.SqlCipherQueueStore;
import org.json.JSONObject;

/**
 * SYNC-08: development/staging ONLY. Not linked to A2S Scola UI-145.
 * Native storage is accessible exclusively to an explicitly opted-in,
 * debuggable host APK showing the local Capacitor origin HTTPS localhost.
 *
 * A separate trusted identity gate on the server is STILL required.
 * This plugin contains no network functionality and no login/roles.
 */
@CapacitorPlugin(name = "A2SScolaSecureQueue")
public final class ScolaQueuePlugin extends Plugin {
    private static final String OPT_IN =
            "org.eneo360.a2sscola.sync08.NATIVE_QUEUE_TEST_ENABLED";
    private SqlCipherQueueStore store;

    private boolean authorized(PluginCall call) {
        try {
            ApplicationInfo info = getContext().getPackageManager()
                    .getApplicationInfo(getContext().getPackageName(),
                            PackageManager.GET_META_DATA);
            Bundle metadata = info.metaData;
            if ((info.flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0 ||
                    metadata == null || !metadata.getBoolean(OPT_IN, false)) {
                call.reject("NATIVE_QUEUE_DISABLED");
                return false;
            }
            if (getBridge() == null || getBridge().getWebView() == null) {
                call.reject("NATIVE_WEBVIEW_UNAVAILABLE");
                return false;
            }
            // Capacitor dispatches plugin methods off the WebView UI thread.
            // Android WebView.getUrl() is a UI-thread-only operation.
            // Never relax origin validation: obtain the URL on the UI thread.
            String page;
            if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
                page = getBridge().getWebView().getUrl();
            } else {
                java.util.concurrent.atomic.AtomicReference<String> urlRef =
                        new java.util.concurrent.atomic.AtomicReference<>();
                java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(1);
                getActivity().runOnUiThread(() -> {
                    try {
                        urlRef.set(getBridge().getWebView().getUrl());
                    } finally {
                        done.countDown();
                    }
                });
                if (!done.await(3, java.util.concurrent.TimeUnit.SECONDS)) {
                    call.reject("NATIVE_WEBVIEW_CHECK_TIMEOUT");
                    return false;
                }
                page = urlRef.get();
            }
            if (page == null) {
                call.reject("UNTRUSTED_WEBVIEW_ORIGIN");
                return false;
            }
            Uri uri = Uri.parse(page);
            if (!"https".equals(uri.getScheme()) ||
                    !"localhost".equals(uri.getHost()) ||
                    uri.getPort() != -1 ||
                    uri.getUserInfo() != null) {
                call.reject("UNTRUSTED_WEBVIEW_ORIGIN");
                return false;
            }
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            call.reject("NATIVE_WEBVIEW_CHECK_INTERRUPTED");
            return false;
        } catch (Exception e) {
            // Fail closed. Distinct diagnostic code (no exception details to JS).
            call.reject("NATIVE_AUTH_UNAVAILABLE");
            return false;
        }
    }

    private synchronized SqlCipherQueueStore open() throws Exception {
        if (store == null) store = new SqlCipherQueueStore(getContext());
        return store;
    }

    @PluginMethod
    public void inspect(PluginCall call) {
        if (!authorized(call)) return;
        try {
            call.resolve(new JSObject(open().inspect().toString()));
        } catch (Exception e) {
            call.reject("NATIVE_STORAGE_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void acquireLease(PluginCall call) {
        if (!authorized(call)) return;
        String partition = call.getString("partition");
        if (partition == null) { call.reject("PARTITION_REQUIRED"); return; }
        try {
            String token = open().acquireLease(partition);
            JSObject out = new JSObject();
            out.put("token", token);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("NATIVE_LEASE_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        if (!authorized(call)) return;
        String partition = call.getString("partition");
        String token = call.getString("token");
        if (partition == null || token == null) {
            call.reject("NATIVE_LEASE_REQUIRED");
            return;
        }
        try {
            JSONObject state = open().read(partition, token);
            call.resolve(new JSObject(state.toString()));
        } catch (Exception e) {
            call.reject("NATIVE_READ_DENIED");
        }
    }

    @PluginMethod
    public void compareAndSwap(PluginCall call) {
        if (!authorized(call)) return;
        String partition = call.getString("partition");
        String token = call.getString("token");
        JSArray items = call.getArray("items");
        Object revisionValue = call.getData().opt("revision");
        if (partition == null || token == null || items == null ||
                !(revisionValue instanceof Number)) {
            call.reject("NATIVE_CAS_INVALID");
            return;
        }
        long revision = ((Number) revisionValue).longValue();
        if (revision < 0 || ((Number) revisionValue).doubleValue() != (double) revision) {
            call.reject("NATIVE_CAS_INVALID");
            return;
        }
        try {
            JSONObject result = open().compareAndSwap(partition, token, revision, items);
            call.resolve(new JSObject(result.toString()));
        } catch (Exception e) {
            // Deliberately do not return database error details or plaintext.
            call.reject("NATIVE_CAS_REJECTED");
        }
    }

    @PluginMethod
    public void releaseLease(PluginCall call) {
        if (!authorized(call)) return;
        String token = call.getString("token");
        if (token == null) { call.reject("NATIVE_LEASE_REQUIRED"); return; }
        try {
            open().releaseLease(token);
            call.resolve();
        } catch (Exception e) {
            call.reject("NATIVE_LEASE_RELEASE_FAILED");
        }
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (this) {
            if (store != null) {
                try { store.close(); } catch (Exception ignored) { }
                store = null;
            }
        }
        super.handleOnDestroy();
    }
}

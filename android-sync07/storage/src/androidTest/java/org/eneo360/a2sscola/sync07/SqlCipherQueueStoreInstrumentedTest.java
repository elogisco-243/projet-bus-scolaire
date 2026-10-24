package org.eneo360.a2sscola.sync07;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.Assert.*;

/** Must be run on a REAL Android emulator/device. Not run by assembleDebugAndroidTest. */
@RunWith(AndroidJUnit4.class)
public class SqlCipherQueueStoreInstrumentedTest {
    private Context app() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }
    private String newPartition() {
        return "a2s-scola-sync06:" +
                UUID.randomUUID() + ":" + UUID.randomUUID() + ":" +
                UUID.randomUUID() + ":" + UUID.randomUUID();
    }

    @Test public void encryptedFileIsNotPlaintextSqlite() throws Exception {
        try (SqlCipherQueueStore store = new SqlCipherQueueStore(app())) {
            String partition = newPartition();
            String token = store.acquireLease(partition);
            try {
                JSONArray items = new JSONArray();
                items.put(new JSONObject().put("id", UUID.randomUUID().toString())
                        .put("status", "pending").put("type", "board").put("attempts", 0));
                assertEquals(1, store.compareAndSwap(partition, token, 0, items)
                        .getLong("revision"));
                assertEquals(1, store.read(partition, token).getLong("revision"));
            } finally {
                store.releaseLease(token);
            }
        }
        File root = new File(app().getNoBackupFilesDir(), "a2s-scola-sync07");
        assertTrue(new File(root, "key.aesgcm").exists());
        File database = new File(root, "queue.sqlcipher");
        assertTrue(database.exists());
        byte[] header = new byte[16];
        try (FileInputStream fis = new FileInputStream(database)) {
            assertEquals(16, fis.read(header));
        }
        assertFalse("SQLCipher DB must not have clear SQLite header",
                "SQLite format 3\0".equals(new String(header, StandardCharsets.US_ASCII)));
    }

    @Test public void staleRevisionLeavesCommittedQueueUnchanged() throws Exception {
        try (SqlCipherQueueStore store = new SqlCipherQueueStore(app())) {
            String partition = newPartition();
            String token = store.acquireLease(partition);
            try {
                JSONArray items = new JSONArray().put(new JSONObject()
                        .put("id", UUID.randomUUID().toString())
                        .put("status", "pending").put("type", "board").put("attempts", 0));
                store.compareAndSwap(partition, token, 0, items);
                try {
                    store.compareAndSwap(partition, token, 0, new JSONArray());
                    fail("stale revision should fail");
                } catch (IllegalStateException e) {
                    assertEquals("QUEUE_CAS_CONFLICT", e.getMessage());
                }
                assertEquals(1, store.read(partition, token).getLong("revision"));
                assertEquals(1, store.read(partition, token).getJSONArray("items").length());
            } finally {
                store.releaseLease(token);
            }
        }
    }

    @Test public void secondLeaseFailsAndReopenPreservesEncryptedState() throws Exception {
        String partition = newPartition();
        try (SqlCipherQueueStore store = new SqlCipherQueueStore(app())) {
            String token = store.acquireLease(partition);
            try {
                try {
                    store.acquireLease(partition);
                    fail("overlapping lock must fail");
                } catch (IllegalStateException e) {
                    assertEquals("LEASE_BUSY", e.getMessage());
                }
                store.compareAndSwap(partition, token, 0, new JSONArray());
            } finally {
                store.releaseLease(token);
            }
        }
        try (SqlCipherQueueStore reopened = new SqlCipherQueueStore(app())) {
            String token = reopened.acquireLease(partition);
            try {
                assertEquals(1, reopened.read(partition, token).getLong("revision"));
            } finally {
                reopened.releaseLease(token);
            }
        }
    }
}

package org.eneo360.a2sscola.sync07;

import android.content.Context;
import android.database.Cursor;

import net.zetetic.database.sqlcipher.SQLiteDatabase;
import net.zetetic.database.sqlcipher.SQLiteStatement;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.Closeable;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * ISOLATED staging library. NOT connected to Capacitor UI or network.
 *
 * Requires real SQLCipher AAR + AndroidKeyStore; the DB and wrapped secret live
 * in noBackupFilesDir. All writes require a held OS file lock and an optimistic
 * revision check in a single encrypted SQL transaction.
 */
public final class SqlCipherQueueStore implements Closeable {
    private static final Pattern PARTITION = Pattern.compile(
            "^a2s-scola-sync06:(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:){3}" +
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
    private static final int MAX_JSON_BYTES = 8 * 1024 * 1024;
    private final SQLiteDatabase db;
    private final File lockFile;
    private RandomAccessFile lockHandle;
    private FileChannel lockChannel;
    private FileLock lock;
    private String leaseToken;
    private String leasePartition;

    public SqlCipherQueueStore(Context context) throws Exception {
        if (context == null) throw new IllegalArgumentException("CONTEXT_REQUIRED");
        Context app = context.getApplicationContext();
        File base = new File(app.getNoBackupFilesDir(), "a2s-scola-sync07");
        if (!base.isDirectory() && !base.mkdirs()) throw new IllegalStateException("SECURE_DIR_UNAVAILABLE");
        File dbFile = new File(base, "queue.sqlcipher");
        this.lockFile = new File(base, "queue.lease");
        byte[] password = new KeystoreSqlCipherKey(app, base).obtain(dbFile);
        try {
            System.loadLibrary("sqlcipher");
            this.db = SQLiteDatabase.openOrCreateDatabase(dbFile, password, null, null, null);
        } finally {
            Arrays.fill(password, (byte) 0);
        }
        try {
            // No graceful fallback to an unencrypted SQLite database.
            db.rawExecSQL("PRAGMA secure_delete=ON");
            db.execSQL("CREATE TABLE IF NOT EXISTS queue_partitions (" +
                    "partition_key TEXT NOT NULL PRIMARY KEY," +
                    "revision INTEGER NOT NULL CHECK(revision >= 0)," +
                    "items_json TEXT NOT NULL)");
            try (Cursor c = db.rawQuery("PRAGMA quick_check", null)) {
                if (!c.moveToFirst() || !"ok".equalsIgnoreCase(c.getString(0)))
                    throw new IllegalStateException("ENCRYPTED_DATABASE_INVALID");
            }
        } catch (Exception ex) {
            db.close();
            throw ex;
        }
    }

    private static void checkPartition(String name) {
        if (name == null || !PARTITION.matcher(name).matches())
            throw new IllegalArgumentException("INVALID_PARTITION");
    }
    private synchronized void requireLease(String partition, String token) {
        checkPartition(partition);
        if (leaseToken == null || !leaseToken.equals(token) ||
                !leasePartition.equals(partition) || lock == null || !lock.isValid())
            throw new IllegalStateException("LEASE_REQUIRED");
    }

    public synchronized JSONObject inspect() throws JSONException {
        return new JSONObject().put("version", 1)
                .put("provider", "native_encrypted_sqlite")
                .put("atomicRevision", true)
                .put("deviceWideLease", true)
                .put("locked", false);
    }

    public synchronized String acquireLease(String partition) throws Exception {
        checkPartition(partition);
        if (lock != null || leaseToken != null)
            throw new IllegalStateException("LEASE_BUSY");
        RandomAccessFile f = new RandomAccessFile(lockFile, "rw");
        FileChannel channel = f.getChannel();
        FileLock candidate = null;
        try {
            try { candidate = channel.tryLock(); }
            catch (OverlappingFileLockException ex) {
                throw new IllegalStateException("LEASE_BUSY", ex);
            }
            if (candidate == null) throw new IllegalStateException("LEASE_BUSY");
            lockHandle = f;
            lockChannel = channel;
            lock = candidate;
            leasePartition = partition;
            leaseToken = UUID.randomUUID().toString();
            return leaseToken;
        } catch (Exception ex) {
            if (candidate != null) candidate.release();
            channel.close();
            f.close();
            throw ex;
        }
    }

    public synchronized JSONObject read(String partition, String token) throws Exception {
        requireLease(partition, token);
        long revision = 0;
        String json = "[]";
        try (Cursor c = db.rawQuery(
                "SELECT revision, items_json FROM queue_partitions WHERE partition_key=?",
                new String[]{partition})) {
            if (c.moveToFirst()) {
                revision = c.getLong(0);
                json = c.getString(1);
            }
        }
        return new JSONObject().put("revision", revision)
                .put("items", parseItems(json));
    }

    private static JSONArray parseItems(String json) throws JSONException {
        if (json == null || json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_JSON_BYTES)
            throw new IllegalStateException("QUEUE_SIZE_LIMIT");
        JSONArray a = new JSONArray(json);
        if (a.length() > 10000) throw new IllegalStateException("QUEUE_TOO_LARGE");
        return a;
    }

    public synchronized JSONObject compareAndSwap(String partition, String token,
                                                   long expectedRevision, JSONArray items) throws Exception {
        requireLease(partition, token);
        if (expectedRevision < 0 || expectedRevision == Long.MAX_VALUE || items == null)
            throw new IllegalArgumentException("REVISION_OR_ITEMS_INVALID");
        String json = items.toString();
        parseItems(json);
        db.beginTransaction();
        try {
            db.execSQL("INSERT OR IGNORE INTO queue_partitions(partition_key,revision,items_json)" +
                    " VALUES (?,0,'[]')", new Object[]{partition});
            SQLiteStatement stmt = db.compileStatement(
                    "UPDATE queue_partitions SET revision=?,items_json=? " +
                    "WHERE partition_key=? AND revision=?");
            int affected;
            try {
                stmt.bindLong(1, expectedRevision + 1);
                stmt.bindString(2, json);
                stmt.bindString(3, partition);
                stmt.bindLong(4, expectedRevision);
                affected = stmt.executeUpdateDelete();
            } finally {
                stmt.close();
            }
            if (affected != 1) throw new IllegalStateException("QUEUE_CAS_CONFLICT");
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return new JSONObject().put("revision", expectedRevision + 1);
    }

    public synchronized void releaseLease(String token) throws Exception {
        if (leaseToken == null || !leaseToken.equals(token))
            throw new IllegalStateException("LEASE_TOKEN_INVALID");
        try {
            if (lock != null) lock.release();
        } finally {
            try { if (lockChannel != null) lockChannel.close(); }
            finally {
                if (lockHandle != null) lockHandle.close();
                lock = null;lockHandle = null;lockChannel = null;
                leaseToken = null;leasePartition = null;
            }
        }
    }

    @Override public synchronized void close() throws java.io.IOException {
        if (leaseToken != null) {
            try { releaseLease(leaseToken); }
            catch (Exception e) { throw new java.io.IOException("LEASE_RELEASE_FAILED", e); }
        }
        db.close();
    }
}

package org.eneo360.a2sscola.sync07;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Random 256-bit SQLCipher key, wrapped by a NON-EXPORTABLE AndroidKeyStore AES-GCM key.
 * Fail CLOSED on an orphaned encrypted DB or lost/corrupted Keystore key.
 * Never store the plaintext database passphrase on disk and never reset a database.
 */
final class KeystoreSqlCipherKey {
    private static final String ALIAS = "a2s_scola_sync07_db_wrap_v1";
    private static final byte[] MAGIC = "A2S7".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] AAD = "a2s-scola-sync07-database-key-v1".getBytes(StandardCharsets.UTF_8);
    private static final int IV_SIZE = 12;
    private static final int DB_KEY_SIZE = 32;
    private final Context context;
    private final File dir;

    KeystoreSqlCipherKey(Context context, File dir) {
        this.context = context.getApplicationContext();
        this.dir = dir;
    }

    byte[] obtain(File dbFile) throws Exception {
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("SECURE_DIR_UNAVAILABLE");
        AtomicFile wrapped = new AtomicFile(new File(dir, "key.aesgcm"));
        File target = wrapped.getBaseFile();
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);

        // A DB with no wrapped secret MUST NOT be silently overwritten/recreated.
        if (!target.exists() && (dbFile.exists() ||
                new File(dbFile.getPath() + "-wal").exists() ||
                new File(dbFile.getPath() + "-journal").exists()))
            throw new IllegalStateException("DB_KEY_MISSING");
        if (target.exists()) {
            if (!store.containsAlias(ALIAS)) throw new IllegalStateException("KEYSTORE_KEY_LOST");
            SecretKey key = (SecretKey) store.getKey(ALIAS, null);
            if (key == null) throw new IllegalStateException("KEYSTORE_KEY_UNAVAILABLE");
            byte[] blob = wrapped.readFully();
            if (blob.length != MAGIC.length + IV_SIZE + DB_KEY_SIZE + 16)
                throw new IllegalStateException("WRAPPED_KEY_CORRUPT");
            for (int i = 0; i < MAGIC.length; i++)
                if (blob[i] != MAGIC[i]) throw new IllegalStateException("WRAPPED_KEY_VERSION");
            byte[] iv = Arrays.copyOfRange(blob, MAGIC.length, MAGIC.length + IV_SIZE);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            cipher.updateAAD(AAD);
            byte[] decoded = cipher.doFinal(blob, MAGIC.length + IV_SIZE,
                    blob.length - MAGIC.length - IV_SIZE);
            Arrays.fill(blob, (byte) 0);
            if (decoded.length != DB_KEY_SIZE) throw new IllegalStateException("INVALID_DB_KEY");
            return decoded;
        }

        SecretKey key;
        if (store.containsAlias(ALIAS)) {
            key = (SecretKey) store.getKey(ALIAS, null);
            if (key == null) throw new IllegalStateException("KEYSTORE_KEY_UNAVAILABLE");
        } else {
            KeyGenerator generator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build());
            key = generator.generateKey();
        }
        byte[] randomKey = new byte[DB_KEY_SIZE];
        new SecureRandom().nextBytes(randomKey);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            cipher.updateAAD(AAD);
            byte[] ciphertext = cipher.doFinal(randomKey);
            byte[] iv = cipher.getIV();
            if (iv == null || iv.length != IV_SIZE) throw new IllegalStateException("INVALID_GCM_IV");
            byte[] envelope = new byte[MAGIC.length + IV_SIZE + ciphertext.length];
            System.arraycopy(MAGIC, 0, envelope, 0, MAGIC.length);
            System.arraycopy(iv, 0, envelope, MAGIC.length, IV_SIZE);
            System.arraycopy(ciphertext, 0, envelope, MAGIC.length + IV_SIZE, ciphertext.length);
            FileOutputStream stream = null;
            try {
                stream = wrapped.startWrite();
                stream.write(envelope);
                wrapped.finishWrite(stream);
            } catch (Exception ex) {
                if (stream != null) wrapped.failWrite(stream);
                throw ex;
            } finally {
                Arrays.fill(envelope, (byte) 0);
                Arrays.fill(ciphertext, (byte) 0);
            }
            return randomKey;
        } catch (Exception failure) {
            Arrays.fill(randomKey, (byte) 0);
            throw failure;
        }
    }
}

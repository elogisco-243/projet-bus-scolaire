package cd.eneo360.busscolaire.v3;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.eneo360.a2sscola.sync08.ScolaQueuePlugin;

/**
 * SYNTHETIC smoke host ONLY, never replace the user's actual MainActivity.
 * Capacitor 8 registration order: before super.onCreate.
 */
public final class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScolaQueuePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

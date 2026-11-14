package com.sustainablesolution360.match360;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15 draws apps edge to edge by default. Enabling it explicitly gives every Android version the same
        // layout; the web content keeps clear of the system bars with CSS safe-area insets (SystemBars, insetsHandling: css).
        // It must come after super.onCreate: before it, the window is still built with the launch (splash) theme and
        // keeps a title bar painted with the splash image.
        EdgeToEdge.enable(this);
    }
}

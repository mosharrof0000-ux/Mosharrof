#!/usr/bin/env bash
set -euo pipefail

cat > android/app/src/main/java/com/mosharrof/ai/VoiceQuickSettingsTile.java <<'JAVA'
package com.mosharrof.ai;

import android.content.Intent;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

public class VoiceQuickSettingsTile extends TileService {
    @Override public void onStartListening() {
        super.onStartListening();
        Tile tile = getQsTile();
        if (tile != null) {
            tile.setLabel("MOSHARROF Voice");
            tile.setState(Tile.STATE_ACTIVE);
            tile.updateTile();
        }
    }
    @Override public void onClick() {
        super.onClick();
        Intent voice = new Intent(this, VoiceCommandActivity.class);
        voice.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivityAndCollapse(voice);
    }
}
JAVA

echo "Android global voice manager sources: PASS"

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
        Intent chat = new Intent(this, MainActivity.class);
        chat.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        chat.putExtra("mosharrof_start_chat_voice", true);
        startActivityAndCollapse(chat);
    }
}
JAVA

echo "Android global voice manager sources: PASS"

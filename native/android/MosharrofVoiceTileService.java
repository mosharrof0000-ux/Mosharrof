package com.mosharrof.ai;

import android.content.Intent;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Quick Settings shortcut that opens MOSHARROF and requests the voice composer. */
public final class MosharrofVoiceTileService extends TileService {
    @Override public void onStartListening() {
        super.onStartListening();
        Tile tile = getQsTile();
        if (tile != null) {
            tile.setLabel("MOSHARROF AI");
            tile.setSubtitle("কথা বলুন");
            tile.setState(Tile.STATE_INACTIVE);
            tile.updateTile();
        }
    }

    @Override public void onClick() {
        super.onClick();
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("com.mosharrof.ai.OPEN_VOICE");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivityAndCollapse(intent);
    }
}

package com.mosharrof.ai;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.os.Build;
import android.util.Rational;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FloatingChat")
public class FloatingChatPlugin extends Plugin {
    @PluginMethod
    public void enterPictureInPicture(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("MOSHARROF activity is not available");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Android Picture-in-Picture requires Android 8.0 or newer");
            return;
        }
        try {
            PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(9, 16));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(true);
                builder.setSeamlessResizeEnabled(true);
            }
            PictureInPictureParams params = builder.build();
            boolean entered = activity.enterPictureInPictureMode(params);
            if (!entered) {
                call.reject("Android could not enter floating chat mode");
                return;
            }
            JSObject result = new JSObject();
            result.put("mode", "picture-in-picture");
            result.put("usesExistingActivity", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not open floating chat: " + error.getMessage(), error);
        }
    }
}

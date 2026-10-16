package com.mosharrof.ai;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens user-editable communication drafts only. Never places calls or sends messages. */
@CapacitorPlugin(name = "DeviceCommunication")
public class DeviceCommunicationPlugin extends Plugin {
    @PluginMethod public void prepareCall(PluginCall call) {
        String number = call.getString("number");
        if (number == null || !number.trim().matches("[+0-9(). *#-]{3,25}")) {
            call.reject("ফোন নম্বরটি ঠিক নয়।"); return;
        }
        openDraft(call, new Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number.trim(), null)));
    }

    @PluginMethod public void prepareSms(PluginCall call) {
        String number = call.getString("number"), body = call.getString("body");
        if (number == null || !number.trim().matches("[+0-9(). *#-]{3,25}") ||
            body == null || body.trim().isEmpty() || body.length() > 4000) {
            call.reject("নম্বর বা SMS বার্তাটি ঠিক নয়।"); return;
        }
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number.trim())));
        intent.putExtra("sms_body", body);
        openDraft(call, intent);
    }

    @PluginMethod public void prepareEmail(PluginCall call) {
        String to = call.getString("to"), subject = call.getString("subject"), body = call.getString("body");
        if (to == null || !to.trim().matches("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}") ||
            (subject != null && subject.length() > 200) || (body != null && body.length() > 10000)) {
            call.reject("ইমেইল ঠিকানা বা খসড়াটি ঠিক নয়।"); return;
        }
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + Uri.encode(to.trim())));
        intent.putExtra(Intent.EXTRA_SUBJECT, subject == null ? "" : subject);
        intent.putExtra(Intent.EXTRA_TEXT, body == null ? "" : body);
        openDraft(call, intent);
    }

    private void openDraft(PluginCall call, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("userMediated", true);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("এই কাজের জন্য উপযুক্ত ফোন, SMS বা ইমেইল অ্যাপ পাওয়া যায়নি।", error);
        }
    }
}
package com.dkbranch;

import android.app.Activity;
import android.content.Intent;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class AppModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public AppModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "AppModule";
    }

    /**
     * Minimizes the app by moving the task to back
     * This simulates pressing the Home button
     */
    @ReactMethod
    public void minimizeApp() {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity != null) {
            currentActivity.moveTaskToBack(true);
        } else {
            // Fallback - try to send to home screen
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(homeIntent);
        }
    }
}

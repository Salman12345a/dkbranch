package com.dkbranch.FloatingOverlay;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.app.ActivityManager;
import android.content.Context;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class FloatingOverlayModule extends ReactContextBaseJavaModule {
    private static final String TAG = "FloatingOverlayModule";
    private final ReactApplicationContext reactContext;
    private static final int OVERLAY_PERMISSION_REQ_CODE = 1234;
    private boolean isOverlayShowing = false;

    public FloatingOverlayModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "FloatingOverlayModule";
    }

    @ReactMethod
    public void showOverlay(boolean isStoreOpen, int orderCount) {
        if (!Settings.canDrawOverlays(reactContext)) {
            Log.e(TAG, "Cannot show overlay because permission is not granted");
            return;
        }

        // Check if service is already running
        boolean isServiceRunning = isServiceRunning(FloatingOverlayService.class);

        Intent intent = new Intent(reactContext, FloatingOverlayService.class);
        intent.putExtra("isStoreOpen", isStoreOpen);
        intent.putExtra("orderCount", orderCount);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent);
        } else {
            reactContext.startService(intent);
        }
        
        isOverlayShowing = true;
        Log.d(TAG, "Started floating overlay service. IsServiceRunning: " + isServiceRunning);
    }

    @ReactMethod
    public void updateOverlay(boolean isStoreOpen, int orderCount) {
        if (!isOverlayShowing || !isServiceRunning(FloatingOverlayService.class)) {
            showOverlay(isStoreOpen, orderCount);
            return;
        }

        // Update the existing service
        Intent intent = new Intent(reactContext, FloatingOverlayService.class);
        intent.putExtra("isStoreOpen", isStoreOpen);
        intent.putExtra("orderCount", orderCount);
        intent.setAction("UPDATE_OVERLAY");
        
        reactContext.startService(intent);
        Log.d(TAG, "Updated floating overlay content");
    }

    @ReactMethod
    public void hideOverlay() {
        Intent intent = new Intent(reactContext, FloatingOverlayService.class);
        reactContext.stopService(intent);
        isOverlayShowing = false;
        Log.d(TAG, "Stopped floating overlay service");
    }

    @ReactMethod
    public void isOverlayShowing(Promise promise) {
        boolean isRunning = isServiceRunning(FloatingOverlayService.class);
        promise.resolve(isRunning);
    }

    @ReactMethod
    public void checkOverlayPermission(Promise promise) {
        boolean hasPermission = Settings.canDrawOverlays(reactContext);
        promise.resolve(hasPermission);
    }

    @ReactMethod
    public void requestOverlayPermission(Promise promise) {
        if (Settings.canDrawOverlays(reactContext)) {
            promise.resolve(true);
            return;
        }

        try {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + reactContext.getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            if (getCurrentActivity() != null) {
                getCurrentActivity().startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE);
                promise.resolve(false);
            } else {
                // Fallback if current activity is null
                reactContext.startActivity(intent);
                promise.resolve(false);
            }
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to request overlay permission: " + e.getMessage());
        }
    }

    // Helper method to check if the service is running
    private boolean isServiceRunning(Class<?> serviceClass) {
        ActivityManager manager = (ActivityManager) reactContext.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager != null) {
            for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
                if (serviceClass.getName().equals(service.service.getClassName())) {
                    return true;
                }
            }
        }
        return false;
    }

    // Method to emit events to React Native
    public void sendEvent(String eventName, Object params) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }
} 
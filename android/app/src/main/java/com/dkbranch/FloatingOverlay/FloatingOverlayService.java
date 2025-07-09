package com.dkbranch.FloatingOverlay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.ImageView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.dkbranch.R;

public class FloatingOverlayService extends Service {
    private static final String TAG = "FloatingOverlayService";
    private static final String CHANNEL_ID = "FloatingOverlayChannel";
    private static final int NOTIFICATION_ID = 1001;

    private WindowManager windowManager;
    private View floatingView;
    private TextView statusTextView;
    private TextView orderCountTextView;
    private View statusDot;
    private WindowManager.LayoutParams params;

    private int initialX;
    private int initialY;
    private float initialTouchX;
    private float initialTouchY;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Floating overlay service created");

        // Create the floating view
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        
        // Initialize the view
        LayoutInflater inflater = (LayoutInflater) getSystemService(Context.LAYOUT_INFLATER_SERVICE);
        floatingView = inflater.inflate(R.layout.floating_overlay, null);
        
        // Find the TextViews and other views
        statusTextView = floatingView.findViewById(R.id.statusTextView);
        orderCountTextView = floatingView.findViewById(R.id.orderCountTextView);
        statusDot = floatingView.findViewById(R.id.statusDot); // Now this is inside a CardView wrapper

        // Set up window parameters
        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | 
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT
        );

        // Initial position - place it in a more visible position
        params.gravity = Gravity.TOP | Gravity.END;
        params.x = 20;
        params.y = 150;
        
        // Make it more visible
        floatingView.setAlpha(1.0f);

        // Set up touch listener for dragging
        floatingView.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX + (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(floatingView, params);
                        return true;
                    case MotionEvent.ACTION_UP:
                        // If it was a quick tap (not a drag)
                        if (Math.abs(event.getRawX() - initialTouchX) < 10 && 
                            Math.abs(event.getRawY() - initialTouchY) < 10) {
                            // Click action - could open the app here
                            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
                            if (launchIntent != null) {
                                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(launchIntent);
                            }
                        }
                        return true;
                }
                return false;
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            boolean isStoreOpen = intent.getBooleanExtra("isStoreOpen", false);
            int orderCount = intent.getIntExtra("orderCount", 0);
            
            // Check if this is an update request
            String action = intent.getAction();
            if (action != null && action.equals("UPDATE_OVERLAY")) {
                Log.d(TAG, "Received UPDATE_OVERLAY action. Orders: " + orderCount);
                updateOverlayContent(isStoreOpen, orderCount);
                return START_STICKY;
            }
            
            updateOverlayContent(isStoreOpen, orderCount);
        }

        // Create notification channel for Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Floating Overlay Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setLightColor(Color.BLUE);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
        
        // Create foreground notification
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Listening for orders")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
        
        // Start as a foreground service
        startForeground(NOTIFICATION_ID, notification);
        
        // Add the floating view to the window
        if (floatingView.getWindowToken() == null) {
            try {
                windowManager.addView(floatingView, params);
                Log.d(TAG, "Added floating view to window");
                
                // Make the overlay appear with an animation effect
                floatingView.setScaleX(0.0f);
                floatingView.setScaleY(0.0f);
                floatingView.animate()
                    .scaleX(1.0f)
                    .scaleY(1.0f)
                    .setDuration(300)
                    .start();
                
                // Periodically check and bring to front if needed
                floatingView.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            if (floatingView != null && floatingView.getWindowToken() != null) {
                                // Try to update view to bring it to front
                                windowManager.updateViewLayout(floatingView, params);
                            }
                            floatingView.postDelayed(this, 3000); // Check every 3 seconds
                        } catch (Exception e) {
                            Log.e(TAG, "Error in periodic check: " + e.getMessage());
                        }
                    }
                }, 3000);
                
            } catch (Exception e) {
                Log.e(TAG, "Error adding view: " + e.getMessage());
            }
        } else {
            try {
                // Update the existing view to ensure it's visible
                windowManager.updateViewLayout(floatingView, params);
                Log.d(TAG, "Updated existing floating view");
            } catch (Exception e) {
                Log.e(TAG, "Error updating view: " + e.getMessage());
            }
        }
        
        return START_STICKY;
    }

    private void updateOverlayContent(boolean isStoreOpen, int orderCount) {
        try {
            // Apply colored overlay to the logo image to indicate status
            if (statusDot != null && statusDot instanceof ImageView) {
                ImageView logoImage = (ImageView) statusDot;
                
                if (isStoreOpen) {
                    // When open: show logo in full color with a slight green tint
                    logoImage.setColorFilter(null); // Clear any existing filter
                    // Apply a very subtle green tint
                    logoImage.setColorFilter(Color.argb(40, 0, 255, 0), android.graphics.PorterDuff.Mode.OVERLAY);
                } else {
                    // When closed: show logo with a red tint
                    logoImage.setColorFilter(Color.argb(90, 255, 0, 0), android.graphics.PorterDuff.Mode.MULTIPLY);
                }
            }
            
            // Update hidden text for accessibility (screen readers)
            if (statusTextView != null) {
                statusTextView.setText(isStoreOpen ? "OPEN" : "CLOSED");
            }
            
            // Update order count badge
            if (orderCountTextView != null) {
                // Get the parent CardView of the orderCountTextView
                View badgeContainer = (View) orderCountTextView.getParent();
                
                // Only show badge if there are orders
                if (orderCount > 0) {
                    // Show the badge container
                    badgeContainer.setVisibility(View.VISIBLE);
                    orderCountTextView.setText(String.valueOf(orderCount));
                    
                    // For larger numbers, adjust text size to fit
                    if (orderCount > 9) {
                        orderCountTextView.setTextSize(8); // Smaller text for double digits
                    } else {
                        orderCountTextView.setTextSize(10); // Regular size for single digit
                    }
                    
                    // Red background for higher order counts
                    int badgeColor = orderCount > 5 ? Color.RED : Color.parseColor("#FFEB3B");
                    
                    // Apply background color to the CardView container
                    if (badgeContainer instanceof androidx.cardview.widget.CardView) {
                        ((androidx.cardview.widget.CardView) badgeContainer).setCardBackgroundColor(badgeColor);
                    }
                    
                    // Subtle notification for new orders
                    final int pulseCount = 2;
                    pulseOverlay(pulseCount);
                } else {
                    // Hide badge when no orders
                    badgeContainer.setVisibility(View.GONE);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating overlay content: " + e.getMessage());
        }
    }
    
    private void pulseOverlay(final int remainingPulses) {
        if (remainingPulses <= 0 || floatingView == null) return;
        
        // Use alpha (transparency) pulse instead of scaling to save space
        floatingView.animate()
            .alpha(0.5f)  // Fade out slightly
            .setDuration(150)
            .withEndAction(new Runnable() {
                @Override
                public void run() {
                    if (floatingView == null) return;
                    
                    floatingView.animate()
                        .alpha(1.0f)  // Fade back in
                        .setDuration(150)
                        .withEndAction(new Runnable() {
                            @Override
                            public void run() {
                                if (floatingView == null) return;
                                
                                if (remainingPulses > 1) {
                                    // Small delay before next pulse
                                    floatingView.postDelayed(new Runnable() {
                                        @Override
                                        public void run() {
                                            pulseOverlay(remainingPulses - 1);
                                        }
                                    }, 200);  // Shorter delay between pulses
                                }
                            }
                        })
                        .start();
                }
            })
            .start();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingView != null && floatingView.getWindowToken() != null) {
            try {
                windowManager.removeView(floatingView);
                Log.d(TAG, "Removed floating view from window");
            } catch (Exception e) {
                Log.e(TAG, "Error removing floating view: " + e.getMessage());
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
} 
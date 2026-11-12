package net.blockbench.mobile;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends AppCompatActivity {

    private WebView mWebView;
    private ValueCallback<Uri[]> mFilePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private boolean isImmersiveFullscreen = false;
    private WindowInsetsControllerCompat mInsetsController;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on while modeling
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Request highest display refresh rate (e.g. 120Hz)
        setDisplayRefreshRate(120.0f);

        mWebView = new WebView(this);
        setContentView(mWebView);

        mInsetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (mInsetsController != null) {
            mInsetsController.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Enable hardware acceleration
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // JavaScript Bridge
        mWebView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url.getHost() != null && url.getHost().equals("appassets.androidplatform.net")) {
                    return false;
                }
                // External URLs opened in browser
                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                startActivity(intent);
                return true;
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                if (fileChooserParams != null && fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }

                try {
                    startActivityForResult(Intent.createChooser(intent, "Select File"), FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    mFilePathCallback = null;
                    Toast.makeText(MainActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // Handle back button press
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            private long backPressedTime = 0;

            @Override
            public void handleOnBackPressed() {
                if (isImmersiveFullscreen) {
                    toggleFullscreen();
                    return;
                }
                if (mWebView.canGoBack()) {
                    mWebView.goBack();
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish();
                    } else {
                        backPressedTime = System.currentTimeMillis();
                        Toast.makeText(MainActivity.this, "Press back again to exit", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });

        // Load local asset URL
        mWebView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    public void setDisplayRefreshRate(float targetFps) {
        runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Display display;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        display = getDisplay();
                    } else {
                        display = getWindowManager().getDefaultDisplay();
                    }
                    if (display == null) return;

                    Display.Mode[] modes = display.getSupportedModes();
                    Display.Mode bestMode = null;
                    float highestRate = 60.0f;

                    for (Display.Mode mode : modes) {
                        float rate = mode.getRefreshRate();
                        if (rate > highestRate) {
                            if (targetFps >= 120.0f || rate <= targetFps + 2.0f) {
                                highestRate = rate;
                                bestMode = mode;
                            }
                        }
                    }

                    WindowManager.LayoutParams params = getWindow().getAttributes();
                    if (targetFps > 60.0f && bestMode != null) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            params.preferredDisplayModeId = bestMode.getModeId();
                        }
                        params.preferredRefreshRate = highestRate;
                    } else {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            params.preferredDisplayModeId = 0;
                        }
                        params.preferredRefreshRate = targetFps;
                    }
                    getWindow().setAttributes(params);
                }
            } catch (Exception ignored) {}
        });
    }

    public boolean saveFileToDownloads(String filename, String base64Data, String mimeType) {
        try {
            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
            if (mimeType == null || mimeType.isEmpty()) {
                mimeType = "application/octet-stream";
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri fileUri = getContentResolver().insert(collection, values);

                if (fileUri != null) {
                    try (OutputStream out = getContentResolver().openOutputStream(fileUri)) {
                        if (out != null) {
                            out.write(fileBytes);
                            out.flush();
                        }
                    }
                    values.clear();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(fileUri, values, null, null);

                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved: " + filename, Toast.LENGTH_SHORT).show());
                    return true;
                }
            } else {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                File destFile = new File(downloadsDir, filename);
                try (FileOutputStream fos = new FileOutputStream(destFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }
                MediaScannerConnection.scanFile(MainActivity.this, new String[]{destFile.getAbsolutePath()}, null, null);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved: " + filename, Toast.LENGTH_SHORT).show());
                return true;
            }
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Failed to save file: " + e.getMessage(), Toast.LENGTH_SHORT).show());
        }
        return false;
    }

    public void toggleFullscreen() {
        runOnUiThread(() -> {
            if (mInsetsController == null) return;
            isImmersiveFullscreen = !isImmersiveFullscreen;
            if (isImmersiveFullscreen) {
                mInsetsController.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                mInsetsController.show(WindowInsetsCompat.Type.systemBars());
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
            }
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void toggleFullscreen() {
            MainActivity.this.toggleFullscreen();
        }

        @JavascriptInterface
        public boolean isFullscreen() {
            return isImmersiveFullscreen;
        }

        @JavascriptInterface
        public void setRefreshRate(float fps) {
            MainActivity.this.setDisplayRefreshRate(fps);
        }

        @JavascriptInterface
        public boolean saveBase64File(String filename, String base64Data, String mimeType) {
            return MainActivity.this.saveFileToDownloads(filename, base64Data, mimeType);
        }

        @JavascriptInterface
        public void vibrate(long milliseconds) {
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vibratorManager != null ? vibratorManager.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(milliseconds);
                }
            }
        }

        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }
    }
}

package com.yashothenterprises.erp;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register Native JavaScript Bridge for Android System Print (A4 PDF) & Native Share
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.addJavascriptInterface(new AndroidNativeBridge(this, webView), "AndroidNative");
        }

        // Intercept Android Predictive Back Gesture & Hardware Back Button
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) {
                    moveTaskToBack(true);
                    return;
                }
                WebView webView = bridge.getWebView();
                webView.evaluateJavascript(
                    "(function() { return window.__handleAndroidBack ? window.__handleAndroidBack() : 'FALLBACK'; })()",
                    result -> {
                        if (result != null && result.contains("HANDLED")) {
                            // Handled inside React (closed modal, navigated to previous page, or showed exit toast)
                            return;
                        }
                        if (result != null && result.contains("EXIT")) {
                            moveTaskToBack(true);
                            return;
                        }
                        // Fallback if JS handler isn't mounted yet
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            moveTaskToBack(true);
                        }
                    }
                );
            }
        });
    }

    public static class AndroidNativeBridge {
        private final MainActivity activity;
        private final WebView webView;

        public AndroidNativeBridge(MainActivity activity, WebView webView) {
            this.activity = activity;
            this.webView = webView;
        }

        @JavascriptInterface
        public void printPage(String jobName) {
            activity.runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                    if (printManager != null) {
                        String safeName = (jobName != null && !jobName.trim().isEmpty())
                            ? jobName.trim()
                            : "Yashoth_Enterprises_Document";
                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(safeName);
                        PrintAttributes.Builder builder = new PrintAttributes.Builder();
                        builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                        printManager.print(safeName, printAdapter, builder.build());
                    }
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            activity.runOnUiThread(() -> {
                try {
                    Intent sendIntent = new Intent(Intent.ACTION_SEND);
                    sendIntent.setType("text/plain");
                    if (title != null) {
                        sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                    }
                    sendIntent.putExtra(Intent.EXTRA_TEXT, text != null ? text : "");
                    Intent shareIntent = Intent.createChooser(sendIntent, title != null ? title : "Share via");
                    activity.startActivity(shareIntent);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public boolean shareBackupFile(String fileName, String content, String mimeType) {
            final String safeName = (fileName != null && !fileName.trim().isEmpty())
                ? fileName.trim()
                : ("YE_Backup_" + System.currentTimeMillis() + ".json");
            final String safeMime = (mimeType != null && !mimeType.trim().isEmpty())
                ? mimeType.trim()
                : "application/json";

            try {
                // Ensure cache dir exists
                File cacheDir = new File(activity.getCacheDir(), "backups");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }
                File file = new File(cacheDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write((content != null ? content : "").getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }

                // Also save to device Downloads folder so the file is permanently accessible
                saveFileToDownloads(safeName, content, safeMime);

                Uri fileUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    file
                );

                activity.runOnUiThread(() -> {
                    try {
                        Intent sendIntent = new Intent(Intent.ACTION_SEND);
                        sendIntent.setType(safeMime);
                        sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                        sendIntent.putExtra(Intent.EXTRA_SUBJECT, "Yashoth Enterprises ERP Backup - " + safeName);
                        sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        Intent chooser = Intent.createChooser(sendIntent, "Save to Google Drive / Share Backup");
                        activity.startActivity(chooser);
                    } catch (Exception e) {
                        shareText(safeName, content);
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean saveFileToDownloads(String fileName, String content, String mimeType) {
            final String safeName = (fileName != null && !fileName.trim().isEmpty())
                ? fileName.trim()
                : ("YE_Backup_" + System.currentTimeMillis() + ".json");
            final String safeMime = (mimeType != null && !mimeType.trim().isEmpty())
                ? mimeType.trim()
                : "application/json";

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = activity.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write((content != null ? content : "").getBytes(StandardCharsets.UTF_8));
                                os.flush();
                                return true;
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File outFile = new File(downloadsDir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write((content != null ? content : "").getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                        return true;
                    }
                }
            } catch (Exception ignored) {
            }
            return false;
        }

        @JavascriptInterface
        public void exitApp() {
            activity.runOnUiThread(() -> activity.moveTaskToBack(true));
        }
    }
}

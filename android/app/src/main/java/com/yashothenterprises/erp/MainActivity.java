package com.yashothenterprises.erp;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

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
        public void exitApp() {
            activity.runOnUiThread(() -> activity.moveTaskToBack(true));
        }
    }
}

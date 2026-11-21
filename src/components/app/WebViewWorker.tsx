import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { SOURCE_CONFIG } from "@/config/source";
import { GLOBAL_BOOTSTRAP } from "@/services/bootstrap";
import { sessionManager } from "@/services/session";
import { webViewBridge } from "@/services/webview";
import { logger } from "@/utils/logger";
import type { ISession } from "@/types";

const WORKER_URL = SOURCE_CONFIG.sessionWashUrl;

export const WebViewWorker = () => {
  const vRef = useRef<React.ComponentRef<typeof WebView>>(null);

  useEffect(() => {
    webViewBridge.registerNavigation((uri: string) => {
      vRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(uri)};`);
    });
    webViewBridge.registerInjector((js: string) => {
      vRef.current?.injectJavaScript(js);
    });
    webViewBridge.registerReloader(() => {
      vRef.current?.reload();
    });
  }, []);

  const handleMessage = useCallback((e: WebViewMessageEvent) => {
    const raw = e.nativeEvent.data;
    const result = webViewBridge.handleMessage(raw);
    if (result == null) return;

    if (result.type === "LOG") {
      logger.debug("session", `[WebView Log] ${result.data}`);
      return;
    }

    if (result.type === "HTTP") {
      webViewBridge.handleHttp(result.data);
      return;
    }

    if (result.type === "SESSION_UPDATE") {
      if (typeof result.data === "object" && result.data !== null && "cookies" in result.data && "userAgent" in result.data) {
        void sessionManager.setSession(result.data as ISession).catch((error: unknown) => {
          logger.warn("session", "Failed to persist session report", error);
        });
      }
      return;
    }
  }, []);

  return (
    <View style={{ width: 0, height: 0, position: "absolute", opacity: 0 }}>
      <WebView
        ref={vRef}
        source={{ uri: WORKER_URL }}
        injectedJavaScript={GLOBAL_BOOTSTRAP}
        onMessage={handleMessage}
        // A navigation in flight cannot answer injected requests; the flag
        // makes them fail fast instead of racing the page swap
        onLoadStart={() => webViewBridge.setLoaded(false)}
        onLoadEnd={() => webViewBridge.setLoaded(true)}
        onRenderProcessGone={() => {
          // Android killed the renderer (memory pressure): without a reload the
          // worker stays dead and every wash burns its 40s timeout forever
          webViewBridge.setLoaded(false);
          vRef.current?.reload();
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

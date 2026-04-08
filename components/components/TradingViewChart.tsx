"use client";

import { useEffect, useRef, useState } from "react";

/**
 * TradingView Advanced Chart Widget — uses their official script loader.
 * No API key needed. Dark theme matching CLAUDIA.
 */

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  height?: number;
  className?: string;
}

export default function TradingViewChart({
  symbol,
  interval = "60",
  height = 400,
  className = "",
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const ticker = symbol.toUpperCase().replace("/USD", "").replace("USDT", "");

  // Force fresh mount when ticker or interval changes
  useEffect(() => {
    setWidgetKey((k) => k + 1);
  }, [ticker, interval]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // TradingView expects the script inside the widget container div
    const widgetConfig = {
      autosize: true,
      symbol: `BINANCE:${ticker}USDT`,
      interval: interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(14, 14, 20, 1)",
      gridColor: "rgba(255, 255, 255, 0.03)",
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: true,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    };

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(widgetConfig);

    container.appendChild(script);

    return () => {
      // Full cleanup on unmount
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [widgetKey, ticker, interval]);

  return (
    <div className={`rounded-xl overflow-hidden border border-white/5 ${className}`}>
      <div
        key={widgetKey}
        className="tradingview-widget-container"
        ref={containerRef}
        style={{ height, width: "100%" }}
      />
    </div>
  );
}

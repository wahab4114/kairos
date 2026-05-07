#!/usr/bin/env python3
import json
import sys
from typing import Any

try:
    import yfinance as yf
except Exception:
    print(json.dumps({}))
    sys.exit(0)


def to_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def get_info_value(info: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in info and info[key] is not None:
            return info[key]
    return None


def output_history(symbol: str, days: int) -> None:
    period = '6mo'
    if days <= 30:
        period = '1mo'
    elif days <= 90:
        period = '3mo'
    elif days <= 180:
        period = '6mo'
    elif days <= 365:
        period = '1y'
    else:
        period = '2y'

    try:
        history = yf.Ticker(symbol).history(period=period, interval='1d', auto_adjust=False)
    except Exception:
        print(json.dumps({"closes": []}))
        return

    if history is None or history.empty or 'Close' not in history:
        print(json.dumps({"closes": []}))
        return

    closes = []
    for value in history['Close'].dropna().tolist():
        numeric = to_float(value)
        if numeric is not None and numeric > 0:
            closes.append(numeric)

    if days > 0 and len(closes) > days:
        closes = closes[-days:]

    print(json.dumps({"closes": closes}))


def output_fundamentals(symbol: str) -> None:
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        fast_info = getattr(ticker, 'fast_info', None)
    except Exception:
        print(json.dumps({"metrics": None}))
        return

    pe_ratio = to_float(get_info_value(info, 'trailingPE', 'forwardPE'))
    beta = to_float(get_info_value(info, 'beta'))
    revenue_growth = to_float(get_info_value(info, 'revenueGrowth'))

    week_high = to_float(get_info_value(info, 'fiftyTwoWeekHigh'))
    week_low = to_float(get_info_value(info, 'fiftyTwoWeekLow'))

    if fast_info is not None:
        week_high = week_high if week_high is not None else to_float(getattr(fast_info, 'year_high', None))
        week_low = week_low if week_low is not None else to_float(getattr(fast_info, 'year_low', None))

    payload = {
        "metrics": {
            "peRatio": pe_ratio,
            "beta": beta,
            "weekHigh52": week_high,
            "weekLow52": week_low,
            "revenueGrowthYOY": revenue_growth,
        }
    }
    print(json.dumps(payload))


def main() -> None:
    mode = (sys.argv[1] if len(sys.argv) > 1 else '').strip().lower()
    symbol = (sys.argv[2] if len(sys.argv) > 2 else '').strip().upper()

    if not mode or not symbol:
        print(json.dumps({}))
        return

    if mode == 'history':
        try:
            days = int(sys.argv[3]) if len(sys.argv) > 3 else 90
        except Exception:
            days = 90
        output_history(symbol, max(days, 1))
        return

    if mode == 'fundamentals':
        output_fundamentals(symbol)
        return

    print(json.dumps({}))


if __name__ == '__main__':
    main()

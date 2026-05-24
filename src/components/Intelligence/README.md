# Intelligence Engine (Plain-English Guide)

This document explains how Kairos computes Buy / Hold / Sell in simple terms.

## Quick Summary

Kairos combines 3 signals:

1. Momentum: Is price trend moving up or down?
2. Sentiment: Is recent news tone positive or negative?
3. Fundamentals: Does the company look healthy/expensive based on key metrics?

Then it combines them into one final score and maps that to Buy / Hold / Sell.

## Final Decision Formula

Composite score:

$$
\text{composite} = 0.39 \cdot \text{momentum} + 0.33 \cdot \text{sentiment} + 0.28 \cdot \text{fundamentals}
$$

Decision thresholds:

- Buy if composite > 0.13
- Sell if composite < -0.13
- Hold otherwise

## 1) Momentum

Purpose:
- Measures short-to-medium trend direction from historical prices.

Windows used:
- 1 day, 5 days, 21 days, 63 days

Raw return formula:

$$
\text{return} = \frac{\text{latest price} - \text{older price}}{\text{older price}}
$$

Return normalization (keeps values between -1 and +1):

$$
\text{score} = \tanh(10 \cdot \text{return})
$$

Weighted momentum score:

$$
\text{momentum} = 0.15\cdot s_{1d} + 0.25\cdot s_{1w} + 0.30\cdot s_{1m} + 0.30\cdot s_{3m}
$$

Example:
- 1d: +1%
- 1w: +3%
- 1m: +6%
- 3m: +12%

All windows are positive, so momentum becomes clearly positive.

## 2) Sentiment

Purpose:
- Measures whether recent company news is mostly positive or negative.

News windows:
- Short: 1 day
- Mid: 7 days
- Long: 30 days

Each headline/summary is scored with text sentiment, then averaged per window.

Horizon blend:

$$
\text{sentiment}_{lex} = 0.48\cdot short + 0.30\cdot mid + 0.22\cdot long
$$

If Finnhub sentiment is available, Kairos blends it into the mid window:

$$
mid_{hybrid} = 0.4\cdot mid_{lex} + 0.6\cdot mid_{finnhub}
$$

Then recomputes final sentiment with the same 0.48 / 0.30 / 0.22 horizon weights.

Example:
- short = +0.40
- mid = +0.20
- long = -0.10

Final sentiment is usually still positive because short and mid dominate.

## 3) Fundamentals

Purpose:
- Adds business/valuation context so recommendation is not based only on trend/news.

Metrics used:
- P/E ratio
- 52-week high/low position
- Revenue growth YoY
- Beta (mostly as risk note)

Scoring behavior (simplified):
- Lower/reasonable P/E -> positive contribution
- Very high P/E -> negative contribution
- Price near 52-week low -> positive contribution
- Price near 52-week high -> slight negative contribution
- Strong revenue growth -> positive contribution
- Negative revenue growth -> negative contribution

Final fundamentals score is clamped to [-1, +1].

Example:
- P/E = 18 (reasonable) -> small positive
- Revenue growth = +9% -> positive
- Price in mid-range of 52-week band -> neutral

Fundamentals end up moderately positive.

## Confidence (How sure is the engine?)

Confidence increases when:
- Composite magnitude is larger (far from 0)
- All 3 signals point in the same direction

## Refresh and Caching

- Intelligence auto-refreshes every 60 seconds.
- Signals are cached in local storage and shown immediately on page load.
- Refresh updates cache with latest values.

## Not Financial Advice

This is a rules-based assistant for decision support, not personalized financial advice.

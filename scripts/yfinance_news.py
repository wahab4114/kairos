#!/usr/bin/env python3
import json
import sys
import time

try:
    import yfinance as yf
except Exception:
    print(json.dumps({"items": []}))
    sys.exit(0)


def safe_int(value: object) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    return int(time.time())


def hash_to_int(value: str) -> int:
    acc = 0
    for ch in value:
        acc = ((acc << 5) - acc + ord(ch)) & 0xFFFFFFFF
    return acc or int(time.time())


def extract_link(item: dict) -> str:
    link = item.get("link")
    if isinstance(link, str) and link:
        return link

    canonical = item.get("canonicalUrl")
    if isinstance(canonical, dict):
        url = canonical.get("url")
        if isinstance(url, str) and url:
            return url

    return ""


def unwrap_content(item: dict) -> dict:
    content = item.get("content")
    if isinstance(content, dict):
        return content
    return item


def main() -> None:
    symbol = (sys.argv[1] if len(sys.argv) > 1 else "").strip().upper()
    limit_raw = sys.argv[2] if len(sys.argv) > 2 else "8"

    try:
        limit = max(1, min(25, int(limit_raw)))
    except Exception:
        limit = 8

    if not symbol:
        print(json.dumps({"items": []}))
        return

    try:
        ticker = yf.Ticker(symbol)
        news = ticker.news or []
    except Exception:
        print(json.dumps({"items": []}))
        return

    seen: set[str] = set()
    items: list[dict] = []

    for idx, raw in enumerate(news):
        if not isinstance(raw, dict):
            continue

        payload = unwrap_content(raw)

        title = payload.get("title")
        if not isinstance(title, str) or not title.strip():
            continue

        link = extract_link(payload)
        if not link:
            continue

        dedupe_key = f"{title.strip().lower()}|{link.strip().lower()}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        provider = payload.get("provider")
        provider_name = provider.get("displayName") if isinstance(provider, dict) else None
        publisher = provider_name if isinstance(provider_name, str) and provider_name else payload.get("publisher")
        source = publisher if isinstance(publisher, str) and publisher.strip() else "Yahoo Finance"

        summary = payload.get("summary") or payload.get("description")
        if not isinstance(summary, str):
            summary = ""

        provider_publish_time = payload.get("providerPublishTime")
        if not provider_publish_time:
            pub_date = payload.get("pubDate")
            if isinstance(pub_date, str) and pub_date:
                try:
                    provider_publish_time = int(time.mktime(time.strptime(pub_date, "%Y-%m-%dT%H:%M:%SZ")))
                except Exception:
                    provider_publish_time = None
        published = safe_int(provider_publish_time)

        raw_id = payload.get("uuid") or payload.get("id") or raw.get("id") or (idx + 1)
        if isinstance(raw_id, str):
            item_id = hash_to_int(raw_id)
        else:
            item_id = safe_int(raw_id)

        items.append(
            {
                "id": item_id,
                "headline": title.strip(),
                "source": source.strip(),
                "url": link.strip(),
                "summary": summary.strip(),
                "datetime": published,
            }
        )

        if len(items) >= limit:
            break

    print(json.dumps({"items": items}))


if __name__ == "__main__":
    main()

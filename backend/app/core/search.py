"""Small-catalogue relevance search and a shared pagination response."""

import re
import unicodedata
from difflib import SequenceMatcher


def tokens(value):
    text = (
        unicodedata.normalize("NFKD", str(value))
        .encode("ascii", "ignore")
        .decode()
        .casefold()
    )
    return re.findall(r"[a-z0-9]+", text)


def rank(records, query, fields):
    terms = tokens(query)[:12]
    if not terms:
        return list(records)
    scored = []
    for index, record in enumerate(records):
        score = 0
        for term in terms:
            best = 0
            for field, weight in fields.items():
                words = tokens(record.get(field, ""))
                for word in words:
                    value = (
                        1
                        if term == word
                        else 0.8
                        if word.startswith(term)
                        else 0.55
                        if len(term) >= 4
                        and abs(len(term) - len(word)) <= 2
                        and SequenceMatcher(None, term, word).ratio() >= 0.78
                        else 0
                    )
                    best = max(best, value * weight)
            if not best:
                break
            score += best
        else:
            scored.append((score, index, record))
    return [r for _, _, r in sorted(scored, key=lambda row: (-row[0], row[1]))]


def paginate(records, page=1, page_size=10, engine="local"):
    total = len(records)
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)
    offset = (page - 1) * page_size
    return {
        "items": records[offset : offset + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "engine": engine,
    }

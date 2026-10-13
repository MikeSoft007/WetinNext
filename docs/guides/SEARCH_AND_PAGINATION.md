# Search, pagination and the shared workspace theme

Implemented on 2026-10-12.

## User experience

- Admin, learner and CV screens share Poppins, a standard white canvas, quiet teal accents, restrained peach actions, rounded borders and the same original learner illustration.
- Catalogue results use six records per learner/public page and ten per admin page. The controls show the current range, total, page number and previous/next buttons, with disabled boundary states.
- Discover has separate expandable opportunity and free-resource catalogues. The top search searches both; opportunity geography remains exactly Nigeria, Rwanda or Global.
- Search or visibility/market changes reset catalogue pagination to page one. Searches debounce for 200 ms and cancelled requests cannot overwrite the new selection.
- Saved applications and learning check-ins use browser pagination/search over the authenticated workspace response. Application stage history and the four-week plan remain visible without artificial pagination.
- Admin content, learner directory, audit changes and CV review history use API pagination. CV review search covers filename, goal and detected skills, excluding the extracted preview.
- Small source lists use the same controls. Empty results, loading, failed requests and boundary pages have explicit states.

## REST endpoints

Existing array endpoints remain compatible. New catalogue search:

```
GET /api/v1/search?kind=opportunities&country=Global&q=pythn&page=1&page_size=6
GET /api/v1/search?kind=resources&q=python&page=1&page_size=6
GET /api/v1/admin/search?kind=opportunities&status=draft&q=python&page=1&page_size=10
```

Additional optional pagination on the owning services, forwarded through the gateway:

```
GET /api/v1/admin/learners?page=1&page_size=10&q=Rwanda
GET /api/v1/admin/audit?page=1&page_size=10&q=publish
GET /api/v1/me/cv-reviews?page=1&page_size=6&q=internship
```

Paged responses have `items`, `total`, `page`, `pages`, `page_size`, and `engine`. Page sizes are 1–50; queries are at most 100 characters. Beyond-last-page requests clamp to the last available page. Invalid page zero, excessive page sizes and unsupported market values are rejected. Public catalogue search excludes unpublished and closed listings; `live_only=true` also excludes practice opportunities. Admin routes require admin roles, including the existing read-only demo. CV review rows always belong to the authenticated learner.

## Search engines

The built-in engine is available without another service. It normalises accents/case, matches multiple words across weighted fields, recognises prefixes and tolerates common typos. Exact and title/skill matches rank above weaker description matches.

Optional Elasticsearch uses its REST bulk indexing and structured multi-match queries with `fuzziness: AUTO`. Configure only on the backend:

```
ELASTICSEARCH_URL=https://your-elasticsearch-endpoint
ELASTICSEARCH_API_KEY=your-server-only-api-key
ELASTICSEARCH_INDEX=wetinnext-catalogue
```

Restart the backend services after configuration. Use a dedicated index and an API key scoped to that index with search/read, index/write and index auto-configuration privileges (or create the index first and remove auto-configuration). TLS verification remains enabled. Never put these credentials in frontend `VITE_` variables. A query triggers initial indexing; unchanged snapshots are reused, changed catalogue snapshots reindex before the next query. Empty-query browsing uses the canonical store directly.

SQLite remains the source of truth. Index data contains selected catalogue fields only. No learner profiles, CV documents/previews, private application notes or check-in reflections are indexed. Every Elasticsearch result must also exist in the current authorised canonical candidate set, so stale draft/archived/other-market hits cannot leak into public results. Source edits appear from the canonical record.

Offline errors, indexing errors, partial shard results and timeouts fall back to local relevance search. A 30-second cooldown prevents repeated slow calls. `engine` makes the active backend inspectable through REST. Elasticsearch integration is tested with HTTP doubles; a live cluster has not been supplied or verified.

## Practical scale limits

This keeps the current application small: local relevance search scans the current catalogue in memory, and the optional Elasticsearch adapter refreshes a catalogue snapshot on demand. Elasticsearch search is bounded to 10,000 catalogue documents/candidates; larger catalogues use local fallback. Private/admin collections also filter in the owning service before response pagination. A larger deployment should move indexing to a background change queue, add database query pagination, and use Elasticsearch-native paged ranking. Browser-paginated check-ins/applications should migrate to service pagination as those histories grow. No Elasticsearch cluster is required for the current demo.

## Verification

Regression coverage checks page boundaries/no duplicates, exact market and visibility filters, keyword/typo searches, admin permissions, CV ownership, index refresh after edits and fallback after indexing/network/partial-search errors. Browser checks verify learner page changes, filter reset and the themed read-only admin.

References: [Elasticsearch multi-match](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query), [Elasticsearch bulk API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk).

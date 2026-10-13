# LinkedIn companion workflow

Discover includes an external LinkedIn search using the saved goal and active market. Global omits the location filter; it does not establish worldwide eligibility or remote availability.

Learners can paste an HTTPS LinkedIn jobs URL and 80–20,000 characters of job text. `POST /api/v1/me/external-job-review` compares recognised skill mentions with their own background and latest CV review, returns gaps, up to three preparation actions and two available free resource suggestions. This is deterministic text matching, not a hiring or eligibility score. Unrecognised requirements need manual review.

The server never fetches LinkedIn, saves the pasted description or sends it to OpenAI. URL validation allows only linkedin.com/www.linkedin.com jobs paths, HTTPS and no credentials. Listing availability is unverified. This does not import LinkedIn's catalogue or establish an official partnership.

The UI uses a collapsed form, source link and concise result. Processing uses an explicit animated indeterminate segment, disabled for reduced-motion preferences, with accessible stage labels; percentages are not invented.

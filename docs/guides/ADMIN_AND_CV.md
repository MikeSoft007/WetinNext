# Admin and CV workflows

Learners and admins use `/sign-in`. Backend-verified roles select `/app` or `/admin`; learner navigation has no admin option. `/auth/session` exposes the current role. Production Supabase administrators require `app_metadata.role=admin` set through trusted server administration, never user-editable metadata. Local demo admin credentials are stored privately in `backend/.admin-access.txt`; login issues a signed HttpOnly eight-hour cookie. REST automation can use `X-Admin-Key`. Per-admin actor attribution and role-management screens remain future work.

Admins curate resources/opportunities, import public source drafts, inspect aggregate learner activity, view configuration and audit changes. Content can be drafted, published or archived. See [Source and matching logic](SOURCE_AND_MATCHING_LOGIC.md).

Learners upload PDF, DOCX or UTF-8 TXT CVs through `/cv` (5MB limit, PDF up to20 pages). Text-based documents are required; OCR is not included. Originals are not retained. Saved reviews include metadata, a bounded text preview, detected sections/skill mentions and suggested actions. Review history belongs to its learner; deleting the account removes its reviews. Original CV files and saved text previews are not sent to OpenAI. Derived skill mentions may be sent with the learner’s goal, background, constraints and recorded practice to personalise guidance. Mentions support discovery but never count as verified competence.

## Read-only administrator preview

Open `/sign-in` → **Explore admin demo**, or `/admin-demo`. DEMO_MODE must be enabled and a local signing key configured. This issues a one-hour `admin_demo` role, distinct from a real administrator. Admin GET views work, while administrative writes are denied server-side. Learner counts and names are fictional in this preview; content and source status reflect the local catalogue. Sign out to leave the preview. The endpoint is disabled when DEMO_MODE=false.

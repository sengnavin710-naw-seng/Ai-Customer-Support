# Accessing Knowledge Base management

Open http://localhost:5173/knowledge-base and sign in with the existing development administrator email and password generated during local setup. The email is configured by `DEV_ADMIN_EMAIL` in the ignored backend `.env`; the password cannot be recovered from its salted hash. Do not reset credentials as a navigation troubleshooting step.

If you are in Sample Workspace / Preview Mode, choose **Sign in to Admin Workspace** in the banner, or **Knowledge Base → Sign in to manage knowledge**. Both preserve the current route. Enter your existing credentials and choose **Sign in**. From any authenticated page, choose **Knowledge Base** in the sidebar; on small screens first open the navigation menu.

Preview has no authenticated session and displays bundled fictional overview data. Its Knowledge Base panel does not fetch protected content. The authenticated workspace uses a bearer session for Knowledge Base HTTP requests; the backend reads and writes PostgreSQL. Its overview metrics and conversations remain synthetic. “API online” is only a liveness indicator, not authentication or database readiness.

Sessions last 30 minutes and are held in memory. Browser refresh returns to sign-in; API restart invalidates sessions. Authentication is development-only.

## UI navigation

| Feature | Within Knowledge Base |
| --- | --- |
| Categories | **Categories** tab → create form; existing category → **Edit [category name]** → **Save category** or delete. Referenced categories cannot be deleted. |
| Article creation | **Articles** → **New article** → title, category, language, body → **Create draft**. Create a category first if the database is empty. |
| Article editing | Select an article → edit fields → **Save new version**. Pending and archived articles cannot be edited. Unsaved changes must be saved before submission. |
| Version history | Select an article → scroll below the editor to **Version history** → expand a version. History is paginated. |
| Approval | Save a draft → **Submit saved version for review** → administrator selects pending article → **Approve version** or **Reject version**. Rejection requires a note; rejected content must become a new draft before resubmission. Phase 1 permits audited admin self-approval. |
| Search/pagination | Use search input + **Search** above article/category lists; use page controls below lists. Articles also have status and visibility filters. |
| Archive | Select article → **Archive article** → **Confirm archive**. Use **Visibility → Archived** to find archived records. This preserves versions and audit records. |
| Article audit | Select article → below version history choose **Load audit records**. Results are paginated and administrator-only. |

## API-only capabilities

Global audit browsing and category audit history are available through protected REST endpoints; Phase 1's UI provides article-level audit browsing, not a separate global Audit Logs page. The article-list `categoryId` filter is also available through the API. See [Knowledge Base contract](KNOWLEDGE_BASE.md) for all routes and payloads.

To inspect global audits without modifying data, sign in normally and use the browser's Network panel to obtain your current login response's `accessToken`. Keep it private and use it only against the local API. For example, in PowerShell 7:

```powershell
$kbToken = Read-Host 'Current local accessToken (hidden)' -MaskInput
$kbHeaders = @{ Authorization = "Bearer $kbToken" }
Invoke-RestMethod 'http://127.0.0.1:3000/api/knowledge-base/audit-records?page=1&limit=20' -Headers $kbHeaders
# Add &entityId=<category UUID> to restrict results to one category.
Remove-Variable kbToken, kbHeaders
```

Missing/expired authentication returns 401; non-admin audit access returns 403. The database approved-only view is an internal future retrieval boundary, not a public retrieval API. RAG, AI replies, Messenger, and Phase 2 are not implemented.

## Running version

`npm run dev` serves live Vite source with hot updates. If the new sign-in button is absent, refresh once (then sign in again). A static preview/deployed bundle must be rebuilt with `npm run build` and its serving process restarted. Run `npm run dev` from this repository if the application is stopped; do not start a second copy on the same port. No database reset or credential change is required.
